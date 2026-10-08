import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { Pool } from 'pg'
import { PG_POOL } from '../db/db.module'

export interface ServiceItem {
  id: string
  code: string
  name_en: string
  name_am: string
  description_en: string
  description_am: string
  billing_unit: string
  default_duration_minutes: number
  min_duration_minutes: number
  max_duration_minutes: number
  requires_licence: boolean
  required_qualification: string | null
  price_santim: number
  is_active?: boolean
  requires_review?: boolean
}

export interface SubCityItem {
  id: string
  code: string
  name_en: string
  name_am: string
}

export interface CreateServiceInput {
  code: string
  name_en: string
  name_am: string
  description_en: string
  description_am: string
  billing_unit?: string
  default_duration_minutes?: number
  min_duration_minutes?: number
  max_duration_minutes?: number
  requires_licence?: boolean
  required_qualification?: string
  price_santim: number
  requires_review?: boolean
}

export interface UpdateServiceInput {
  name_en?: string
  name_am?: string
  description_en?: string
  description_am?: string
  billing_unit?: string
  default_duration_minutes?: number
  min_duration_minutes?: number
  max_duration_minutes?: number
  requires_licence?: boolean
  required_qualification?: string
  price_santim?: number
  is_active?: boolean
  requires_review?: boolean
}

@Injectable()
export class CatalogService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async listServices(includeInactive = false): Promise<ServiceItem[]> {
    const query = `
      select
        s.id, s.code, s.name_en, s.name_am, s.description_en, s.description_am,
        s.billing_unit, s.default_duration_minutes, s.min_duration_minutes, s.max_duration_minutes,
        s.requires_licence, s.required_qualification, s.is_active, s.requires_review,
        coalesce(sp.amount_santim, 50000)::int as price_santim
      from catalog.services s
      left join catalog.service_prices sp on sp.service_id = s.id and sp.effective_to is null
      ${includeInactive ? '' : 'where s.is_active = true'}
      order by s.sort_order asc, s.name_en asc
    `
    const { rows } = await this.pool.query(query)
    return rows
  }

  async getServiceById(id: string): Promise<ServiceItem> {
    const query = `
      select
        s.id, s.code, s.name_en, s.name_am, s.description_en, s.description_am,
        s.billing_unit, s.default_duration_minutes, s.min_duration_minutes, s.max_duration_minutes,
        s.requires_licence, s.required_qualification, s.is_active, s.requires_review,
        coalesce(sp.amount_santim, 50000)::int as price_santim
      from catalog.services s
      left join catalog.service_prices sp on sp.service_id = s.id and sp.effective_to is null
      where s.id = $1
    `
    const { rows } = await this.pool.query(query, [id])
    if (rows.length === 0) {
      throw new NotFoundException(`Service ${id} not found`)
    }
    return rows[0]
  }

  async createService(input: CreateServiceInput, createdBy?: string): Promise<ServiceItem> {
    const code = input.code.toUpperCase().replace(/[^A-Z0-9_]/g, '_')

    const client = await this.pool.connect()
    try {
      await client.query('begin')

      const insertService = `
        insert into catalog.services (
          code, name_en, name_am, description_en, description_am,
          billing_unit, default_duration_minutes, min_duration_minutes, max_duration_minutes,
          requires_licence, required_qualification, requires_review, is_active
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
        returning id, code, name_en, name_am, description_en, description_am,
                  billing_unit, default_duration_minutes, min_duration_minutes, max_duration_minutes,
                  requires_licence, required_qualification, is_active, requires_review
      `
      const { rows: svcRows } = await client.query(insertService, [
        code,
        input.name_en,
        input.name_am,
        input.description_en,
        input.description_am,
        input.billing_unit || 'PER_VISIT',
        input.default_duration_minutes || 60,
        input.min_duration_minutes || 30,
        input.max_duration_minutes || 480,
        input.requires_licence ?? false,
        input.required_qualification || null,
        input.requires_review ?? false,
      ])
      const created = svcRows[0]

      const insertPrice = `
        insert into catalog.service_prices (
          service_id, billing_unit, amount_santim, created_by, effective_from
        ) values ($1, $2, $3, $4, now())
      `
      await client.query(insertPrice, [
        created.id,
        created.billing_unit,
        input.price_santim,
        createdBy || null,
      ])

      await client.query('commit')
      return { ...created, price_santim: input.price_santim }
    } catch (err) {
      await client.query('rollback')
      throw err
    } finally {
      client.release()
    }
  }

  async updateService(id: string, input: UpdateServiceInput, updatedBy?: string): Promise<ServiceItem> {
    const existing = await this.getServiceById(id)
    const client = await this.pool.connect()

    try {
      await client.query('begin')

      const updateQuery = `
        update catalog.services set
          name_en = coalesce($2, name_en),
          name_am = coalesce($3, name_am),
          description_en = coalesce($4, description_en),
          description_am = coalesce($5, description_am),
          billing_unit = coalesce($6, billing_unit),
          default_duration_minutes = coalesce($7, default_duration_minutes),
          min_duration_minutes = coalesce($8, min_duration_minutes),
          max_duration_minutes = coalesce($9, max_duration_minutes),
          requires_licence = coalesce($10, requires_licence),
          required_qualification = coalesce($11, required_qualification),
          is_active = coalesce($12, is_active),
          requires_review = coalesce($13, requires_review),
          updated_at = now()
        where id = $1
      `
      await client.query(updateQuery, [
        id,
        input.name_en ?? null,
        input.name_am ?? null,
        input.description_en ?? null,
        input.description_am ?? null,
        input.billing_unit ?? null,
        input.default_duration_minutes ?? null,
        input.min_duration_minutes ?? null,
        input.max_duration_minutes ?? null,
        input.requires_licence ?? null,
        input.required_qualification ?? null,
        input.is_active ?? null,
        input.requires_review ?? null,
      ])

      if (input.price_santim !== undefined && input.price_santim !== existing.price_santim) {
        // Expire previous price
        await client.query(
          'update catalog.service_prices set effective_to = now() where service_id = $1 and effective_to is null',
          [id],
        )
        // Insert new price
        await client.query(
          `insert into catalog.service_prices (service_id, billing_unit, amount_santim, created_by, effective_from)
           values ($1, $2, $3, $4, now())`,
          [id, input.billing_unit || existing.billing_unit, input.price_santim, updatedBy || null],
        )
      }

      await client.query('commit')
      return await this.getServiceById(id)
    } catch (err) {
      await client.query('rollback')
      throw err
    } finally {
      client.release()
    }
  }

  async deleteService(id: string): Promise<{ success: boolean }> {
    const res = await this.pool.query(
      'update catalog.services set is_active = false, updated_at = now() where id = $1',
      [id],
    )
    if (res.rowCount === 0) {
      throw new NotFoundException(`Service ${id} not found`)
    }
    return { success: true }
  }

  async updateCustomQuote(
    requestId: string,
    input: { price_santim: number; duration_minutes?: number; notes?: string },
  ): Promise<{ success: boolean; request_id: string; price_santim: number }> {
    const client = await this.pool.connect()
    try {
      await client.query('begin')

      // Update request duration & status
      await client.query(
        `update ops.requests set
           duration_minutes = coalesce($2, duration_minutes),
           review_note = coalesce($3, review_note),
           status = case when status = 'SUBMITTED' then 'APPROVED'::ops.request_status else status end,
           updated_at = now()
         where id = $1`,
        [requestId, input.duration_minutes ?? null, input.notes ?? null],
      )

      // Update linked appointment price
      await client.query(
        `update ops.appointments set
           price_santim = $2,
           duration_minutes = coalesce($3, duration_minutes),
           updated_at = now()
         where request_id = $1`,
        [requestId, input.price_santim, input.duration_minutes ?? null],
      )

      // Update linked invoice total if draft or issued
      await client.query(
        `update fin.invoices set
           subtotal_santim = $2,
           total_santim = $2,
           updated_at = now()
         where request_id = $1 and status = 'ISSUED'`,
        [requestId, input.price_santim],
      )

      await client.query('commit')
      return { success: true, request_id: requestId, price_santim: input.price_santim }
    } catch (err) {
      await client.query('rollback')
      throw err
    } finally {
      client.release()
    }
  }

  async listSubCities(): Promise<SubCityItem[]> {
    const query = `
      select id, code, name_en, name_am
      from catalog.sub_cities
      where is_active = true
      order by sort_order asc
    `
    const { rows } = await this.pool.query(query)
    return rows
  }

  async calculateQuote(serviceCode: string, durationMinutes: number): Promise<{
    service_code: string
    duration_minutes: number
    base_price_santim: number
    surcharge_santim: number
    total_santim: number
    currency: string
  }> {
    const query = `
      select s.id, s.billing_unit, coalesce(sp.amount_santim, 50000)::bigint as amount_santim
      from catalog.services s
      left join catalog.service_prices sp on sp.service_id = s.id and sp.effective_to is null
      where s.code = $1 and s.is_active = true
      limit 1
    `
    const { rows } = await this.pool.query(query, [serviceCode])
    if (rows.length === 0) {
      throw new Error(`Service ${serviceCode} not found`)
    }

    const { billing_unit, amount_santim } = rows[0]
    let basePrice = Number(amount_santim)

    if (billing_unit === 'PER_HOUR') {
      const hours = Math.ceil(durationMinutes / 60)
      basePrice = basePrice * hours
    }

    return {
      service_code: serviceCode,
      duration_minutes: durationMinutes,
      base_price_santim: basePrice,
      surcharge_santim: 0,
      total_santim: basePrice,
      currency: 'ETB',
    }
  }

  async getCaregiverRegistrationFee(): Promise<{
    fee_etb: number
    fee_santim: number
    currency: string
    description: string
  }> {
    try {
      const { rows } = await this.pool.query(
        `select setting_value from fin.system_settings where setting_key = 'caregiver_registration_fee'`,
      )
      if (rows.length > 0 && rows[0].setting_value) {
        const val = rows[0].setting_value
        return {
          fee_etb: Number(val.fee_etb) || 500,
          fee_santim: Number(val.fee_santim) || (Number(val.fee_etb) || 500) * 100,
          currency: val.currency || 'ETB',
          description: val.description || 'Standard Caregiver Clinical Onboarding & Telebirr Verification Fee',
        }
      }
    } catch (_) {}

    return {
      fee_etb: 500,
      fee_santim: 50000,
      currency: 'ETB',
      description: 'Standard Caregiver Clinical Onboarding & Telebirr Verification Fee',
    }
  }
}

