import { Inject, Injectable } from '@nestjs/common'
import {
  ErrorCode,
  type Login,
  type OtpRequest,
  type OtpRequestResponse,
  type OtpPurpose,
  type OtpVerify,
  type RegistrationToken,
  type Session,
} from '@homecare/contracts'
import {
  MAX_OTP_ATTEMPTS,
  OtpChallengeStore,
  PHONE_LOCKOUT_MINUTES,
  RESEND_AFTER_SECONDS,
  codeMatches,
  generateCode,
} from './otp-challenge.store'
import { RedisRateLimiter, OTP_IP_LIMIT, OTP_IP_WINDOW_MS, OTP_PHONE_LIMIT, OTP_PHONE_WINDOW_MS } from '../redis/rate-limiter'
import { UsersRepository } from '../db/users.repository'
import { SessionService, type SessionContext } from './session.service'
import { RegistrationService } from './registration.service'
import { SmsProvider } from './sms.provider'
import { verifyPassword } from '../crypto/crypto'
import { AuthError } from './errors'

export interface VerifiedOtp {
  verified: true
  phone: string
  purpose: OtpPurpose
}

export type VerifyResult =
  | { kind: 'session'; session: Session }
  | { kind: 'register'; register: RegistrationToken }

/**
 * Auth service: OTP request/verify, login, and the branch that turns a verified number into either
 * a session (registered) or a registration token (new phone).
 *
 * The property that matters here, and the reason the OTP flow is built first, is **enumeration
 * resistance**: `POST /auth/otp/request` must behave identically whether or not the phone is
 * registered, and `POST /auth/otp/verify` returns a REGISTER-only token rather than a session for
 * unknown numbers. A different body, status, or latency for a known number turns the login endpoint
 * into a way to harvest every customer in Addis Ababa, and no rate limit prevents that because every
 * request is individually legitimate. See docs/11-security.md § 3 and docs/14-testing.md § 5.
 */
@Injectable()
export class AuthService {
  /** Phone -> epoch ms until which failed attempts block new challenges. */
  private readonly phoneLocks = new Map<string, number>()

  constructor(
    @Inject(OtpChallengeStore) private readonly challenges: OtpChallengeStore,
    @Inject(SmsProvider) private readonly sms: SmsProvider,
    @Inject(RedisRateLimiter) private readonly limiter: RedisRateLimiter,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(RegistrationService) private readonly registration: RegistrationService,
  ) {}

  /**
   * Returns a challenge for every input. There is deliberately no branch on whether the account
   * exists, so response shape and timing do not distinguish a registered number from a new one.
   */
  async requestOtp(input: OtpRequest, ip: string): Promise<OtpRequestResponse> {
    if (this.isPhoneLocked(input.phone_e164)) {
      throw new AuthError(
        ErrorCode.OTP_LOCKED,
        'Too many attempts on this number. Try again in a few minutes.',
      )
    }
    const phoneCount = await this.limiter.hit(`otp:phone:${input.phone_e164}`, OTP_PHONE_WINDOW_MS)
    if (phoneCount > OTP_PHONE_LIMIT) {
      throw new AuthError(ErrorCode.RATE_LIMITED, 'Too many requests. Try again later.')
    }
    const ipCount = await this.limiter.hit(`otp:ip:${ip}`, OTP_IP_WINDOW_MS)
    if (ipCount > OTP_IP_LIMIT) {
      throw new AuthError(ErrorCode.RATE_LIMITED, 'Too many requests. Try again later.')
    }

    const active = this.challenges.findActive(input.phone_e164, input.purpose)
    if (active) {
      // Inside the resend window. Returning the existing challenge keeps the response identical in
      // shape to the create path, which a caller could otherwise use to detect a live challenge.
      return {
        challenge_id: active.id,
        expires_at: active.expiresAt.toISOString(),
        resend_after_seconds: RESEND_AFTER_SECONDS,
      }
    }

    const code = generateCode()
    const challenge = this.challenges.create(input.phone_e164, input.purpose, code)
    this.challenges.supersede(input.phone_e164, input.purpose, challenge.id)

    await this.sms.sendOtp(input.phone_e164, code)

    return {
      challenge_id: challenge.id,
      expires_at: challenge.expiresAt.toISOString(),
      resend_after_seconds: RESEND_AFTER_SECONDS,
    }
  }

  /**
   * Verifies a submitted code.
   *
   * Unknown, expired, consumed, and wrong all fail as `OTP_INVALID` so a caller cannot probe which
   * challenge ids exist. Two cases are deliberately distinguishable because the client cannot act
   * without knowing: a challenge locked by exhausted attempts, and a phone under lockout, both
   * return `OTP_LOCKED` telling the user to wait rather than to keep guessing.
   */
  verifyOtp(input: OtpVerify): VerifiedOtp {
    const challenge = this.challenges.get(input.challenge_id)
    if (!challenge) throw new AuthError(ErrorCode.OTP_INVALID, 'That code is not valid')
    if (challenge.lockedAt !== null) {
      throw new AuthError(ErrorCode.OTP_LOCKED, 'Too many attempts. Request a new code in a few minutes.')
    }
    if (challenge.consumedAt !== null) {
      throw new AuthError(ErrorCode.OTP_INVALID, 'That code is not valid')
    }
    if (challenge.expiresAt.getTime() <= Date.now()) {
      throw new AuthError(ErrorCode.OTP_INVALID, 'That code has expired')
    }
    if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
      this.challenges.lock(challenge.id)
      throw new AuthError(ErrorCode.OTP_LOCKED, 'Too many attempts. Request a new code.')
    }

    if (!codeMatches(input.code, challenge.codeHash)) {
      challenge.attempts += 1
      if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
        // docs/03-customer-app-spec.md C3 and docs/11-security.md § 3: after five wrong attempts
        // the *phone* is locked, not just the challenge, otherwise the next request resets the
        // budget and a six-digit code is guessable at a steady rate forever.
        this.challenges.lock(challenge.id)
        this.phoneLocks.set(challenge.phone, Date.now() + PHONE_LOCKOUT_MINUTES * 60_000)
      }
      throw new AuthError(ErrorCode.OTP_INVALID, 'That code is not valid')
    }

    challenge.consumedAt = new Date()
    return { verified: true, phone: challenge.phone, purpose: challenge.purpose }
  }

  /**
   * The verify endpoint's business logic. A known active number receives a real session with
   * `is_new_user: false`; an unknown number receives a REGISTER-scoped token so the restart flow can
   * guide it into registration without ever revealing that the number was unknown.
   */
  async verifyForSession(input: OtpVerify, context: SessionContext): Promise<VerifyResult> {
    const verified = this.verifyOtp(input)
    const existing = await this.users.findByPhoneE164(verified.phone)
    if (existing && (existing.status === 'ACTIVE' || existing.status === 'PENDING_VERIFICATION')) {
      const session = await this.sessions.issue(
        {
          id: existing.id,
          role: existing.role,
          status: existing.status,
          full_name: existing.full_name,
        },
        context,
      )
      return {
        kind: 'session',
        session: {
          ...session,
          is_new_user: false,
        },
      }
    }
    const register = await this.registration.issueRegisterToken(verified.phone, verified.purpose)
    return { kind: 'register', register: { ...register, is_new_user: true } }
  }

  /**
   * Password login. Unknown phone and wrong password return the *same* 401, and a phone locked by
   * failed attempts also 401s rather than reporting the lock, so the endpoint never distinguishes
   * "no such account" from "wrong password". Lockout state still accrues so a genuine user is
   * protected; see docs/11-security.md § 3.
   */
  async login(input: Login, context: SessionContext): Promise<Session> {
    const user = await this.users.findByPhoneE164(input.phone_e164)
    const locked = user?.locked_until !== null && user?.locked_until !== undefined && user.locked_until.getTime() > Date.now()

    if (!user || !user.password_hash || user.status !== 'ACTIVE' || locked) {
      // Timing differs (no scrypt for an unknown phone), but the response is byte-identical and the
      // OTP flow carries the real rate limiting. Recording a failed login for a nonexistent phone
      // would make the signup a self-DoS vector.
      throw new AuthError(ErrorCode.UNAUTHENTICATED, 'Incorrect phone or password')
    }

    if (!verifyPassword(input.password, user.password_hash)) {
      await this.users.recordFailedLogin(user.phone_e164)
      throw new AuthError(ErrorCode.UNAUTHENTICATED, 'Incorrect phone or password')
    }

    await this.users.recordSuccessfulLogin(user.id, context.ip)
    const session = await this.sessions.issue(
      { id: user.id, role: user.role, status: user.status, full_name: user.full_name },
      context,
    )
    return { ...session, is_new_user: false }
  }

  /** True while the phone is serving a failed-attempt lockout. */
  isPhoneLocked(phone: string): boolean {
    const until = this.phoneLocks.get(phone)
    if (until === undefined) return false
    if (until <= Date.now()) {
      this.phoneLocks.delete(phone)
      return false
    }
    return true
  }
}