import { Inject, Injectable } from '@nestjs/common'
import { Pool } from 'pg'
import { PG_POOL } from './db.module'

export interface SessionRow {
  id: string
  user_id: string
  refresh_hash: string
  family_id: string
  issued_at: Date
  expires_at: Date
  rotated_at: Date | null
  revoked_at: Date | null
  revoked_reason: string | null
}

export const SESSION_REVOKE = {
  ROTATED: 'ROTATED',
  LOGOUT: 'LOGOUT',
  LOGOUT_ALL: 'LOGOUT_ALL',
  REUSE_DETECTED: 'REUSE_DETECTED',
} as const

const SESSION_COLUMNS = `
  id, user_id, refresh_hash, family_id, issued_at, expires_at,
  rotated_at, revoked_at, revoked_reason
`

/**
 * Session rows under auth.sessions, implementing the refresh-token rotation policy from
 * docs/07-api-contract.md and docs/11-security.md:
 *
 *   - A row keeps the same refresh_hash forever; rotation closes the row (rotated_at set, hash
 *     retained) and opens a new row in the same family. Keeping the hash is what lets reuse of an
 *     old token be detected: the token is still findable, but no longer active.
 *   - Presenting a hash whose row has rotated_at set == reuse == kill the whole family.
 *   - Presenting a revoked (logged-out) hash is a plain 401, not reuse detection.
 */
@Injectable()
export class SessionsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findByRefreshHash(refreshHash: string): Promise<SessionRow | null> {
    const { rows } = await this.pool.query<SessionRow>(
      `select ${SESSION_COLUMNS} from auth.sessions where refresh_hash = $1`,
      [refreshHash],
    )
    return rows[0] ?? null
  }

  async insert(input: {
    userId: string
    refreshHash: string
    familyId: string
    expiresAt: Date
    userAgent: string | null
    ip: string | null
  }): Promise<SessionRow> {
    const { rows } = await this.pool.query<SessionRow>(
      `insert into auth.sessions (user_id, refresh_hash, family_id, expires_at, user_agent, ip)
       values ($1, $2, $3, $4, $5, $6)
       returning ${SESSION_COLUMNS}`,
      [input.userId, input.refreshHash, input.familyId, input.expiresAt, input.userAgent, input.ip],
    )
    return rows[0] as SessionRow
  }

  /** Closes a rotated row while keeping its hash for reuse detection. */
  async markRotated(id: string): Promise<void> {
    await this.pool.query(
      `update auth.sessions set rotated_at = now() where id = $1 and rotated_at is null`,
      [id],
    )
  }

  async revoke(id: string, reason: string): Promise<void> {
    await this.pool.query(
      `update auth.sessions set revoked_at = coalesce(revoked_at, now()), revoked_reason = $2 where id = $1`,
      [id, reason],
    )
  }

  /** Family kill used by reuse detection and by logout-all. */
  async revokeFamily(familyId: string, reason: string): Promise<void> {
    await this.pool.query(
      `update auth.sessions set revoked_at = coalesce(revoked_at, now()), revoked_reason = $2 where family_id = $1`,
      [familyId, reason],
    )
  }

  async revokeUserSessions(userId: string, reason: string): Promise<void> {
    await this.pool.query(
      `update auth.sessions set revoked_at = coalesce(revoked_at, now()), revoked_reason = $2
       where user_id = $1 and revoked_at is null`,
      [userId, reason],
    )
  }

  /** Cleanup helper used by tests and, later, the purge job. */
  async deleteAllForUser(userId: string): Promise<void> {
    await this.pool.query('delete from auth.sessions where user_id = $1', [userId])
  }
}