import 'reflect-metadata'
import { type INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppModule } from '../src/app.module'
import { configureApp } from '../src/configure-app'
import { MAX_REQUEST_ID_LENGTH } from '../src/common/middleware/request-id.middleware'

/**
 * End-to-end coverage of the cross-cutting behaviour every endpoint inherits, plus the one auth
 * route currently exposed. These are the guarantees a controller gets for free from `AppModule`, so
 * they are tested at the HTTP boundary rather than per controller.
 */
describe('API (e2e)', () => {
  let app: INestApplication

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    // bodyParser: false + configureApp mirrors `main.ts` exactly, so these tests cover the real
    // middleware stack and body limit rather than a test-only approximation of it.
    app = moduleRef.createNestApplication({ bodyParser: false })
    configureApp(app)
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  describe('GET /health', () => {
    it('reports ok', async () => {
      const response = await request(app.getHttpServer()).get('/health').expect(200)
      expect(response.body.status).toBe('ok')
      expect(response.body.service).toBe('homecare-api')
    })
  })

  describe('X-Request-Id', () => {
    it('generates one when the client does not supply it', async () => {
      const response = await request(app.getHttpServer()).get('/health').expect(200)
      expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
    })

    it('echoes a safe inbound value', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .set('X-Request-Id', 'trace-abc-123')
        .expect(200)
      expect(response.headers['x-request-id']).toBe('trace-abc-123')
    })

    it('replaces an oversized inbound value', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .set('X-Request-Id', 'x'.repeat(MAX_REQUEST_ID_LENGTH + 50))
        .expect(200)
      expect(response.headers['x-request-id']).toHaveLength(36)
    })

    /**
     * Node's HTTP layer rejects a header containing a newline outright, so this uses a tab, which
     * is transport-legal but should still be refused by the validator.
     */
    it('replaces an inbound value containing a control character', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .set('X-Request-Id', 'bad\tvalue')
        .expect(200)
      expect(response.headers['x-request-id']).not.toContain('bad')
    })

    it('is present even for an unmatched route', async () => {
      const response = await request(app.getHttpServer()).get('/no/such/route').expect(404)
      expect(response.headers['x-request-id']).toBeTruthy()
      expect(response.body.error.request_id).toBe(response.headers['x-request-id'])
    })
  })

  describe('POST /api/v1/auth/otp/request', () => {
    it('issues a challenge for a well-formed request', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/request')
        .send({ phone_e164: '0911234567', purpose: 'LOGIN' })
        .expect(200)
      expect(response.body.challenge_id).toBeDefined()
      expect(response.body.resend_after_seconds).toBeGreaterThan(0)
      expect(response.body).not.toHaveProperty('code')
    })

    it('normalises a locally formatted phone number', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/request')
        .send({ phone_e164: '0911 234 567', purpose: 'LOGIN' })
        .expect(200)
      expect(response.body.challenge_id).toBeDefined()
    })

    it('rejects a malformed phone with 422 and field-level detail', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/request')
        .send({ phone_e164: '12345', purpose: 'LOGIN' })
        .expect(422)

      expect(response.body.error.code).toBe('VALIDATION_ERROR')
      expect(response.body.error.fields).toHaveProperty('phone_e164')
      expect(response.body.error.request_id).toBeDefined()
    })

    it('rejects an unknown OTP purpose', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/request')
        .send({ phone_e164: '0911234567', purpose: 'HACK_THE_PLANET' })
        .expect(422)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('always includes an Amharic message', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/otp/request')
        .send({ phone_e164: '12345', purpose: 'LOGIN' })
        .expect(422)
      expect(typeof response.body.error.message_am).toBe('string')
      expect(response.body.error.message_am.length).toBeGreaterThan(0)
    })

    it('returns 429 once the phone limit is exceeded', async () => {
      const server = app.getHttpServer()
      const phone = '0911550001'
      for (let i = 0; i < 5; i += 1) {
        await request(server)
          .post('/api/v1/auth/otp/request')
          .send({ phone_e164: phone, purpose: 'LOGIN' })
          .expect(200)
      }
      const response = await request(server)
        .post('/api/v1/auth/otp/request')
        .send({ phone_e164: phone, purpose: 'LOGIN' })
        .expect(429)
      expect(response.body.error.code).toBe('RATE_LIMITED')
    })
  })

  describe('error envelope', () => {
    it('404s an unknown route in the documented shape', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/does-not-exist').expect(404)
      expect(response.body.error.code).toBe('NOT_FOUND')
      expect(response.body.error.request_id).toBeDefined()
    })

    it('never includes a stack trace in the body', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/does-not-exist')
      const serialised = JSON.stringify(response.body)
      expect(serialised).not.toContain('node_modules')
      expect(serialised).not.toContain('Error:')
    })

    it('uses the same request id in the body and the header', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/does-not-exist')
        .set('X-Request-Id', 'trace-correlation-1')
        .expect(404)
      expect(response.body.error.request_id).toBe('trace-correlation-1')
      expect(response.headers['x-request-id']).toBe('trace-correlation-1')
    })
  })

  /**
   * Guards against accidentally exposing an endpoint that authenticates nothing. Adding a route
   * without a guard is easy to do and invisible in review, so it is asserted explicitly.
   */
  describe('authentication boundary', () => {
    it('does not expose /auth/me without a session', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/auth/me')
      expect([401, 404]).toContain(response.status)
    })
  })
})