import { Inject, Injectable } from '@nestjs/common'
import type Redis from 'ioredis'
import { REDIS } from './redis.module'

export const OTP_PHONE_WINDOW_MS = 3_600_000
export const OTP_IP_WINDOW_MS = 3_600_000
export const OTP_PHONE_LIMIT = 5
export const OTP_IP_LIMIT = 20

/**
 * Fixed-window counters for the OTP request limits, backed by Redis so they survive restarts and
 * agree across replicas (docs/13-infrastructure.md § 2; the in-memory Map version was a stub).
 *
 * The window key carries the window's epoch: two requests in different windows hit different keys,
 * which keeps INCR atomic without a sliding-window library.
 */
@Injectable()
export class RedisRateLimiter {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  /**
   * Returns the count of hits in this window. Caller decides to throw when it exceeds the limit, so
   * the limiter stays agnostic to which error code the endpoint wants.
   */
  async hit(key: string, windowMs: number): Promise<number> {
    const window = Math.floor(Date.now() / windowMs)
    const fullKey = `rl:${window}:${key}`
    const count = await this.redis.incr(fullKey)
    if (count === 1) {
      await this.redis.pexpire(fullKey, windowMs)
    }
    return count
  }
}