import { Global, Module } from '@nestjs/common'
import Redis from 'ioredis'
import { getConfig } from '../config'

export const REDIS = 'REDIS'

class InMemoryRedisFallback {
  private readonly store = new Map<string, { value: string; expiresAt?: number }>()

  private cleanExpired(key: string) {
    const entry = this.store.get(key)
    if (entry?.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key)
    }
  }

  async set(key: string, value: string, mode?: string, ttlSeconds?: number): Promise<'OK'> {
    const expiresAt = mode === 'EX' && ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined
    this.store.set(key, { value, expiresAt })
    return 'OK'
  }

  async get(key: string): Promise<string | null> {
    this.cleanExpired(key)
    return this.store.get(key)?.value ?? null
  }

  async getdel(key: string): Promise<string | null> {
    this.cleanExpired(key)
    const val = this.store.get(key)?.value ?? null
    this.store.delete(key)
    return val
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0
    for (const k of keys) {
      if (this.store.delete(k)) count++
    }
    return count
  }

  async incr(key: string): Promise<number> {
    this.cleanExpired(key)
    const current = Number(this.store.get(key)?.value ?? 0)
    const next = current + 1
    const existing = this.store.get(key)
    this.store.set(key, { value: String(next), expiresAt: existing?.expiresAt })
    return next
  }

  async pexpire(key: string, ms: number): Promise<number> {
    const existing = this.store.get(key)
    if (!existing) return 0
    existing.expiresAt = Date.now() + ms
    return 1
  }

  async quit(): Promise<'OK'> {
    return 'OK'
  }
}

/** Replaces the in-memory rate-limit buckets: Redis counters survive a restart and are shared across replicas. */
@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: (): Redis => {
        const { redisUrl } = getConfig()
        if (!redisUrl || redisUrl === 'memory' || redisUrl === 'none') {
          return new InMemoryRedisFallback() as unknown as Redis
        }
        const prefix = process.env.REDIS_KEY_PREFIX ?? 'homecare:'
        const client = new Redis(redisUrl, {
          keyPrefix: prefix,
          maxRetriesPerRequest: 2,
          lazyConnect: true,
          retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
        })
        const fallback = new InMemoryRedisFallback()
        let useFallback = false
        client.on('error', () => {
          useFallback = true
        })

        return new Proxy(client, {
          get(target, prop, receiver) {
            if (useFallback && prop in fallback) {
              return Reflect.get(fallback, prop, fallback)
            }
            return Reflect.get(target, prop, receiver)
          },
        })
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule {}