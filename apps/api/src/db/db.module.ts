import { Global, Module } from '@nestjs/common'
import { Pool, type PoolClient } from 'pg'
import { getConfig } from '../config'

export const PG_POOL = 'PG_POOL'

export function createPool(connectionString: string): Pool {
  const isLocal =
    connectionString.includes('127.0.0.1') ||
    connectionString.includes('localhost') ||
    connectionString.includes('@postgres:')
  const useSsl =
    !isLocal &&
    (process.env.PGSSLMODE === 'require' ||
      connectionString.includes('sslmode=') ||
      process.env.NODE_ENV === 'production')

  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  })
  // Fail fast on configuration mistakes instead of surfacing them as request-time timeouts.
  pool.on('error', (error) => {
    // eslint-disable-next-line no-console
    console.error('pg pool error', error)
  })
  return pool
}

/**
 * Owns the Postgres connection pool. Global so any module can inject the pool token directly,
 * matching how Nest wires cross-cutting infrastructure.
 */
@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: (): Pool => createPool(getConfig().databaseUrl),
    },
  ],
  exports: [PG_POOL],
})
export class DbModule {}

/** Runs `fn` inside a transaction; used by registration, which writes several rows atomically. */
export async function withTransaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('begin')
    const result = await fn(client)
    await client.query('commit')
    return result
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

/** Wipes the auth/core tables. Tests only. */
export async function truncateAuthCore(pool: Pool): Promise<void> {
  await pool.query(
    'truncate auth.sessions, auth.consents, auth.otp_challenges, core.addresses, core.emergency_contacts, auth.users restart identity cascade',
  )
}

export function errCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null) {
    return (error as { code?: string }).code
  }
  return undefined
}