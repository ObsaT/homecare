import { loadEnv } from './src/config'

/**
 * Test-process environment setup, run before every test file.
 *
 * The auth layer hits real Postgres and Redis (integration, not hermetic, by design — that is what
 * makes these tests meaningful). To avoid clobbering the dev database with thousands of test users,
 * every test run points DATABASE_URL at homecare_test and gives Redis a test-only key prefix, then
 * flushes that prefix so repeats of a suite within an hour do not inherit rate-limit counters.
 */

loadEnv()

process.env.NODE_ENV = 'test'
if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST
}
process.env.REDIS_KEY_PREFIX = 'homecare:test:'

async function flushTestKeys(): Promise<void> {
  // Raw client without a prefix: keyPrefix would also decorate the SCAN pattern and match nothing.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { default: Redis } = await import('ioredis')
  const client = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379')
  try {
    let cursor = '0'
    do {
      const [next, keys] = await client.scan(cursor, 'MATCH', 'homecare:test:*', 'COUNT', 500)
      cursor = next
      for (const key of keys) {
        await client.del(key)
      }
    } while (cursor !== '0')
  } finally {
    await client.quit()
  }
}

await flushTestKeys()