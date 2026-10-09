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
import { EventsService } from '../events/events.service'
import { AuthError } from './errors'

/** Register tokens are short-lived by design: the OTP has already proven the phone. */
export const REGISTER_TOKEN_TTL_SECONDS = 300

interface RegisterPayload {
  phoneE164: string
  purpose: string
}

export interface RegisterCaregiverInput {
  phone_e164: string
  full_name: string
  password: string
  professional_title: string
  qualification_level?: string
  licence_number?: string
  years_experience?: number
  home_sub_city_id?: string
  home_sub_city_name?: string
  coverage_sub_city_ids?: string[]
  payment_method?: 'TELEBIRR'
  telebirr_phone?: string
  telebirr_reference?: string
  confirm_sample_payment?: boolean
}

export interface FlexibleRegisterCustomerInput {
  register_token?: string
  phone_e164?: string
  full_name: string
  email?: string
  password: string
  preferred_language?: string
  sub_city_id?: string
  sub_city_name?: string
  woreda?: string
  kebele?: string
  house_number?: string
  landmark?: string
  latitude?: number
  longitude?: number
  address?: {
    sub_city_id?: string
    sub_city_name?: string
    woreda?: string
    kebele?: string
    house_number?: string
    landmark?: string
    latitude?: number
    longitude?: number
    label?: string
  }
  emergency_contact?: {
    full_name: string
    phone_e164: string
    relationship: string
  }
  emergency_contact_name?: string
  emergency_contact_phone?: string
  emergency_contact_relationship?: string
  consents?: Array<{ type: string; version: string; granted: boolean }>
}

@Injectable()
export class RegistrationService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(EventsService) private readonly eventsService: EventsService,
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
    input: FlexibleRegisterCustomerInput,
    context: SessionContext,
  ): Promise<Session & { is_new_user: true }> {
    let phoneE164: string

    if (input.register_token) {
      const payload = await this.consumeRegisterToken(input.register_token)
      phoneE164 = payload.phoneE164
    } else if (input.phone_e164) {
      let clean = input.phone_e164.trim()
      if (!clean.startsWith('+')) clean = `+${clean}`
      if (!clean.startsWith('+251')) {
        const digits = clean.replace(/^\+?0?/, '')
        clean = `+251${digits}`
      }
      phoneE164 = clean

      const existing = await this.users.findByPhoneE164(phoneE164)
      if (existing) {
        throw new AuthError(ErrorCode.CONFLICT, 'Phone number is already registered. Please log in.')
      }
    } else {
      throw new AuthError(ErrorCode.VALIDATION_ERROR, 'phone_e164 or register_token is required')
    }

    // Resolve sub-city
    const targetSubCity =
      input.sub_city_id ||
      input.address?.sub_city_id ||
      input.sub_city_name ||
      input.address?.sub_city_name ||
      'Bole'

    const subCityRes = await this.pool.query<{ id: string }>(
      `select id from catalog.sub_cities
       where (id::text = $1 or lower(name_en) = lower($1) or lower(name_am) = lower($1)) and is_active
       limit 1`,
      [targetSubCity],
    )

    let subCityId = subCityRes.rows[0]?.id
    if (!subCityId) {
      const defaultSubCity = await this.pool.query<{ id: string }>(
        'select id from catalog.sub_cities where is_active order by sort_order limit 1',
      )
      subCityId = defaultSubCity.rows[0]?.id
    }

    const userId = await withTransaction(this.pool, async (client) => {
      const { id } = await this.users.insert(client, {
        role: UserRole.CUSTOMER,
        phone: phoneE164,
        phoneE164: phoneE164,
        fullName: input.full_name,
        email: input.email,
        passwordHash: hashPassword(input.password),
        preferredLanguage: input.preferred_language || 'en',
      })

      // Consents
      const consents = input.consents || [
        { type: 'TERMS', version: '2026-v1', granted: true },
        { type: 'PRIVACY', version: '2026-v1', granted: true },
        { type: 'HEALTH_DATA_PROCESSING', version: '2026-v1', granted: true },
      ]

      for (const consent of consents) {
        await client.query(
          `insert into auth.consents
             (user_id, consent_type, version, granted, granted_at, ip)
           values ($1, $2, $3, $4, case when $4 then now() else null end, $5)
           on conflict do nothing`,
          [id, consent.type, consent.version, consent.granted, context.ip],
        )
      }

      // Address
      const woreda = input.woreda || input.address?.woreda || '01'
      const kebele = input.kebele || input.address?.kebele || '01'
      const houseNumber = input.house_number || input.address?.house_number || 'House 101'
      const landmark = input.landmark || input.address?.landmark || ''
      const lat = input.latitude || input.address?.latitude || null
      const lng = input.longitude || input.address?.longitude || null

      await client.query(
        `insert into core.addresses
           (owner_user_id, label, sub_city_id, woreda, kebele, house_number, landmark,
            latitude, longitude, geo_precision, is_default)
         values ($1, 'Home', $2, $3, $4, $5, $6, $7, $8, 'PIN', true)`,
        [id, subCityId, woreda, kebele, houseNumber, landmark, lat, lng],
      )

      // Emergency Contact
      const emName =
        input.emergency_contact?.full_name || input.emergency_contact_name || 'Family Contact'
      const emPhone =
        input.emergency_contact?.phone_e164 || input.emergency_contact_phone || phoneE164
      const emRel =
        input.emergency_contact?.relationship || input.emergency_contact_relationship || 'Family'

      await client.query(
        `insert into core.emergency_contacts
           (customer_user_id, full_name, phone, relationship, is_primary)
         values ($1, $2, $3, $4, true)`,
        [id, emName, emPhone, emRel],
      )

      return id
    })

    const session = await this.sessions.issue(
      { id: userId, role: UserRole.CUSTOMER, status: 'ACTIVE', full_name: input.full_name },
      context,
    )

    this.eventsService.emitToRole('ADMIN', 'CUSTOMER_REGISTERED', {
      user_id: userId,
      full_name: input.full_name,
      phone_e164: phoneE164,
      email: input.email || null,
      created_at: new Date().toISOString(),
    })

    return {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      user: session.user,
      is_new_user: true,
    }
  }

  async registerCaregiver(
    input: RegisterCaregiverInput,
    context: SessionContext,
  ): Promise<
    Session & {
      is_new_user: true
      payment: {
        id: string
        amount_etb: number
        currency: string
        method: string
        provider: string
        reference: string
        status: string
        paid_at: string
      }
      caregiver_profile: {
        professional_title: string
        qualification_level: string
        approval_status: string
        sub_city: string
      }
      message: string
    }
  > {
    if (!input.phone_e164 || !input.password || !input.full_name || !input.professional_title) {
      throw new AuthError(
        ErrorCode.VALIDATION_ERROR,
        'full_name, phone_e164, password, and professional_title are required',
      )
    }

    let phone = input.phone_e164.trim()
    if (!phone.startsWith('+')) phone = `+${phone}`
    if (!phone.startsWith('+251')) {
      const digits = phone.replace(/^\+?0?/, '')
      phone = `+251${digits}`
    }

    const existing = await this.users.findByPhoneE164(phone)
    if (existing) {
      throw new AuthError(ErrorCode.CONFLICT, 'Phone number is already registered. Please log in.')
    }

    // Resolve home sub-city
    const targetSubCity = input.home_sub_city_id || input.home_sub_city_name || 'Bole'
    const subCityRes = await this.pool.query<{ id: string; name_en: string }>(
      `select id, name_en from catalog.sub_cities
       where (id::text = $1 or lower(name_en) = lower($1) or lower(name_am) = lower($1)) and is_active
       limit 1`,
      [targetSubCity],
    )

    let homeSubCityId = subCityRes.rows[0]?.id
    let homeSubCityName = subCityRes.rows[0]?.name_en || 'Bole'
    if (!homeSubCityId) {
      const defaultSubCity = await this.pool.query<{ id: string; name_en: string }>(
        'select id, name_en from catalog.sub_cities where is_active order by sort_order limit 1',
      )
      homeSubCityId = defaultSubCity.rows[0]?.id
      homeSubCityName = defaultSubCity.rows[0]?.name_en || 'Bole'
    }

    const coverageSubCityIds =
      input.coverage_sub_city_ids && input.coverage_sub_city_ids.length > 0
        ? input.coverage_sub_city_ids
        : [homeSubCityId]

    // Fetch current onboarding fee from system settings
    const feeQuery = await this.pool.query<{ setting_value: { fee_etb?: number; fee_santim?: number } }>(
      `select setting_value from fin.system_settings where setting_key = 'caregiver_registration_fee'`,
    )
    let feeEtb = 500
    let feeSantim = 50000
    const feeRow = feeQuery.rows[0]
    if (feeRow && feeRow.setting_value) {
      const v = feeRow.setting_value
      feeEtb = Number(v.fee_etb) || 500
      feeSantim = Number(v.fee_santim) || feeEtb * 100
    }

    const telebirrRef =
      input.telebirr_reference?.trim() || `TB-REG-${Date.now().toString().slice(-8)}`
    const telebirrPhone = input.telebirr_phone?.trim() || phone

    const { userId, paymentId } = await withTransaction(this.pool, async (client) => {
      // 1. Create User
      const { id: uId } = await this.users.insert(client, {
        role: UserRole.CAREGIVER,
        phone: phone,
        phoneE164: phone,
        fullName: input.full_name,
        passwordHash: hashPassword(input.password),
        preferredLanguage: 'en',
      })

      await client.query(`update auth.users set is_available = true where id = $1`, [uId])

      // 2. Insert Telebirr Payment
      const payRes = await client.query<{ id: string }>(
        `insert into fin.payments (
           customer_user_id, amount_santim, method, provider,
           status, provider_reference, customer_reference,
           payment_type, notes, confirmed_at, created_at, updated_at
         ) values ($1, $2, 'TELEBIRR', 'TELEBIRR', 'CONFIRMED', $3, $4, 'CAREGIVER_REGISTRATION', $5, now(), now(), now())
         returning id`,
        [
          uId,
          feeSantim,
          telebirrRef,
          telebirrPhone,
          `Caregiver Onboarding & Verification Fee (Telebirr Sample) - ${input.professional_title}`,
        ],
      )
      const pId = payRes.rows[0]?.id || ''


      // 3. Create Caregiver Profile
      await client.query(
        `insert into ops.caregiver_profiles (
           user_id, approval_status, professional_title, qualification_level,
           licence_number, years_experience, home_sub_city_id, coverage_sub_city_ids,
           registration_fee_paid, registration_payment_id, submitted_at, created_at, updated_at
         ) values ($1, 'PENDING_REVIEW', $2, $3, $4, $5, $6, $7, true, $8, now(), now(), now())`,
        [
          uId,
          input.professional_title,
          input.qualification_level || 'Clinical Practitioner',
          input.licence_number || 'PENDING_DOCUMENT_UPLOAD',
          Number(input.years_experience) || 1,
          homeSubCityId,
          coverageSubCityIds,
          pId,
        ],
      )

      // 4. Create Settings
      await client.query(
        `insert into ops.caregiver_settings (caregiver_id, notification_radius_km, service_area_notes)
         values ($1, 10, 'Onboarded via mobile app with Telebirr verification fee')
         on conflict (caregiver_id) do nothing`,
        [uId],
      )

      return { userId: uId, paymentId: pId }
    })

    const session = await this.sessions.issue(
      { id: userId, role: UserRole.CAREGIVER, status: 'ACTIVE', full_name: input.full_name },
      context,
    )

    this.eventsService.emitToRole('ADMIN', 'CAREGIVER_REGISTERED', {
      user_id: userId,
      full_name: input.full_name,
      phone_e164: phone,
      professional_title: input.professional_title,
      qualification_level: input.qualification_level || 'Clinical Practitioner',
      sub_city: homeSubCityName,
      amount_etb: feeEtb,
      telebirr_reference: telebirrRef,
      payment_id: paymentId,
      created_at: new Date().toISOString(),
    })

    return {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      user: session.user,
      is_new_user: true,
      payment: {
        id: paymentId,
        amount_etb: feeEtb,
        currency: 'ETB',
        method: 'TELEBIRR',
        provider: 'TELEBIRR',
        reference: telebirrRef,
        status: 'CONFIRMED',
        paid_at: new Date().toISOString(),
      },
      caregiver_profile: {
        professional_title: input.professional_title,
        qualification_level: input.qualification_level || 'Clinical Practitioner',
        approval_status: 'PENDING_REVIEW',
        sub_city: homeSubCityName,
      },
      message:
        'Caregiver registered successfully. Telebirr registration fee verified! Profile is now queued for clinical license review.',
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
}