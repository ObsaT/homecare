import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { Pool } from 'pg'
import { PG_POOL } from '../db/db.module'
import { EventsService } from '../events/events.service'

@Injectable()
export class AdminService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(EventsService) private readonly eventsService: EventsService,
  ) {}

  async getDashboardSummary() {
    const today = new Date().toISOString().slice(0, 10)

    const [apptsToday, pendingReqs, activeVisits, availableCg, completedVisits, revenue, custCount] = await Promise.all([
      this.pool.query(
        `select count(*)::int as count from ops.appointments where scheduled_start::date = $1`,
        [today],
      ),
      this.pool.query(
        `select count(*)::int as count from ops.requests where status in ('SUBMITTED', 'UNDER_REVIEW')`,
      ),
      this.pool.query(
        `select count(*)::int as count from ops.appointments where status in ('EN_ROUTE', 'IN_PROGRESS')`,
      ),
      this.pool.query(
        `select count(*)::int as count from auth.users where role = 'CAREGIVER' and is_available = true`,
      ),
      this.pool.query(
        `select count(*)::int as count from ops.appointments where status = 'COMPLETED'`,
      ),
      this.pool.query(
        `select coalesce(sum(amount_santim), 0)::bigint as total_santim from fin.payments where status = 'CONFIRMED'`,
      ),
      this.pool.query(
        `select count(*)::int as count from auth.users where role = 'CUSTOMER'`,
      ),
    ])

    return {
      today_appointments: apptsToday.rows[0].count,
      pending_requests: pendingReqs.rows[0].count,
      active_visits: activeVisits.rows[0].count,
      available_caregivers: availableCg.rows[0].count,
      completed_visits: completedVisits.rows[0].count,
      revenue_santim: Number(revenue.rows[0].total_santim),
      revenue_etb: Number(revenue.rows[0].total_santim) / 100,
      customer_count: custCount.rows[0].count,
    }
  }

  async listRequests(statusFilter?: string) {
    let query = `
      select
        r.id, r.reference, r.status, r.duration_minutes, r.urgency, r.notes, r.review_note,
        r.preferred_date, r.preferred_time, r.created_at,
        r.address_snapshot,
        coalesce(sc.name_en, r.address_snapshot->>'sub_city') as sub_city_name,
        coalesce(sc.name_am, '') as sub_city_name_am,
        sc.id as sub_city_id,
        r.address_snapshot->>'landmark' as landmark,
        r.address_snapshot->>'house' as house_number,
        s.code as service_code, s.name_en as service_name_en, s.name_am as service_name_am,
        s.requires_review as service_requires_review, s.billing_unit,
        c.full_name as customer_name, c.phone_e164 as customer_phone,
        p.full_name as patient_name,
        a.id as appointment_id, a.status as appointment_status,
        a.scheduled_start, a.scheduled_end, a.price_santim,
        cg.id as caregiver_id, cg.full_name as caregiver_name
      from ops.requests r
      join catalog.services s on s.id = r.primary_service_id
      join auth.users c on c.id = r.customer_user_id
      join clinical.patients p on p.id = r.patient_id
      left join ops.appointments a on a.request_id = r.id and a.occurrence_index = 1
      left join auth.users cg on cg.id = a.caregiver_id
      left join catalog.sub_cities sc on lower(sc.name_en) = lower(r.address_snapshot->>'sub_city')
        or sc.id::text = r.address_snapshot->>'sub_city_id'
    `
    const params: string[] = []
    if (statusFilter) {
      query += ` where r.status = $1`
      params.push(statusFilter)
    }
    query += ` order by r.created_at desc limit 50`

    const { rows } = await this.pool.query(query, params)
    return rows
  }

  async assignCaregiver(appointmentId: string, caregiverId: string, adminUserId: string) {
    const client = await this.pool.connect()
    try {
      await client.query('begin')

      // Check caregiver exists and has role CAREGIVER
      const cgRes = await client.query(
        `select id, full_name from auth.users where id = $1 and role = 'CAREGIVER'`,
        [caregiverId],
      )
      if (cgRes.rows.length === 0) {
        throw new NotFoundException('Caregiver not found')
      }

      // Check appointment exists
      const apptRes = await client.query(
        `select id, request_id, status from ops.appointments where id = $1`,
        [appointmentId],
      )
      if (apptRes.rows.length === 0) {
        throw new NotFoundException('Appointment not found')
      }
      const appt = apptRes.rows[0]

      // Expire 2 hours from now
      const expiresAt = new Date(Date.now() + 2 * 3600 * 1000)

      // Create or update assignment offer
      await client.query(
        `insert into ops.assignments (
          appointment_id, caregiver_id, status, assigned_by, expires_at
        ) values ($1, $2, 'OFFERED', $3, $4)`,
        [appointmentId, caregiverId, adminUserId, expiresAt.toISOString()],
      )

      // Update appointment status to OFFERED
      await client.query(
        `update ops.appointments set status = 'OFFERED', updated_at = now() where id = $1`,
        [appointmentId],
      )

      // Update parent request to ASSIGNED
      await client.query(
        `update ops.requests set status = 'ASSIGNED', updated_at = now() where id = $1`,
        [appt.request_id],
      )

      // Fetch details for real-time notification
      const detailRes = await client.query(
        `select s.name_en as service_name, p.full_name as patient_name,
                coalesce(sc.name_en, a.address_snapshot->>'sub_city', r.address_snapshot->>'sub_city') as sub_city_name,
                coalesce(a.address_snapshot->>'landmark', r.address_snapshot->>'landmark') as landmark,
                coalesce(a.address_snapshot->>'address', r.address_snapshot->>'address', 'Patient Residence') as address,
                coalesce(nullif(a.address_snapshot->>'latitude', ''), nullif(r.address_snapshot->>'latitude', ''), '9.0105')::numeric as latitude,
                coalesce(nullif(a.address_snapshot->>'longitude', ''), nullif(r.address_snapshot->>'longitude', ''), '38.7891')::numeric as longitude,
                a.price_santim
         from ops.appointments a
         join ops.requests r on r.id = a.request_id
         join catalog.services s on s.id = a.service_id
         join clinical.patients p on p.id = r.patient_id
         left join catalog.sub_cities sc on lower(sc.name_en) = lower(coalesce(a.address_snapshot->>'sub_city', r.address_snapshot->>'sub_city'))
         where a.id = $1`,
        [appointmentId],
      )
      const detail = detailRes.rows[0]

      await client.query('commit')

      if (detail) {
        this.eventsService.emitToUser(caregiverId, 'NEW_OFFER', {
          appointment_id: appointmentId,
          request_id: appt.request_id,
          service_name: detail.service_name,
          patient_name: detail.patient_name,
          sub_city: detail.sub_city_name || 'Addis Ababa',
          address: detail.address,
          landmark: detail.landmark || null,
          latitude: Number(detail.latitude) || 9.0105,
          longitude: Number(detail.longitude) || 38.7891,
          price_santim: detail.price_santim,
          created_at: new Date().toISOString(),
        })
      }

      return { success: true, message: 'Caregiver assigned and assignment offer dispatched' }
    } catch (err) {
      await client.query('rollback')
      throw err
    } finally {
      client.release()
    }
  }

  async listCaregivers() {
    const query = `
      select
        u.id, u.full_name, u.phone_e164, u.status as account_status, u.is_available,
        cp.approval_status, cp.professional_title, cp.qualification_level,
        coalesce(cp.registration_fee_paid, true) as registration_fee_paid,
        cp.rating_avg, cp.rating_count, cp.completed_visits,
        cp.home_sub_city_id,
        hsc.name_en as home_sub_city,
        hsc.name_am as home_sub_city_am,
        cs.notification_radius_km,
        cs.service_area_notes,
        coalesce(
          (
            select json_agg(json_build_object('id', sc.id, 'name_en', sc.name_en, 'name_am', sc.name_am))
            from catalog.sub_cities sc
            where sc.id = any(cp.coverage_sub_city_ids)
          ),
          '[]'::json
        ) as coverage_sub_cities
      from auth.users u
      left join ops.caregiver_profiles cp on cp.user_id = u.id
      left join catalog.sub_cities hsc on hsc.id = cp.home_sub_city_id
      left join ops.caregiver_settings cs on cs.caregiver_id = u.id
      where u.role = 'CAREGIVER' and u.deleted_at is null
      order by u.created_at desc
    `
    const { rows } = await this.pool.query(query)
    return rows
  }

  async getCaregiverCandidates(appointmentId: string) {
    // 1. Get the appointment and request location
    const apptRes = await this.pool.query(
      `select
         a.id as appointment_id,
         a.request_id,
         a.service_id,
         s.name_en as service_name_en,
         r.reference as request_reference,
         coalesce(sc.name_en, r.address_snapshot->>'sub_city') as request_sub_city_name,
         coalesce(sc.name_am, '') as request_sub_city_name_am,
         sc.id as request_sub_city_id,
         r.address_snapshot->>'landmark' as request_landmark,
         r.address_snapshot->>'house' as request_house
       from ops.appointments a
       join ops.requests r on r.id = a.request_id
       join catalog.services s on s.id = a.service_id
       left join catalog.sub_cities sc on lower(sc.name_en) = lower(r.address_snapshot->>'sub_city')
         or sc.id::text = r.address_snapshot->>'sub_city_id'
       where a.id = $1`,
      [appointmentId],
    )
    if (apptRes.rows.length === 0) {
      throw new NotFoundException('Appointment not found')
    }
    const appt = apptRes.rows[0]
    const subCityId = appt.request_sub_city_id

    // 2. Fetch all approved caregivers and evaluate match tier against subCityId
    const query = `
      select
        u.id,
        u.full_name,
        u.phone_e164,
        u.is_available,
        cp.approval_status,
        cp.professional_title,
        cp.qualification_level,
        cp.rating_avg,
        cp.rating_count,
        cp.completed_visits,
        hsc.id as home_sub_city_id,
        hsc.name_en as home_sub_city,
        hsc.name_am as home_sub_city_am,
        cs.notification_radius_km,
        cs.service_area_notes,
        coalesce(
          (
            select json_agg(json_build_object('id', sc.id, 'name_en', sc.name_en, 'name_am', sc.name_am))
            from catalog.sub_cities sc
            where sc.id = any(cp.coverage_sub_city_ids)
          ),
          '[]'::json
        ) as coverage_sub_cities,
        case
          when $1::uuid is not null and cp.home_sub_city_id = $1 then 'PRIMARY_LOCAL'
          when $1::uuid is not null and $1 = any(cp.coverage_sub_city_ids) then 'COVERAGE_AREA'
          else 'OUTSIDE_ZONE'
        end as match_tier,
        case
          when $1::uuid is not null and cp.home_sub_city_id = $1 then '⭐ Primary Local Base'
          when $1::uuid is not null and $1 = any(cp.coverage_sub_city_ids) then '📍 Service Coverage Area'
          else '⚠️ Outside Standard Area'
        end as match_tier_label,
        case
          when $1::uuid is not null and cp.home_sub_city_id = $1 then 100
          when $1::uuid is not null and $1 = any(cp.coverage_sub_city_ids) then 75
          else 25
        end + (case when u.is_available then 20 else 0 end) + coalesce(floor(cp.rating_avg * 4)::int, 0) as match_score
      from auth.users u
      join ops.caregiver_profiles cp on cp.user_id = u.id
      left join catalog.sub_cities hsc on hsc.id = cp.home_sub_city_id
      left join ops.caregiver_settings cs on cs.caregiver_id = u.id
      where u.role = 'CAREGIVER' and u.deleted_at is null and cp.approval_status = 'APPROVED'
      order by
        case
          when $1::uuid is not null and cp.home_sub_city_id = $1 then 1
          when $1::uuid is not null and $1 = any(cp.coverage_sub_city_ids) then 2
          else 3
        end asc,
        u.is_available desc,
        cp.rating_avg desc nulls last,
        cp.completed_visits desc
    `

    const { rows: candidates } = await this.pool.query(query, [subCityId])

    return {
      appointment: appt,
      candidates,
      matched_count: candidates.filter(c => c.match_tier !== 'OUTSIDE_ZONE').length,
      total_count: candidates.length,
    }
  }

  async updateCaregiverApproval(caregiverId: string, status: 'APPROVED' | 'REJECTED' | 'SUSPENDED', adminUserId: string) {
    const client = await this.pool.connect()
    try {
      await client.query('begin')

      await client.query(
        `insert into ops.caregiver_profiles (user_id, approval_status, professional_title, approved_by, approved_at)
         values ($1, $2, 'Caregiver', $3, now())
         on conflict (user_id) do update set approval_status = $2, approved_by = $3, approved_at = now(), updated_at = now()`,
        [caregiverId, status, adminUserId],
      )

      if (status === 'APPROVED') {
        await client.query(`update auth.users set status = 'ACTIVE' where id = $1`, [caregiverId])
      } else if (status === 'SUSPENDED') {
        await client.query(`update auth.users set status = 'SUSPENDED' where id = $1`, [caregiverId])
      }

      await client.query('commit')

      this.eventsService.emitToRole('ADMIN', 'CAREGIVER_APPROVAL_UPDATED', {
        caregiver_id: caregiverId,
        approval_status: status,
      })

      this.eventsService.emitToUser(caregiverId, 'CAREGIVER_APPROVAL_UPDATED', {
        caregiver_id: caregiverId,
        approval_status: status,
        message: status === 'APPROVED' ? 'Your clinical credentials have been verified and approved!' : `Your profile status is ${status}`,
      })

      return { success: true, approval_status: status }
    } catch (err) {
      await client.query('rollback')
      throw err
    } finally {
      client.release()
    }
  }

  async getRegistrationFee() {
    const { rows } = await this.pool.query(
      `select setting_value, updated_at from fin.system_settings where setting_key = 'caregiver_registration_fee'`,
    )
    if (rows.length > 0 && rows[0].setting_value) {
      const val = rows[0].setting_value
      return {
        fee_etb: Number(val.fee_etb) || 500,
        fee_santim: Number(val.fee_santim) || (Number(val.fee_etb) || 500) * 100,
        currency: val.currency || 'ETB',
        description: val.description || 'Standard Caregiver Clinical Onboarding & Telebirr Verification Fee',
        updated_at: rows[0].updated_at,
      }
    }
    return {
      fee_etb: 500,
      fee_santim: 50000,
      currency: 'ETB',
      description: 'Standard Caregiver Clinical Onboarding & Telebirr Verification Fee',
      updated_at: new Date().toISOString(),
    }
  }

  async updateRegistrationFee(feeEtb: number, description?: string) {
    const feeSantim = Math.round(feeEtb * 100)
    const payload = {
      fee_etb: feeEtb,
      fee_santim: feeSantim,
      currency: 'ETB',
      description: description || 'Standard Caregiver Clinical Onboarding & Telebirr Verification Fee',
    }

    await this.pool.query(
      `insert into fin.system_settings (setting_key, setting_value, updated_at)
       values ('caregiver_registration_fee', $1, now())
       on conflict (setting_key)
       do update set setting_value = $1, updated_at = now()`,
      [JSON.stringify(payload)],
    )

    return payload
  }

  async listCaregiverRegistrationPayments() {
    const query = `
      select
        p.id,
        p.amount_santim,
        (p.amount_santim / 100)::numeric as amount_etb,
        p.method,
        p.provider,
        p.status,
        p.provider_reference,
        p.customer_reference,
        p.notes,
        p.created_at,
        p.confirmed_at,
        u.id as caregiver_id,
        u.full_name as caregiver_name,
        u.phone_e164 as caregiver_phone,
        cp.professional_title,
        cp.qualification_level,
        cp.approval_status
      from fin.payments p
      join auth.users u on u.id = p.customer_user_id
      left join ops.caregiver_profiles cp on cp.user_id = u.id
      where p.payment_type = 'CAREGIVER_REGISTRATION'
      order by p.created_at desc
    `
    const { rows } = await this.pool.query(query)
    return rows
  }
}

