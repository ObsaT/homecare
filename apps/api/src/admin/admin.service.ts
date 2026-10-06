import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { Pool } from 'pg'
import { PG_POOL } from '../db/db.module'

@Injectable()
export class AdminService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

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

      await client.query('commit')
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
        cp.rating_avg, cp.rating_count, cp.completed_visits
      from auth.users u
      left join ops.caregiver_profiles cp on cp.user_id = u.id
      where u.role = 'CAREGIVER' and u.deleted_at is null
      order by u.created_at desc
    `
    const { rows } = await this.pool.query(query)
    return rows
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
      return { success: true, approval_status: status }
    } catch (err) {
      await client.query('rollback')
      throw err
    } finally {
      client.release()
    }
  }
}
