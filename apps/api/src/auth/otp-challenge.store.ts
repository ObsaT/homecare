import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { type OtpPurpose } from '@homecare/contracts'

/**
 * In-memory OTP challenge store.
 *
 * STUB. This exists so the auth flow can be built and tested before Postgres is provisioned. It is
 * not a security control and must be replaced before any real deployment: challenges are not
 * persisted, do not survive a restart, and are not shared across API replicas.
 *
 * The shape mirrors `auth.otp_challenges` in docs/06-data-model.md § 2 so the swap is a small change.
 */
export interface OtpChallenge {
  id: string
  phone: string
  purpose: OtpPurpose
  /** SHA-256 of the code. The code itself is never stored, per docs/11-security.md § 3. */
  codeHash: string
  attempts: number
  consumedAt: Date | null
  /** Set when the attempt budget is exhausted. Distinct from `consumedAt` so the client can be told to wait rather than that the code was wrong. */
  lockedAt: Date | null
  /** Monotonic creation order. Wall-clock timestamps are not safe to order by: two challenges created in the same millisecond would tie. */
  seq: number
  createdAt: Date
  expiresAt: Date
}

export const MAX_OTP_ATTEMPTS = 5
export const OTP_TTL_MINUTES = 10
export const RESEND_AFTER_SECONDS = 45
export const PHONE_LOCKOUT_MINUTES = 15

@Injectable()
export class OtpChallengeStore {
  private readonly byId = new Map<string, OtpChallenge>()
  private seq = 0

  /** Most recent unconsumed, unlocked challenge for a phone and purpose. */
  findActive(phone: string, purpose: OtpPurpose): OtpChallenge | undefined {
    const now = Date.now()
    let latest: OtpChallenge | undefined
    for (const challenge of this.byId.values()) {
      if (challenge.phone !== phone || challenge.purpose !== purpose) continue
      if (challenge.consumedAt !== null || challenge.lockedAt !== null) continue
      if (challenge.expiresAt.getTime() <= now) continue
      if (!latest || challenge.seq > latest.seq) latest = challenge
    }
    return latest
  }

  /**
   * Persists a challenge for an already-generated code.
   *
   * The caller generates the code and keeps the only reference to it, so the plaintext exists in
   * memory just long enough to reach the SMS provider and is never stored or logged.
   */
  create(phone: string, purpose: OtpPurpose, code: string, ttlMinutes = OTP_TTL_MINUTES): OtpChallenge {
    const now = new Date()
    this.seq += 1
    const challenge: OtpChallenge = {
      id: randomUUID(),
      phone,
      purpose,
      codeHash: hashCode(code),
      attempts: 0,
      consumedAt: null,
      lockedAt: null,
      seq: this.seq,
      createdAt: now,
      expiresAt: new Date(now.getTime() + ttlMinutes * 60_000),
    }
    this.byId.set(challenge.id, challenge)
    return challenge
  }

  get(id: string): OtpChallenge | undefined {
    return this.byId.get(id)
  }

  /** Marks a challenge as unusable after its attempt budget is spent. */
  lock(id: string): void {
    const challenge = this.byId.get(id)
    if (!challenge) return
    challenge.lockedAt = new Date()
    challenge.consumedAt = challenge.consumedAt ?? challenge.lockedAt
  }

  /** Invalidates any other outstanding challenge for this phone and purpose. */
  supersede(phone: string, purpose: OtpPurpose, keepId: string): void {
    for (const challenge of this.byId.values()) {
      if (challenge.id === keepId) continue
      if (challenge.phone !== phone || challenge.purpose !== purpose) continue
      challenge.consumedAt = challenge.consumedAt ?? new Date()
    }
  }

  /** Invalidates every outstanding challenge for a phone, across purposes. */
  lockoutPhone(phone: string): void {
    for (const challenge of this.byId.values()) {
      if (challenge.phone !== phone) continue
      challenge.lockedAt = challenge.lockedAt ?? new Date()
      challenge.consumedAt = challenge.consumedAt ?? challenge.lockedAt
    }
  }

  purgeOlderThan(hours: number): number {
    const cutoff = Date.now() - hours * 3_600_000
    let removed = 0
    for (const [id, challenge] of this.byId) {
      if (challenge.createdAt.getTime() < cutoff) {
        this.byId.delete(id)
        removed++
      }
    }
    return removed
  }
}

export function generateCode(): string {
  // randomInt is uniform and unbiased; Math.random is not acceptable for an auth credential.
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export function hashCode(code: string): string {
  // The real implementation uses HMAC-SHA256 with a server-side pepper held in KMS
  // (docs/11-security.md § 3). Plain SHA-256 here stands in for a secret that does not exist yet;
  // an unkeyed hash of a 6-digit code is brute-forceable, so the pepper is not optional when this
  // is implemented properly.
  return createHash('sha256').update(code).digest('hex')
}

/**
 * Constant-time comparison of a submitted code against a stored hash.
 *
 * A naive `===` leaks the answer through response timing, which is exactly the class of bug that
 * turns a 6-digit space into fewer than a million attempts.
 */
export function codeMatches(submitted: string, storedHash: string): boolean {
  const submittedHash = hashCode(submitted)
  const a = Buffer.from(submittedHash, 'utf8')
  const b = Buffer.from(storedHash, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}