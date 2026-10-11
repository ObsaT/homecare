import { Inject, Injectable } from '@nestjs/common'
import { Pool, type PoolClient } from 'pg'
import { PG_POOL } from './db.module'

export interface UserRow {
  id: string
  role: string
  status: string
  phone: string
  phone_e164: string
  phone_verified_at: Date | null
  email: string | null
  password_hash: string | null
  full_name: string
  preferred_language: string
  locked_until: Date | null
  created_at: Date
}

export interface SessionUser {
  id: string
  role: string
  status: string
  full_name: string
}

const USER_COLUMNS = `
  id, role, status, phone, phone_e164, phone_verified_at, email,
  password_hash, full_name, preferred_language, locked_until, created_at
`

function toUserRow(row: UserRow): UserRow {
  return row
}

export function normalizeEthiopianPhoneE164(raw: string): string {
  const digitsOnly = (raw || '').replace(/\D/g, '')
  if (!digitsOnly) return ''
  // Strip leading 251 country code if present, then strip leading 0
  let subscriber = digitsOnly
  if (subscriber.startsWith('251') && subscriber.length >= 12) {
    subscriber = subscriber.slice(3)
  }
  while (subscriber.startsWith('0') && subscriber.length > 9) {
    subscriber = subscriber.slice(1)
  }
  if (subscriber.startsWith('0') && subscriber.length === 10) {
    subscriber = subscriber.slice(1)
  }
  return `+251${subscriber}`
}

/**
 * The only place that reads and writes auth.users. Kept pen-and-paper SQL on purpose: the query
 * text is short, the schema is stable, and every access here is one of five shapes that an ORM
 * would hide rather than clarify.
 */
@Injectable()
export class UsersRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findByPhoneE164(phoneE164: string): Promise<UserRow | null> {
    const normalized = normalizeEthiopianPhoneE164(phoneE164) || phoneE164.trim()
    const withPlus = normalized.startsWith('+') ? normalized : `+${normalized}`
    const withoutPlus = withPlus.replace(/^\+/, '')
    const digitsOnly = withPlus.replace(/\D/g, '')
    const last9 = digitsOnly.length >= 9 ? digitsOnly.slice(-9) : ''

    const { rows } = await this.pool.query<UserRow>(
      `select ${USER_COLUMNS} from auth.users
       where (
         phone_e164 = $1
         or phone_e164 = $2
         or phone = $1
         or phone = $2
         or ($3 <> '' and right(regexp_replace(phone_e164, '\\D', '', 'g'), 9) = $3)
         or ($3 <> '' and right(regexp_replace(phone, '\\D', '', 'g'), 9) = $3)
       )
         and deleted_at is null
       order by created_at desc
       limit 1`,
      [withPlus, withoutPlus, last9],
    )
    return rows[0] ? toUserRow(rows[0]) : null
  }

  async findById(id: string): Promise<UserRow | null> {
    const { rows } = await this.pool.query<UserRow>(
      `select ${USER_COLUMNS} from auth.users where id = $1 and deleted_at is null`,
      [id],
    )
    return rows[0] ? toUserRow(rows[0]) : null
  }

  /** Active (or phone-verified-pending) accounts only — a suspended user must not issue sessions. */
  async findSessionUser(id: string): Promise<SessionUser | null> {
    const { rows } = await this.pool.query<SessionUser>(
      `select id, role, status, full_name from auth.users
       where id = $1 and deleted_at is null and status in ('ACTIVE','PENDING_VERIFICATION')`,
      [id],
    )
    return rows[0] ?? null
  }

  /** Inserts a customer after OTP verification within an in-flight transaction. */
  async insert(
    client: PoolClient,
    input: {
      role: string
      phone: string
      phoneE164: string
      fullName: string
      email?: string
      passwordHash?: string
      preferredLanguage: string
    },
  ): Promise<{ id: string }> {
    const { rows } = await client.query<{ id: string }>(
      `insert into auth.users
         (role, status, phone, phone_e164, phone_verified_at, email, password_hash, full_name, preferred_language)
       values ($1, 'ACTIVE', $2, $3, now(), $4, $5, $6, $7)
       returning id`,
      [
        input.role,
        input.phone,
        input.phoneE164,
        input.email ?? null,
        input.passwordHash ?? null,
        input.fullName,
        input.preferredLanguage,
      ],
    )
    return rows[0] as { id: string }
  }

  async recordFailedLogin(phoneE164: string): Promise<void> {
    await this.pool.query(
      `update auth.users set
         failed_login_count = failed_login_count + 1,
         locked_until = case when failed_login_count + 1 >= 5 then now() + interval '15 minutes' else locked_until end
       where phone_e164 = $1`,
      [phoneE164],
    )
  }

  async recordSuccessfulLogin(id: string, ip: string | null): Promise<void> {
    await this.pool.query(
      `update auth.users set failed_login_count = 0, locked_until = null, last_login_at = now(), last_login_ip = $2 where id = $1`,
      [id, ip],
    )
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.pool.query(
      `update auth.users
       set password_hash = $2,
           failed_login_count = 0,
           locked_until = null,
           updated_at = now()
       where id = $1 and deleted_at is null`,
      [id, passwordHash],
    )
  }
}