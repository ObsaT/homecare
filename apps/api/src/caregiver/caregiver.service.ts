import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { Pool } from 'pg'
import { PG_POOL } from '../db/db.module'
import { EventsService } from '../events/events.service'

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
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(EventsService) private readonly eventsService: EventsService,
  ) {}

  async getProfile(caregiverUserId: string) {
    const query = `
      select
        u.id, u.full_name, u.phone_e164, u.is_available,
        cp.approval_status, cp.professional_title, cp.qualification_level,
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
        coalesce(sc.name_en, a.address_snapshot->>'sub_city', r.address_snapshot->>'sub_city') as sub_city_name,
        coalesce(sc.name_am, '') as sub_city_name_am,
        coalesce(a.address_snapshot->>'landmark', r.address_snapshot->>'landmark') as landmark,
        asg.id as assignment_id, asg.status as offer_status, asg.offered_at, asg.expires_at
      from ops.assignments asg
      join ops.appointments a on a.id = asg.appointment_id
      join ops.requests r on r.id = a.request_id
      join catalog.services s on s.id = a.service_id
      join clinical.patients p on p.id = r.patient_id
      left join catalog.sub_cities sc on lower(sc.name_en) = lower(coalesce(a.address_snapshot->>'sub_city', r.address_snapshot->>'sub_city'))
        or sc.id::text = coalesce(a.address_snapshot->>'sub_city_id', r.address_snapshot->>'sub_city_id')
      where asg.caregiver_id = $1 and asg.status = 'OFFERED'
      order by asg.offered_at desc
    `
    const { rows } = await this.pool.query(query, [caregiverUserId])
    return rows
  }

  async getAppointments(caregiverUserId: string) {
    const query = `
      select
        a.id as appointment_id, a.status as appointment_status,
        a.scheduled_start, a.scheduled_end, a.duration_minutes,
        a.address_snapshot, a.price_santim,
        s.code as service_code, s.name_en as service_name_en, s.name_am as service_name_am,
        p.full_name as patient_name, p.age_years as patient_age,
        r.reference as request_reference, r.notes as clinical_notes,
        coalesce(sc.name_en, a.address_snapshot->>'sub_city', r.address_snapshot->>'sub_city') as sub_city_name,
        coalesce(sc.name_am, '') as sub_city_name_am,
        coalesce(a.address_snapshot->>'landmark', r.address_snapshot->>'landmark') as landmark,
        coalesce(a.address_snapshot->>'house', r.address_snapshot->>'house') as house_number
      from ops.appointments a
      join ops.requests r on r.id = a.request_id
      join catalog.services s on s.id = a.service_id
      join clinical.patients p on p.id = r.patient_id
      left join catalog.sub_cities sc on lower(sc.name_en) = lower(coalesce(a.address_snapshot->>'sub_city', r.address_snapshot->>'sub_city'))
        or sc.id::text = coalesce(a.address_snapshot->>'sub_city_id', r.address_snapshot->>'sub_city_id')
      where a.caregiver_id = $1 and a.status in ('ACCEPTED', 'EN_ROUTE', 'IN_PROGRESS', 'COMPLETED')
      order by
        case when a.status in ('IN_PROGRESS', 'EN_ROUTE') then 1
             when a.status = 'ACCEPTED' then 2
             else 3
        end asc,
        a.scheduled_start desc
      limit 20
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
      const reqRes = await client.query(
        `update ops.requests
         set status = 'CONFIRMED', updated_at = now()
         where id = (select request_id from ops.appointments where id = $1)
         returning id, customer_user_id, reference`,
        [appointmentId],
      )

      await client.query('commit')

      if (reqRes.rows[0]) {
        this.eventsService.emitToUser(reqRes.rows[0].customer_user_id, 'VISIT_STATUS_CHANGED', {
          appointment_id: appointmentId,
          request_id: reqRes.rows[0].id,
          reference: reqRes.rows[0].reference,
          status: 'CONFIRMED',
          message: 'Caregiver has accepted the assignment offer.',
        })
      }
      this.eventsService.emitToRole('ADMIN', 'OFFER_ACCEPTED', {
        appointment_id: appointmentId,
        caregiver_id: caregiverUserId,
      })

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
      this.eventsService.emitToRole('ADMIN', 'OFFER_DECLINED', {
        appointment_id: appointmentId,
        caregiver_id: caregiverUserId,
      })
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

      const reqRes = await client.query(
        `update ops.requests
         set status = 'EN_ROUTE', updated_at = now()
         where id = (select request_id from ops.appointments where id = $1)
         returning id, customer_user_id, reference`,
        [appointmentId],
      )

      await client.query('commit')

      if (reqRes.rows[0]) {
        this.eventsService.emitToUser(reqRes.rows[0].customer_user_id, 'VISIT_STATUS_CHANGED', {
          appointment_id: appointmentId,
          request_id: reqRes.rows[0].id,
          reference: reqRes.rows[0].reference,
          status: 'EN_ROUTE',
          message: 'Caregiver is en route to your address.',
        })
      }

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

      const reqRes = await client.query(
        `update ops.requests
         set status = 'IN_PROGRESS', updated_at = now()
         where id = (select request_id from ops.appointments where id = $1)
         returning id, customer_user_id, reference`,
        [appointmentId],
      )

      await client.query('commit')

      if (reqRes.rows[0]) {
        this.eventsService.emitToUser(reqRes.rows[0].customer_user_id, 'VISIT_STATUS_CHANGED', {
          appointment_id: appointmentId,
          request_id: reqRes.rows[0].id,
          reference: reqRes.rows[0].reference,
          status: 'IN_PROGRESS',
          message: 'Caregiver has arrived and started the visit.',
        })
      }

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
      const reqRes = await client.query(
        `update ops.requests
         set status = 'COMPLETED', updated_at = now()
         where id = $1
         returning id, customer_user_id, reference`,
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
      if (reqRes.rows[0]) {
        this.eventsService.emitToUser(reqRes.rows[0].customer_user_id, 'VISIT_STATUS_CHANGED', {
          appointment_id: appointmentId,
          request_id: reqRes.rows[0].id,
          reference: reqRes.rows[0].reference,
          status: 'COMPLETED',
          message: 'Care visit has been completed successfully.',
        })
      }
      this.eventsService.emitToRole('ADMIN', 'VISIT_COMPLETED', {
        appointment_id: appointmentId,
        caregiver_id: caregiverUserId,
      })
      return { success: true, status: 'COMPLETED', visit_record_id: visitRecordId }
    } catch (err) {
      await client.query('rollback')
      throw err
    } finally {
      client.release()
    }
  }
}
