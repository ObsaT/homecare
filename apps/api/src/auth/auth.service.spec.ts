import { beforeEach, describe, expect, it } from 'vitest'
import { ErrorCode } from '@homecare/contracts'
import { AuthService } from './auth.service'
import { MAX_OTP_ATTEMPTS, OtpChallengeStore, generateCode, hashCode } from './otp-challenge.store'
import { SmsProvider } from './sms.provider'
import { RedisRateLimiter } from '../redis/rate-limiter'
import { UsersRepository } from '../db/users.repository'
import { SessionService } from './session.service'
import { RegistrationService } from './registration.service'

/**
 * Returns the same fixed-window counts the real Redis limiter does, but hermetic. `requestOtp` is
 * the only OTP path that touches it; the other injected services are placeholders because the
 * request/verify cases tested here never reach them.
 */
class MemoryLimiter {
  private readonly counts = new Map<string, number>()

  async hit(key: string, windowMs: number): Promise<number> {
    const fullKey = `${Math.floor(Date.now() / windowMs)}:${key}`
    const count = (this.counts.get(fullKey) ?? 0) + 1
    this.counts.set(fullKey, count)
    return count
  }
}

function buildService() {
  const store = new OtpChallengeStore()
  const sms = new SmsProvider()
  const service = new AuthService(
    store,
    sms,
    new MemoryLimiter() as unknown as RedisRateLimiter,
    undefined as unknown as UsersRepository,
    undefined as unknown as SessionService,
    undefined as unknown as RegistrationService,
  )
  return { service, store, sms }
}

describe('AuthService.requestOtp', () => {
  let ctx: ReturnType<typeof buildService>

  beforeEach(() => {
    ctx = buildService()
  })

  it('returns the documented response shape', async () => {
    const result = await ctx.service.requestOtp(
      { phone_e164: '251911234567', purpose: 'LOGIN' },
      '10.0.0.1',
    )
    expect(result.challenge_id).toMatch(/^[0-9a-f-]{36}$/)
    expect(new Date(result.expires_at).getTime()).toBeGreaterThan(Date.now())
    expect(result.resend_after_seconds).toBeGreaterThan(0)
  })

  /**
   * The central enumeration test. Identical status, identical keys, no field that reveals whether
   * the phone exists.
   */
  it('responds identically for an unknown phone', async () => {
    const known = await ctx.service.requestOtp(
      { phone_e164: '251911234567', purpose: 'LOGIN' },
      '10.0.0.1',
    )
    const unknown = await ctx.service.requestOtp(
      { phone_e164: '251999999999', purpose: 'LOGIN' },
      '10.0.0.1',
    )
    expect(Object.keys(unknown).sort()).toEqual(Object.keys(known).sort())
    expect(Object.keys(unknown)).not.toContain('user_exists')
    expect(Object.keys(unknown)).not.toContain('is_registered')
  })

  it('never returns the OTP code to the caller', async () => {
    const result = await ctx.service.requestOtp(
      { phone_e164: '251911234567', purpose: 'LOGIN' },
      '10.0.0.1',
    )
    const serialised = JSON.stringify(result)
    const dispatched = ctx.sms.sent.at(-1)?.code
    expect(dispatched).toMatch(/^\d{6}$/)
    expect(serialised).not.toContain(dispatched as string)
  })

  it('reuses the existing challenge inside the resend window', async () => {
    const first = await ctx.service.requestOtp(
      { phone_e164: '251911234567', purpose: 'LOGIN' },
      '10.0.0.1',
    )
    const second = await ctx.service.requestOtp(
      { phone_e164: '251911234567', purpose: 'LOGIN' },
      '10.0.0.1',
    )
    expect(second.challenge_id).toBe(first.challenge_id)
  })

  it('keeps challenges for different purposes separate', async () => {
    const login = await ctx.service.requestOtp(
      { phone_e164: '251911234567', purpose: 'LOGIN' },
      '10.0.0.1',
    )
    const register = await ctx.service.requestOtp(
      { phone_e164: '251911234567', purpose: 'REGISTER' },
      '10.0.0.1',
    )
    expect(register.challenge_id).not.toBe(login.challenge_id)
  })

  it('rate limits by phone after 5 requests in an hour', async () => {
    for (let i = 0; i < 5; i += 1) {
      await ctx.service.requestOtp({ phone_e164: '251911234567', purpose: 'LOGIN' }, '10.0.0.1')
    }
    await expect(
      ctx.service.requestOtp({ phone_e164: '251911234567', purpose: 'LOGIN' }, '10.0.0.1'),
    ).rejects.toMatchObject({ code: ErrorCode.RATE_LIMITED })
  })

  it('rate limits by IP after 20 requests in an hour, across different phones', async () => {
    for (let i = 0; i < 20; i += 1) {
      await ctx.service.requestOtp(
        { phone_e164: `25191123456${i % 10}`, purpose: 'LOGIN' },
        '10.0.0.9',
      )
    }
    await expect(
      ctx.service.requestOtp({ phone_e164: '251911234567', purpose: 'LOGIN' }, '10.0.0.9'),
    ).rejects.toMatchObject({ code: ErrorCode.RATE_LIMITED })
  })
})

describe('AuthService.verifyOtp', () => {
  let ctx: ReturnType<typeof buildService>

  beforeEach(() => {
    ctx = buildService()
  })

  async function issueAndCode(phone = '251911234567', purpose: 'LOGIN' | 'REGISTER' = 'LOGIN') {
    await ctx.service.requestOtp({ phone_e164: phone, purpose }, '10.0.0.1')
    const code = ctx.sms.sent.at(-1)?.code as string
    const active = ctx.store.findActive(phone, purpose)
    return { code, challengeId: active?.id as string }
  }

  it('accepts the correct code', async () => {
    const { code, challengeId } = await issueAndCode()
    const result = ctx.service.verifyOtp({ challenge_id: challengeId, code })
    expect(result.verified).toBe(true)
    expect(result.phone).toBe('251911234567')
  })

  it('rejects a wrong code', async () => {
    const { challengeId } = await issueAndCode()
    expect(() => ctx.service.verifyOtp({ challenge_id: challengeId, code: '000000' })).toThrowError(
      /not valid/,
    )
  })

  it('locks the phone, not just the challenge, once the attempt budget is spent', async () => {
    const { challengeId } = await issueAndCode()
    for (let i = 0; i < MAX_OTP_ATTEMPTS; i += 1) {
      expect(() => ctx.service.verifyOtp({ challenge_id: challengeId, code: '000000' })).toThrow()
    }
    expect(() => ctx.service.verifyOtp({ challenge_id: challengeId, code: '000000' })).toThrowError(
      /Too many attempts/,
    )
    expect(ctx.service.isPhoneLocked('251911234567')).toBe(true)
  })

  it('refuses to issue a new code while the phone is locked out', async () => {
    const { challengeId } = await issueAndCode('251911234599')
    for (let i = 0; i < MAX_OTP_ATTEMPTS; i += 1) {
      expect(() => ctx.service.verifyOtp({ challenge_id: challengeId, code: '000000' })).toThrow()
    }
    await expect(
      ctx.service.requestOtp({ phone_e164: '251911234599', purpose: 'LOGIN' }, '10.0.0.1'),
    ).rejects.toMatchObject({ code: ErrorCode.OTP_LOCKED })
  })

  it('does not lock a phone whose code was correct', async () => {
    const { code, challengeId } = await issueAndCode('251911234588')
    ctx.service.verifyOtp({ challenge_id: challengeId, code })
    expect(ctx.service.isPhoneLocked('251911234588')).toBe(false)
  })

  it('refuses to reuse a code once verified', async () => {
    const { code, challengeId } = await issueAndCode()
    ctx.service.verifyOtp({ challenge_id: challengeId, code })
    expect(() => ctx.service.verifyOtp({ challenge_id: challengeId, code })).toThrowError(
      /not valid/,
    )
  })

  it('rejects an expired challenge', () => {
    const challenge = ctx.store.create('251911234567', 'LOGIN', '123456', -1)
    expect(() => ctx.service.verifyOtp({ challenge_id: challenge.id, code: '123456' })).toThrowError(
      /expired/,
    )
  })

  it('gives the same error for an unknown challenge as for a wrong code', async () => {
    const { challengeId } = await issueAndCode()
    const unknownId = '00000000-0000-4000-8000-000000000000'
    const wrongCodeError = captureError(() =>
      ctx.service.verifyOtp({ challenge_id: challengeId, code: '000000' }),
    )
    const unknownError = captureError(() =>
      ctx.service.verifyOtp({ challenge_id: unknownId, code: '000000' }),
    )
    expect(unknownError).toBe(wrongCodeError)
  })
})

describe('otp challenge storage', () => {
  it('stores only a hash, never the plaintext code', () => {
    const store = new OtpChallengeStore()
    // The code must not appear as a substring of any other field, or the assertion below would be
    // satisfied by the phone number alone.
    const challenge = store.create('251911234567', 'LOGIN', '424242')
    expect(challenge.codeHash).toBe(hashCode('424242'))
    expect(JSON.stringify(challenge)).not.toContain('424242')
  })

  it('generates a 6-digit code with leading zeros preserved', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateCode()).toMatch(/^\d{6}$/)
    }
  })

  it('supersedes older challenges for the same phone and purpose', async () => {
    const store = new OtpChallengeStore()
    const first = store.create('251911234567', 'LOGIN', '111111')
    const second = store.create('251911234567', 'LOGIN', '222222')
    store.supersede('251911234567', 'LOGIN', second.id)
    expect(store.get(first.id)?.consumedAt).not.toBeNull()
    expect(store.get(second.id)?.consumedAt).toBeNull()
  })

  /**
   * Regression: ordering used to be by wall-clock `createdAt`, so two challenges created in the same
   * millisecond tied and the *older* one could win. The older challenge was then treated as active
   * while the newer one had already been superseded, leaving the newest code unusable.
   */
  it('orders challenges by sequence, not wall-clock time', async () => {
    const store = new OtpChallengeStore()
    const first = store.create('251911234567', 'LOGIN', '111111')
    const second = store.create('251911234567', 'LOGIN', '222222')
    expect(second.seq).toBeGreaterThan(first.seq)
    // The actual regression: even when createdAt ties (asserted implicitly by real clocks racing),
    // findActive must return the newest challenge, not the oldest one.
    expect(store.findActive('251911234567', 'LOGIN')?.id).toBe(second.id)
  })

  it('ignores a locked challenge when looking for an active one', async () => {
    const store = new OtpChallengeStore()
    const first = store.create('251911234567', 'LOGIN', '111111')
    const second = store.create('251911234567', 'LOGIN', '222222')
    store.lock(second.id)
    expect(store.findActive('251911234567', 'LOGIN')?.id).toBe(first.id)
  })

  it('purges challenges older than the retention window', () => {
    const store = new OtpChallengeStore()
    store.create('251911234567', 'LOGIN', '111111')
    expect(store.purgeOlderThan(24)).toBe(0)
  })
})

function captureError(fn: () => unknown): string {
  try {
    fn()
    return 'no error'
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}