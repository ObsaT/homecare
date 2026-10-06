import { Inject, Injectable } from '@nestjs/common'
import {
  ErrorCode,
  OtpPurpose,
  UserRole,
  addressGeoPrecision,
  type RegisterCustomer,
  type Session,
} from '@homecare/contracts'
import type Redis from 'ioredis'
import { Pool, type PoolClient } from 'pg'
import { PG_POOL, withTransaction } from '../db/db.module'
import { UsersRepository } from '../db/users.repository'
import { REDIS } from '../redis/redis.module'
import { hashPassword, randomOpaqueToken, sha256Hex } from '../crypto/crypto'
import { SessionService, type SessionContext } from './session.service'
import { AuthError } from './errors'

/** Register tokens are short-lived by design: the OTP has already proven the phone. */
export const REGISTER_TOKEN_TTL_SECONDS = 300

interface RegisterPayload {
  phoneE164: string
  purpose: string
}

/**
 * Registration-token lifecycle: issued after a verified OTP on an unregistered phone, stored only as
 * a sha256, redeemed exactly once inside the customer-registration transaction (docs/07-api-contract
 * .md § POST /auth/otp/verify and § POST /auth/register/customer).
 */
@Injectable()
export class RegistrationService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  async issueRegisterToken(
    phoneE164: string,
    purpose: string,
  ): Promise<{ register_token: string; expires_in: number }> {
    const token = randomOpaqueToken()
    const payload: RegisterPayload = { phoneE164, purpose }
    await this.redis.set(this.key(token), JSON.stringify(payload), 'EX', REGISTER_TOKEN_TTL_SECONDS)
    return { register_token: token, expires_in: REGISTER_TOKEN_TTL_SECONDS }
  }

  async registerCustomer(
    input: RegisterCustomer,
    context: SessionContext,
  ): Promise<Session & { is_new_user: true }> {
    const payload = await this.consumeRegisterToken(input.register_token)

    const subCity = await this.pool.query<{ id: string }>(
      'select id from catalog.sub_cities where id = $1 and is_active',
      [input.address.sub_city_id],
    )
    if (subCity.rows.length === 0) {
      throw new AuthError(ErrorCode.VALIDATION_ERROR, 'Unknown or inactive sub_city_id')
    }

    const userId = await withTransaction(this.pool, async (client) => {
      const { id } = await this.users.insert(client, {
        role: UserRole.CUSTOMER,
        phone: payload.phoneE164,
        phoneE164: payload.phoneE164,
        fullName: input.full_name,
        email: input.email,
        passwordHash: hashPassword(input.password),
        preferredLanguage: input.preferred_language,
      })

      for (const consent of input.consents) {
        await client.query(
          `insert into auth.consents
             (user_id, consent_type, version, granted, granted_at, ip)
           values ($1, $2, $3, $4, case when $4 then now() else null end, $5)`,
          [id, consent.type, consent.version, consent.granted, context.ip],
        )
      }
      await this.insertAddress(client, id, input, context)
      await client.query(
        `insert into core.emergency_contacts
           (customer_user_id, full_name, phone, relationship, is_primary)
         values ($1, $2, $3, $4, true)`,
        [id, input.emergency_contact.full_name, input.emergency_contact.phone_e164, input.emergency_contact.relationship],
      )
      return id
    })

    const session = await this.sessions.issue(
      { id: userId, role: UserRole.CUSTOMER, status: 'ACTIVE', full_name: input.full_name },
      context,
    )
    return {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      user: session.user,
      is_new_user: true,
    }
  }

  private key(token: string): string {
    return `auth:register:${sha256Hex(token)}`
  }

  /**
   * Redeems the register token at most once. GETDEL removes the key in the same step it reads it,
   * so a race between two requests cannot redeem the same token twice.
   */
  private async consumeRegisterToken(token: string): Promise<RegisterPayload> {
    const raw = await this.redis.getdel(this.key(token))
    if (!raw) throw new AuthError(ErrorCode.UNAUTHENTICATED, 'This registration link has expired')
    let payload: RegisterPayload
    try {
      payload = JSON.parse(raw) as RegisterPayload
    } catch {
      throw new AuthError(ErrorCode.UNAUTHENTICATED, 'This registration link is invalid')
    }
    if (payload.purpose !== OtpPurpose.REGISTER && payload.purpose !== OtpPurpose.LOGIN) {
      throw new AuthError(ErrorCode.UNAUTHENTICATED, 'This registration link is invalid')
    }
    if (!payload.phoneE164?.startsWith('+251')) {
      throw new AuthError(ErrorCode.UNAUTHENTICATED, 'This registration link is invalid')
    }
    return payload
  }

  private async insertAddress(
    client: PoolClient,
    userId: string,
    input: RegisterCustomer,
    _context: SessionContext,
  ): Promise<void> {
    const precision = addressGeoPrecision(input.address)
    await client.query(
      `insert into core.addresses
         (owner_user_id, label, sub_city_id, woreda, kebele, house_number, landmark,
          latitude, longitude, geo_precision, is_default)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)`,
      [
        userId,
        input.address.label,
        input.address.sub_city_id,
        input.address.woreda,
        input.address.kebele,
        input.address.house_number,
        input.address.landmark ?? '',
        input.address.latitude ?? null,
        input.address.longitude ?? null,
        precision,
      ],
    )
  }
}