import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { Pool } from 'pg'
import { PG_POOL } from '../db/db.module'

export interface CompleteVisitInput {
  observations?: string
  supplies_used?: Array<{ item: string; quantity: number }>
  follow_up_required?: boolean
  follow_up_notes?: string
  vitals?: {
    bp_systolic?: number
    bp_diastolic?: number
    heart_rate?: number
    temperature_c?: number
    respiratory_rate?: number
    oxygen_sat_pct?: number
    blood_glucose_mg_dl?: number
    weight_kg?: number
    notes?: string
  }
}

@Injectable()
export class CaregiverService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getProfile(caregiverUserId: string) {
    const query = `
      select
        u.id, u.full_name, u.phone_e164, u.is_available,
        cp.approval_status, cp.professional_title, cp.qualification_level,
        cp.rating_avg, cp.rating_count, cp.completed_visits
      from auth.users u
      left join ops.caregiver_profiles cp on cp.user_id = u.id
      where u.id = $1
    `
    const { rows } = await this.pool.query(query, [caregiverUserId])
    if (rows.length === 0) throw new NotFoundException('Caregiver not found')
    return rows[0]
  }

  async setAvailability(caregiverUserId: string, isAvailable: boolean) {
    await this.pool.query(
      `update auth.users set is_available = $1, updated_at = now() where id = $2`,
      [isAvailable, caregiverUserId],
    )
    return { is_available: isAvailable }
  }

  async getOffers(caregiverUserId: string) {
    const query = `
      select
        a.id as appointment_id, a.status as appointment_status,
        a.scheduled_start, a.scheduled_end, a.duration_minutes,
        a.address_snapshot, a.price_santim,
        s.code as service_code, s.name_en as service_name_en, s.name_am as service_name_am,
        p.full_name as patient_name,
        asg.id as assignment_id, asg.status as offer_status, asg.offered_at, asg.expires_at
      from ops.assignments asg
      join ops.appointments a on a.id = asg.appointment_id
      join ops.requests r on r.id = a.request_id
      join catalog.services s on s.id = a.service_id
      join clinical.patients p on p.id = r.patient_id
      where asg.caregiver_id = $1 and asg.status = 'OFFERED'
      order by asg.offered_at desc
    `
    const { rows } = await this.pool.query(query, [caregiverUserId])
    return rows
  }

  async acceptOffer(caregiverUserId: string, appointmentId: string) {
    const client = await this.pool.connect()
    try {
      await client.query('begin')

      // Update assignment
      const asgRes = await client.query(
        `update ops.assignments
         set status = 'ACCEPTED', accepted_at = now(), updated_at = now()
         where appointment_id = $1 and caregiver_id = $2 and status = 'OFFERED'
         returning id`,
        [appointmentId, caregiverUserId],
      )
      if (asgRes.rows.length === 0) {
        throw new BadRequestException('No pending offer found for this appointment')
      }

      // Update appointment
      await client.query(
        `update ops.appointments
         set caregiver_id = $1, status = 'ACCEPTED', updated_at = now()
         where id = $2`,
        [caregiverUserId, appointmentId],
      )

      // Update parent request to CONFIRMED
      await client.query(
        `update ops.requests
         set status = 'CONFIRMED', updated_at = now()
         where id = (select request_id from ops.appointments where id = $1)`,
        [appointmentId],
      )

      await client.query('commit')
      return { success: true, status: 'CONFIRMED', message: 'Assignment accepted' }
    } catch (err) {
      await client.query('rollback')
      throw err
    } finally {
      client.release()
    }
  }

  async declineOffer(caregiverUserId: string, appointmentId: string, reason?: string) {
    const client = await this.pool.connect()
    try {
      await client.query('begin')

      const asgRes = await client.query(
        `update ops.assignments
         set status = 'DECLINED', decline_reason = 'NOT_AVAILABLE', decline_note = $1, responded_at = now(), updated_at = now()
         where appointment_id = $2 and caregiver_id = $3 and status = 'OFFERED'
         returning id`,
        [reason || 'Caregiver unavailable', appointmentId, caregiverUserId],
      )
      if (asgRes.rows.length === 0) {
        throw new BadRequestException('No pending offer found')
      }

      // Revert request back to UNDER_REVIEW
      await client.query(
        `update ops.requests
         set status = 'UNDER_REVIEW', updated_at = now()
         where id = (select request_id from ops.appointments where id = $1)`,
        [appointmentId],
      )

      await client.query('commit')
      return { success: true, message: 'Assignment declined' }
    } catch (err) {
      await client.query('rollback')
      throw err
    } finally {
      client.release()
    }
  }

  async markEnRoute(caregiverUserId: string, appointmentId: string) {
    const client = await this.pool.connect()
    try {
      await client.query('begin')

      await client.query(
        `update ops.appointments
         set status = 'EN_ROUTE', updated_at = now()
         where id = $1 and caregiver_id = $2`,
        [appointmentId, caregiverUserId],
      )

      await client.query(
        `update ops.requests
         set status = 'EN_ROUTE', updated_at = now()
         where id = (select request_id from ops.appointments where id = $1)`,
        [appointmentId],
      )

      await client.query('commit')
      return { success: true, status: 'EN_ROUTE', message: 'Caregiver en route' }
    } catch (err) {
      await client.query('rollback')
      throw err
    } finally {
      client.release()
    }
  }

  async startVisit(caregiverUserId: string, appointmentId: string, lat?: number, lng?: number) {
    const client = await this.pool.connect()
    try {
      await client.query('begin')

      await client.query(
        `update ops.appointments
         set status = 'IN_PROGRESS', arrival_at = now(), arrival_lat = $1, arrival_lng = $2, updated_at = now()
         where id = $3 and caregiver_id = $4`,
        [lat || null, lng || null, appointmentId, caregiverUserId],
      )

      await client.query(
        `update ops.requests
         set status = 'IN_PROGRESS', updated_at = now()
         where id = (select request_id from ops.appointments where id = $1)`,
        [appointmentId],
      )

      await client.query('commit')
      return { success: true, status: 'IN_PROGRESS', arrival_at: new Date().toISOString() }
    } catch (err) {
      await client.query('rollback')
      throw err
    } finally {
      client.release()
    }
  }

  async completeVisit(caregiverUserId: string, appointmentId: string, input: CompleteVisitInput) {
    const client = await this.pool.connect()
    try {
      await client.query('begin')

      // 1. Update appointment to COMPLETED
      const apptRes = await client.query(
        `update ops.appointments
         set status = 'COMPLETED', departure_at = now(), updated_at = now()
         where id = $1 and caregiver_id = $2
         returning request_id, service_id, arrival_at, departure_at`,
        [appointmentId, caregiverUserId],
      )
      if (apptRes.rows.length === 0) {
        throw new NotFoundException('Appointment not found or not assigned to caregiver')
      }
      const appt = apptRes.rows[0]

      // 2. Update request to COMPLETED
      await client.query(
        `update ops.requests
         set status = 'COMPLETED', updated_at = now()
         where id = $1`,
        [appt.request_id],
      )

      // 3. Resolve patient_id
      const patRes = await client.query(
        `select patient_id from ops.requests where id = $1`,
        [appt.request_id],
      )
      const patientId = patRes.rows[0].patient_id

      // 4. Create clinical.visit_records
      const recRes = await client.query(
        `insert into clinical.visit_records (
          appointment_id, patient_id, caregiver_id, service_id, outcome,
          started_at, ended_at, observations, supplies_used, follow_up_required, follow_up_notes
        ) values ($1, $2, $3, $4, 'COMPLETED', $5, $6, $7, $8, $9, $10)
        returning id`,
        [
          appointmentId,
          patientId,
          caregiverUserId,
          appt.service_id,
          appt.arrival_at || new Date().toISOString(),
          appt.departure_at || new Date().toISOString(),
          input.observations || null,
          JSON.stringify(input.supplies_used || []),
          input.follow_up_required || false,
          input.follow_up_notes || null,
        ],
      )
      const visitRecordId = recRes.rows[0].id

      // 5. If vitals provided, record in clinical.vitals
      if (input.vitals) {
        const v = input.vitals
        await client.query(
          `insert into clinical.vitals (
            visit_record_id, bp_systolic, bp_diastolic, heart_rate,
            temperature_c, respiratory_rate, oxygen_sat_pct, blood_glucose_mg_dl, weight_kg, notes
          ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            visitRecordId,
            v.bp_systolic || null,
            v.bp_diastolic || null,
            v.heart_rate || null,
            v.temperature_c || null,
            v.respiratory_rate || null,
            v.oxygen_sat_pct || null,
            v.blood_glucose_mg_dl || null,
            v.weight_kg || null,
            v.notes || null,
          ],
        )
      }

      // 6. Update caregiver completed count
      await client.query(
        `update ops.caregiver_profiles
         set completed_visits = completed_visits + 1, total_visits = total_visits + 1, updated_at = now()
         where user_id = $1`,
        [caregiverUserId],
      )

      await client.query('commit')
      return { success: true, status: 'COMPLETED', visit_record_id: visitRecordId }
    } catch (err) {
      await client.query('rollback')
      throw err
    } finally {
      client.release()
    }
  }
}
