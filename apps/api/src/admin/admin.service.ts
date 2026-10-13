import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
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
        `select count(*)::int as count from auth.users where role = 'CAREGIVER' and is_available = true and deleted_at is null`,
      ),
      this.pool.query(
        `select count(*)::int as count from ops.appointments where status = 'COMPLETED'`,
      ),
      this.pool.query(
        `select coalesce(sum(amount_santim), 0)::bigint as total_santim from fin.payments where status = 'CONFIRMED'`,
      ),
      this.pool.query(
        `select count(*)::int as count from auth.users where role = 'CUSTOMER' and deleted_at is null`,
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

  async dispatchAppointment(appointmentId: string, adminUserId: string) {
    const client = await this.pool.connect()
    try {
      await client.query('begin')

      const apptRes = await client.query(
        `select a.id, a.request_id, a.caregiver_id, a.status,
                r.customer_user_id, r.reference,
                s.name_en as service_name,
                cg.full_name as caregiver_name, cg.phone_e164 as caregiver_phone,
                c.full_name as customer_name,
                coalesce(sc.name_en, a.address_snapshot->>'sub_city', r.address_snapshot->>'sub_city') as sub_city_name,
                coalesce(a.address_snapshot->>'address', r.address_snapshot->>'address', 'Patient Residence') as address
         from ops.appointments a
         join ops.requests r on r.id = a.request_id
         join catalog.services s on s.id = a.service_id
         join auth.users c on c.id = r.customer_user_id
         left join auth.users cg on cg.id = a.caregiver_id
         left join catalog.sub_cities sc on lower(sc.name_en) = lower(coalesce(a.address_snapshot->>'sub_city', r.address_snapshot->>'sub_city'))
         where a.id = $1`,
        [appointmentId],
      )
      if (apptRes.rows.length === 0) {
        throw new NotFoundException('Appointment not found')
      }
      const appt = apptRes.rows[0]

      if (!appt.caregiver_id) {
        throw new BadRequestException('Cannot dispatch an appointment without an assigned caregiver')
      }

      // Update appointment to CONFIRMED
      await client.query(
        `update ops.appointments set status = 'CONFIRMED', updated_at = now() where id = $1`,
        [appointmentId],
      )

      // Update parent request to CONFIRMED
      await client.query(
        `update ops.requests set status = 'CONFIRMED', updated_at = now() where id = $1`,
        [appt.request_id],
      )

      await client.query('commit')

      // Emit to Customer
      this.eventsService.emitToUser(appt.customer_user_id, 'VISIT_STATUS_CHANGED', {
        appointment_id: appointmentId,
        request_id: appt.request_id,
        reference: appt.reference,
        status: 'CONFIRMED',
        caregiver_id: appt.caregiver_id,
        caregiver_name: appt.caregiver_name,
        caregiver_phone: appt.caregiver_phone,
        message: `Admin has dispatched ${appt.caregiver_name || 'Caregiver'} for your visit!`,
      })

      // Emit to Caregiver
      this.eventsService.emitToUser(appt.caregiver_id, 'VISIT_STATUS_CHANGED', {
        appointment_id: appointmentId,
        request_id: appt.request_id,
        reference: appt.reference,
        status: 'CONFIRMED',
        message: 'Admin has approved and officially dispatched this visit. You may begin travel when ready.',
      })

      // Emit to Admin
      this.eventsService.emitToRole('ADMIN', 'VISIT_STATUS_CHANGED', {
        appointment_id: appointmentId,
        request_id: appt.request_id,
        reference: appt.reference,
        status: 'CONFIRMED',
        caregiver_id: appt.caregiver_id,
        caregiver_name: appt.caregiver_name,
        dispatched_by: adminUserId,
      })

      return {
        success: true,
        status: 'CONFIRMED',
        message: `Appointment ${appt.reference} officially dispatched to ${appt.caregiver_name}`,
      }
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

  async updateCaregiverApproval(
    caregiverId: string,
    status: 'APPROVED' | 'REJECTED' | 'SUSPENDED',
    adminUserId: string,
    reason?: string,
  ) {
    const client = await this.pool.connect()
    try {
      await client.query('begin')

      await client.query(
        `insert into ops.caregiver_profiles (user_id, approval_status, professional_title, approved_by, approved_at, suspension_reason)
         values ($1, $2, 'Caregiver', $3, now(), $4)
         on conflict (user_id) do update set
           approval_status = $2,
           approved_by = $3,
           approved_at = case when $2 = 'APPROVED' then now() else ops.caregiver_profiles.approved_at end,
           suspended_at = case when $2 = 'SUSPENDED' then now() else null end,
           suspension_reason = coalesce($4, ops.caregiver_profiles.suspension_reason),
           updated_at = now()`,
        [caregiverId, status, adminUserId, reason || null],
      )

      if (status === 'APPROVED') {
        await client.query(`update auth.users set status = 'ACTIVE', is_available = true, updated_at = now() where id = $1`, [caregiverId])
      } else if (status === 'SUSPENDED') {
        await client.query(`update auth.users set status = 'SUSPENDED', is_available = false, updated_at = now() where id = $1`, [caregiverId])
        await client.query(`update auth.sessions set revoked_at = now(), revoked_reason = 'ACCOUNT_SUSPENDED' where user_id = $1 and revoked_at is null`, [caregiverId])
      } else if (status === 'REJECTED') {
        await client.query(`update auth.users set is_available = false, updated_at = now() where id = $1`, [caregiverId])
      }

      await client.query('commit')

      this.eventsService.emitToRole('ADMIN', 'CAREGIVER_APPROVAL_UPDATED', {
        caregiver_id: caregiverId,
        approval_status: status,
      })

      this.eventsService.emitToUser(caregiverId, 'CAREGIVER_APPROVAL_UPDATED', {
        caregiver_id: caregiverId,
        approval_status: status,
        message:
          status === 'APPROVED'
            ? 'Your clinical credentials have been verified and approved!'
            : `Your profile status is now ${status}`,
      })

      return { success: true, approval_status: status }
    } catch (err) {
      await client.query('rollback')
      throw err
    } finally {
      client.release()
    }
  }

  async deleteCaregiver(caregiverId: string) {
    const client = await this.pool.connect()
    try {
      await client.query('begin')
      // Unlink any appointments/assignments/reviews/payments before deleting or soft-deleting
      await client.query(`delete from ops.communications where sender_user_id = $1`, [caregiverId])
      await client.query(`delete from clinical.vitals where visit_record_id in (select id from clinical.visit_records where caregiver_id = $1)`, [caregiverId])
      await client.query(`delete from clinical.visit_records where caregiver_id = $1`, [caregiverId])
      await client.query(`delete from ops.reviews where caregiver_id = $1`, [caregiverId])
      await client.query(`delete from ops.assignments where caregiver_id = $1`, [caregiverId])
      await client.query(`update ops.appointments set caregiver_id = null, status = case when status in ('OFFERED', 'ACCEPTED', 'EN_ROUTE') then 'PENDING'::ops.appointment_status else status end where caregiver_id = $1`, [caregiverId])
      await client.query(`delete from fin.payments where customer_user_id = $1`, [caregiverId])
      await client.query(`delete from core.addresses where owner_user_id = $1`, [caregiverId])
      await client.query(`delete from auth.users where id = $1 and role = 'CAREGIVER'`, [caregiverId])
      await client.query('commit')

      this.eventsService.emitToRole('ADMIN', 'CAREGIVER_APPROVAL_UPDATED', {
        caregiver_id: caregiverId,
        deleted: true,
      })
      return { success: true, message: 'Caregiver and associated records permanently removed' }
    } catch (err) {
      await client.query('rollback')
      throw err
    } finally {
      client.release()
    }
  }

  async listCustomers() {
    const query = `
      select
        u.id,
        u.full_name,
        u.phone_e164,
        u.email,
        u.status as account_status,
        u.created_at,
        (
          select coalesce(json_agg(json_build_object(
            'id', p.id,
            'full_name', p.full_name,
            'age_years', p.age_years,
            'gender', p.gender,
            'mobility', p.mobility
          )), '[]'::json)
          from clinical.patients p
          where p.household_user_id = u.id
        ) as patients,
        (
          select count(*)::int from ops.requests r where r.customer_user_id = u.id
        ) as total_requests,
        (
          select coalesce(sum(i.total_santim), 0)::bigint from fin.invoices i where i.customer_user_id = u.id
        ) as total_billed_santim,
        (
          select coalesce(sum(i.paid_santim), 0)::bigint from fin.invoices i where i.customer_user_id = u.id
        ) as total_paid_santim
      from auth.users u
      where u.role = 'CUSTOMER' and u.deleted_at is null
      order by u.created_at desc
    `
    const { rows } = await this.pool.query(query)
    return rows
  }

  async updateCustomerStatus(customerId: string, status: 'ACTIVE' | 'SUSPENDED') {
    const client = await this.pool.connect()
    try {
      await client.query('begin')
      await client.query(
        `update auth.users set status = $1, updated_at = now() where id = $2 and role = 'CUSTOMER'`,
        [status, customerId],
      )
      if (status === 'SUSPENDED') {
        await client.query(
          `update auth.sessions set revoked_at = now(), revoked_reason = 'ACCOUNT_SUSPENDED' where user_id = $1 and revoked_at is null`,
          [customerId],
        )
      }
      await client.query('commit')
      return { success: true, status, message: `Customer account ${status === 'SUSPENDED' ? 'suspended' : 'reactivated'}` }
    } catch (err) {
      await client.query('rollback')
      throw err
    } finally {
      client.release()
    }
  }

  async deleteCustomer(customerId: string) {
    const client = await this.pool.connect()
    try {
      await client.query('begin')
      await client.query(`delete from ops.communications where sender_user_id = $1 or request_id in (select id from ops.requests where customer_user_id = $1)`, [customerId])
      await client.query(`delete from clinical.vitals where visit_record_id in (select id from clinical.visit_records where patient_id in (select id from clinical.patients where household_user_id = $1))`, [customerId])
      await client.query(`delete from clinical.visit_records where patient_id in (select id from clinical.patients where household_user_id = $1)`, [customerId])
      await client.query(`delete from ops.reviews where customer_user_id = $1`, [customerId])
      await client.query(`delete from fin.payments where customer_user_id = $1 or invoice_id in (select id from fin.invoices where customer_user_id = $1)`, [customerId])
      await client.query(`delete from fin.invoices where customer_user_id = $1`, [customerId])
      await client.query(`delete from ops.assignments where appointment_id in (select id from ops.appointments where request_id in (select id from ops.requests where customer_user_id = $1))`, [customerId])
      await client.query(`delete from ops.appointments where request_id in (select id from ops.requests where customer_user_id = $1)`, [customerId])
      await client.query(`delete from ops.requests where customer_user_id = $1`, [customerId])
      await client.query(`delete from clinical.patient_medications where patient_id in (select id from clinical.patients where household_user_id = $1)`, [customerId])
      await client.query(`delete from clinical.patients where household_user_id = $1`, [customerId])
      await client.query(`delete from core.emergency_contacts where customer_user_id = $1`, [customerId])
      await client.query(`delete from core.addresses where owner_user_id = $1`, [customerId])
      await client.query(`delete from auth.users where id = $1 and role = 'CUSTOMER'`, [customerId])
      await client.query('commit')
      return { success: true, message: 'Customer, patients, and related records permanently deleted' }
    } catch (err) {
      await client.query('rollback')
      throw err
    } finally {
      client.release()
    }
  }

  async listAllInvoices() {
    const query = `
      select
        i.id,
        i.invoice_number,
        i.request_id,
        i.customer_user_id,
        i.status,
        i.currency,
        i.subtotal_santim,
        i.surcharge_santim,
        i.discount_santim,
        i.total_santim,
        i.paid_santim,
        (i.total_santim / 100)::numeric as total_etb,
        (i.paid_santim / 100)::numeric as paid_etb,
        (i.discount_santim / 100)::numeric as discount_etb,
        (i.surcharge_santim / 100)::numeric as surcharge_etb,
        i.notes,
        i.issued_at,
        i.due_at,
        i.paid_at,
        r.reference as request_reference,
        s.name_en as service_name_en,
        u.full_name as customer_name,
        u.phone_e164 as customer_phone,
        p.full_name as patient_name
      from fin.invoices i
      join auth.users u on u.id = i.customer_user_id
      left join ops.requests r on r.id = i.request_id
      left join catalog.services s on s.id = r.primary_service_id
      left join clinical.patients p on p.id = r.patient_id
      order by i.created_at desc
    `
    const { rows } = await this.pool.query(query)
    return rows
  }

  async adjustCustomerInvoice(
    invoiceId: string,
    adminUserId: string,
    input: {
      total_etb?: number
      discount_etb?: number
      surcharge_etb?: number
      status?: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'VOID'
      notes?: string
    },
  ) {
    const client = await this.pool.connect()
    try {
      await client.query('begin')
      const invRes = await client.query(`select * from fin.invoices where id = $1`, [invoiceId])
      if (invRes.rows.length === 0) {
        throw new NotFoundException('Invoice not found')
      }
      const inv = invRes.rows[0]

      const discountSantim =
        input.discount_etb !== undefined ? Math.max(0, Math.round(Number(input.discount_etb) * 100)) : Number(inv.discount_santim)
      const surchargeSantim =
        input.surcharge_etb !== undefined ? Math.max(0, Math.round(Number(input.surcharge_etb) * 100)) : Number(inv.surcharge_santim)

      let subtotalSantim = Number(inv.subtotal_santim)
      let totalSantim = Number(inv.total_santim)

      if (input.total_etb !== undefined && Number(input.total_etb) >= 0) {
        totalSantim = Math.round(Number(input.total_etb) * 100)
        subtotalSantim = Math.max(0, totalSantim + discountSantim - surchargeSantim)
      } else {
        totalSantim = Math.max(0, subtotalSantim + surchargeSantim - discountSantim)
      }

      const nextStatus = input.status || inv.status
      const paidSantim = nextStatus === 'PAID' ? totalSantim : Number(inv.paid_santim)
      const paidAt = nextStatus === 'PAID' ? new Date().toISOString() : inv.paid_at

      const updated = await client.query(
        `update fin.invoices
         set subtotal_santim = $1,
             discount_santim = $2,
             surcharge_santim = $3,
             total_santim = $4,
             paid_santim = $5,
             status = $6,
             paid_at = $7,
             notes = coalesce($8, notes),
             updated_at = now()
         where id = $9
         returning *`,
        [
          subtotalSantim,
          discountSantim,
          surchargeSantim,
          totalSantim,
          paidSantim,
          nextStatus,
          paidAt,
          input.notes || null,
          invoiceId,
        ],
      )

      // Also sync appointment price if request_id is linked
      if (inv.request_id) {
        await client.query(
          `update ops.appointments set price_santim = $1, updated_at = now() where request_id = $2`,
          [totalSantim, inv.request_id],
        )
      }

      await client.query('commit')

      this.eventsService.emitToUser(inv.customer_user_id, 'PAYMENT_CONFIRMED', {
        invoice_id: invoiceId,
        invoice_number: inv.invoice_number,
        total_santim: totalSantim,
        total_etb: totalSantim / 100,
        status: nextStatus,
        message: `Your invoice ${inv.invoice_number} was adjusted by finance (${(totalSantim / 100).toLocaleString()} ETB • ${nextStatus}).`,
      })

      this.eventsService.emitToRole('ADMIN', 'PAYMENT_CONFIRMED', {
        invoice_id: invoiceId,
        total_santim: totalSantim,
        status: nextStatus,
      })

      return updated.rows[0]
    } catch (err) {
      await client.query('rollback')
      throw err
    } finally {
      client.release()
    }
  }

  async createCustomerInvoice(
    adminUserId: string,
    input: {
      customer_user_id: string
      request_id?: string
      total_etb: number
      notes?: string
    },
  ) {
    const totalSantim = Math.max(0, Math.round(Number(input.total_etb) * 100))
    const invNum = `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`
    const { rows } = await this.pool.query(
      `insert into fin.invoices (
        invoice_number, request_id, customer_user_id, status, currency,
        subtotal_santim, total_santim, notes, due_at
      ) values ($1, $2, $3, 'ISSUED', 'ETB', $4, $4, $5, now() + interval '48 hours')
      returning *`,
      [invNum, input.request_id || null, input.customer_user_id, totalSantim, input.notes || null],
    )

    this.eventsService.emitToUser(input.customer_user_id, 'QUOTE_UPDATED', {
      invoice_id: rows[0].id,
      invoice_number: invNum,
      total_santim: totalSantim,
      message: `New invoice ${invNum} issued for ${(totalSantim / 100).toLocaleString()} ETB.`,
    })

    return rows[0]
  }

  async clearPlatformData(mode: 'ALL_NON_ADMIN' | 'CAREGIVERS_ONLY' | 'CUSTOMERS_AND_REQUESTS_ONLY') {
    const client = await this.pool.connect()
    try {
      await client.query('begin')

      if (mode === 'CAREGIVERS_ONLY') {
        // Clear ONLY caregivers & nurses and their caregiver-specific records, preserving customers, patients, and admins
        await client.query(`delete from ops.communications where sender_user_id in (select id from auth.users where role = 'CAREGIVER')`)
        await client.query(`delete from clinical.vitals where visit_record_id in (select id from clinical.visit_records where caregiver_id in (select id from auth.users where role = 'CAREGIVER'))`)
        await client.query(`delete from clinical.visit_records where caregiver_id in (select id from auth.users where role = 'CAREGIVER')`)
        await client.query(`delete from ops.reviews where caregiver_id in (select id from auth.users where role = 'CAREGIVER')`)
        await client.query(`delete from ops.assignments where caregiver_id in (select id from auth.users where role = 'CAREGIVER')`)
        await client.query(`update ops.appointments set caregiver_id = null, status = case when status in ('OFFERED', 'ACCEPTED', 'EN_ROUTE', 'IN_PROGRESS') then 'PENDING'::ops.appointment_status else status end where caregiver_id is not null`)
        await client.query(`update ops.requests set status = 'UNDER_REVIEW' where status in ('ASSIGNED', 'CONFIRMED', 'EN_ROUTE', 'IN_PROGRESS')`)
        await client.query(`delete from fin.payments where payment_type = 'CAREGIVER_REGISTRATION' or customer_user_id in (select id from auth.users where role = 'CAREGIVER')`)
        await client.query(`delete from ops.caregiver_services`)
        await client.query(`delete from ops.caregiver_settings`)
        await client.query(`delete from ops.caregiver_profiles`)
        await client.query(`delete from core.addresses where owner_user_id in (select id from auth.users where role = 'CAREGIVER')`)
        await client.query(`delete from auth.users where role = 'CAREGIVER'`)
      } else if (mode === 'CUSTOMERS_AND_REQUESTS_ONLY') {
        // Clear customers, patients, care requests, appointments, invoices, payments — keep admins and caregivers
        await client.query(`delete from ops.communications`)
        await client.query(`delete from clinical.vitals`)
        await client.query(`delete from clinical.visit_records`)
        await client.query(`delete from ops.reviews`)
        await client.query(`delete from fin.payments where payment_type != 'CAREGIVER_REGISTRATION'`)
        await client.query(`delete from fin.invoices`)
        await client.query(`delete from ops.assignments`)
        await client.query(`delete from ops.appointments`)
        await client.query(`delete from ops.requests`)
        await client.query(`delete from clinical.patient_medications`)
        await client.query(`delete from clinical.patients`)
        await client.query(`delete from core.emergency_contacts`)
        await client.query(`delete from core.addresses where owner_user_id in (select id from auth.users where role = 'CUSTOMER')`)
        await client.query(`delete from auth.users where role = 'CUSTOMER'`)
      } else {
        // ALL_NON_ADMIN: Clear all demo/transactional data (Caregivers, Customers, Patients, Requests, Visits, Invoices, Payments, Comms), keep ONLY Admin/Supervisor/Dispatcher logins & Catalog
        await client.query(`delete from ops.communications`)
        await client.query(`delete from clinical.vitals`)
        await client.query(`delete from clinical.visit_records`)
        await client.query(`delete from ops.reviews`)
        await client.query(`delete from fin.payments`)
        await client.query(`delete from fin.invoices`)
        await client.query(`delete from ops.assignments`)
        await client.query(`delete from ops.appointments`)
        await client.query(`delete from ops.requests`)
        await client.query(`delete from clinical.patient_medications`)
        await client.query(`delete from clinical.patients`)
        await client.query(`delete from ops.caregiver_services`)
        await client.query(`delete from ops.caregiver_settings`)
        await client.query(`delete from ops.caregiver_profiles`)
        await client.query(`delete from core.emergency_contacts`)
        await client.query(`delete from core.addresses where owner_user_id in (select id from auth.users where role in ('CAREGIVER', 'CUSTOMER'))`)
        await client.query(`delete from auth.users where role in ('CAREGIVER', 'CUSTOMER')`)
      }

      await client.query('commit')

      this.eventsService.emitToRole('ADMIN', 'CAREGIVER_APPROVAL_UPDATED', {
        data_cleared: mode,
      })

      return {
        success: true,
        mode,
        message:
          mode === 'CAREGIVERS_ONLY'
            ? 'Cleared all Caregiver & Nurse accounts and profiles. Customers, patients, and admins were preserved.'
            : mode === 'CUSTOMERS_AND_REQUESTS_ONLY'
              ? 'Cleared all Customers, Patients, Requests, and Invoices. Caregivers and admins were preserved.'
              : 'All Caregiver, Customer, Patient, Request, and Billing data cleared! Only Admin logins and Service Catalog remain.',
      }
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


