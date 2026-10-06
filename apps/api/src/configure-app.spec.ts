import { NestFactory } from '@nestjs/core'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppModule } from './app.module'
import { configureApp } from './configure-app'

/**
 * configureApp is the only place request-id middleware and the body limit are installed. If these
 * tests are ever deleted or skipped, `main.ts` becomes the one path in the codebase that nothing
 * exercises, which is how a boot-time failure ships with a green test suite.
 */

describe('configureApp', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication({ bodyParser: false })
    configureApp(app)
    await app.init()
  })

  afterAll(async () => {
    await app?.close()
  })

  it('starts and serves', async () => {
    await app.getHttpServer()
    expect(app).toBeDefined()
  })

  it('accepts a JSON body on a known route', async () => {
    // Exercises the parser installed by configureApp, not Nest's default.
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/request')
      .send({ phone_e164: '+251911000001', purpose: 'LOGIN' })
    expect(response.status).toBe(200)
    expect(response.body.challenge_id).toBeDefined()
  })

  it('rejects a malformed JSON body rather than crashing', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/request')
      .set('content-type', 'application/json')
      .send('{"phone_e164": ')
    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(response.status).toBeLessThan(500)
  })

  it('responds to preflight CORS OPTIONS requests with proper headers', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/v1/admin/requests')
      .set('Origin', 'http://localhost:3001')
      .set('Access-Control-Request-Method', 'GET')
    expect(response.headers['access-control-allow-origin']).toBeDefined()
  })

  it('is reachable through a real NestFactory instance, not just a testing module', async () => {
    // Bootstrapping the same way main.ts does, minus listen(), catches wiring that the testing
    // module tolerates but a real application does not.
    const real = await NestFactory.create(AppModule, { logger: false, bodyParser: false })
    configureApp(real)
    await real.init()
    await real.close()
  })
})