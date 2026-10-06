import { Global, Module } from '@nestjs/common'
import Redis from 'ioredis'
import { getConfig } from '../config'

export const REDIS = 'REDIS'

/** Replaces the in-memory rate-limit buckets: Redis counters survive a restart and are shared across replicas. */
@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: (): Redis => {
        const { redisUrl } = getConfig()
        const prefix = process.env.REDIS_KEY_PREFIX ?? 'homecare:'
        return new Redis(redisUrl, {
          keyPrefix: prefix,
          maxRetriesPerRequest: 2,
          lazyConnect: false,
        })
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule {}