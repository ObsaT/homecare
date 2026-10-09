import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { Pool } from 'pg'
import { PG_POOL } from '../db/db.module'
import { EventsService } from '../events/events.service'

export interface CreateBookingInput {
  service_code: string
  patient_id?: string
  patient_name?: string
  patient_age?: number
  patient_gender?: string
  patient_medical_needs?: string
  sub_city_id: string
  address: string
  landmark?: string
  latitude?: number
  longitude?: number
  emergency_contact_name: string
  emergency_contact_phone: string
  scheduled_date: string // YYYY-MM-DD
  scheduled_time: string // HH:MM
  duration_minutes: number
  notes?: string
}

@Injectable()
export class RequestsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(EventsService) private readonly eventsService: EventsService,
  ) {}

  async createRequest(customerUserId: string, input: CreateBookingInput) {
    const client = await this.pool.connect()
    try {
      await client.query('begin')

      // 1. Resolve service
      const serviceRes = await client.query(
        `select s.id, s.name_en, s.name_am, s.code, s.billing_unit, coalesce(sp.amount_santim, 50000)::bigint as amount_santim
         from catalog.services s
         left join catalog.service_prices sp on sp.service_id = s.id and sp.effective_to is null
         where s.code = $1 and s.is_active = true limit 1`,
        [input.service_code],
      )
      if (serviceRes.rows.length === 0) {
        throw new NotFoundException(`Service ${input.service_code} not found`)
      }
      const service = serviceRes.rows[0]

      // 2. Resolve patient (either existing or create on the fly)
      let patientId = input.patient_id
      if (!patientId) {
        const pName = input.patient_name || 'Patient'
        const patRes = await client.query(
          `insert into clinical.patients (
            household_user_id, full_name, name_search, age_years, gender
          ) values ($1, $2, $3, $4, $5)
          returning id`,
          [
            customerUserId,
            pName,
            pName.toLowerCase().trim(),
            input.patient_age || null,
            input.patient_gender || 'UNSPECIFIED',
          ],
        )
        patientId = patRes.rows[0].id
      }

      // 3. Resolve or insert address
      const addressRes = await client.query(
        `insert into core.addresses (
          owner_user_id, label, sub_city_id, woreda, kebele, house_number,
          landmark, latitude, longitude, geo_precision
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        returning id`,
        [
          customerUserId,
          'Home',
          input.sub_city_id,
          '01',
          '01',
          'N/A',
          input.landmark || 'Addis Ababa',
          input.latitude || null,
          input.longitude || null,
          input.latitude && input.longitude ? 'PIN' : 'NONE',
        ],
      )
      const addressId = addressRes.rows[0].id

      // 4. Calculate price
      let priceSantim = Number(service.amount_santim)
      if (service.billing_unit === 'PER_HOUR') {
        const hours = Math.ceil(input.duration_minutes / 60)
        priceSantim = priceSantim * hours
      }

      // 5. Generate human-readable reference e.g. REQ-2026-948102
      const randomSeq = Math.floor(100000 + Math.random() * 900000)
      const reference = `REQ-2026-${randomSeq}`

      const addressSnapshot = {
        address: input.address,
        sub_city_id: input.sub_city_id,
        landmark: input.landmark || null,
        latitude: input.latitude || null,
        longitude: input.longitude || null,
      }

      const emergencySnapshot = {
        name: input.emergency_contact_name,
        phone: input.emergency_contact_phone,
      }

      // Normalize scheduled date & time
      let schedDate: string = input.scheduled_date || ''
      let schedTime: string = input.scheduled_time || ''
      if (schedTime && schedTime.includes('T')) {
        const parsed = new Date(schedTime)
        const datePart = parsed.toISOString().split('T')[0] ?? '2026-10-07'
        const timePart = parsed.toISOString().split('T')[1] ?? '10:00:00'
        schedDate = schedDate || datePart
        schedTime = timePart.substring(0, 5)
      } else if (!schedDate) {
        schedDate = new Date().toISOString().split('T')[0] ?? '2026-10-07'
      }
      if (!schedTime) {
        schedTime = '10:00'
      }
      if (schedTime.length === 5) {
        schedTime = `${schedTime}:00`
      }

      // 6. Insert ops.requests
      const reqRes = await client.query(
        `insert into ops.requests (
          reference, customer_user_id, patient_id, primary_service_id,
          status, urgency, address_id, address_snapshot, emergency_contact_snapshot,
          preferred_date, preferred_time, duration_minutes, notes
        ) values ($1, $2, $3, $4, 'SUBMITTED', 'ROUTINE', $5, $6, $7, $8, $9, $10, $11)
        returning id, reference, status, duration_minutes, preferred_date, preferred_time, created_at`,
        [
          reference,
          customerUserId,
          patientId,
          service.id,
          addressId,
          JSON.stringify(addressSnapshot),
          JSON.stringify(emergencySnapshot),
          schedDate,
          schedTime,
          input.duration_minutes || 120,
          input.notes || null,
        ],
      )
      const request = reqRes.rows[0]

      // 7. Schedule appointment
      const scheduledStart = new Date(`${schedDate}T${schedTime}Z`)
      const scheduledEnd = new Date(scheduledStart.getTime() + (input.duration_minutes || 120) * 60000)

      const apptRes = await client.query(
        `insert into ops.appointments (
          request_id, occurrence_index, service_id, status,
          scheduled_start, scheduled_end, duration_minutes,
          address_id, address_snapshot, latitude, longitude,
          price_santim
        ) values ($1, 1, $2, 'PENDING', $3, $4, $5, $6, $7, $8, $9, $10)
        returning id, status, scheduled_start, scheduled_end, price_santim`,
        [
          request.id,
          service.id,
          scheduledStart.toISOString(),
          scheduledEnd.toISOString(),
          input.duration_minutes,
          addressId,
          JSON.stringify(addressSnapshot),
          input.latitude || null,
          input.longitude || null,
          priceSantim,
        ],
      )
      const appointment = apptRes.rows[0]

      // 8. Generate invoice record in fin.invoices
      const invSeq = Math.floor(100000 + Math.random() * 900000)
      const invoiceNumber = `INV-2026-${invSeq}`
      await client.query(
        `insert into fin.invoices (
          invoice_number, customer_user_id, request_id, status,
          currency, subtotal_santim, total_santim, due_at
        ) values ($1, $2, $3, 'ISSUED', 'ETB', $4, $4, $5)`,
        [
          invoiceNumber,
          customerUserId,
          request.id,
          priceSantim,
          scheduledEnd.toISOString(),
        ],
      )

      // 9. Location-based Auto-Dispatch to matched caregivers
      const cgRes = await client.query(
        `select u.id, u.full_name, u.phone_e164
         from auth.users u
         join ops.caregiver_profiles cp on cp.user_id = u.id
         where u.role = 'CAREGIVER' and u.is_available = true and cp.approval_status = 'APPROVED'
           and ($1::uuid is null or cp.home_sub_city_id = $1 or $1 = any(cp.coverage_sub_city_ids))
         order by (case when cp.home_sub_city_id = $1 then 1 else 2 end), cp.rating_avg desc nulls last
         limit 3`,
        [input.sub_city_id || null],
      )

      const matchedCaregivers = cgRes.rows
      if (matchedCaregivers.length > 0) {
        const expiresAt = new Date(Date.now() + 2 * 3600 * 1000)
        for (const cg of matchedCaregivers) {
          await client.query(
            `insert into ops.assignments (appointment_id, caregiver_id, status, expires_at)
             values ($1, $2, 'OFFERED', $3)`,
            [appointment.id, cg.id, expiresAt.toISOString()],
          )
        }
        await client.query(
          `update ops.appointments set status = 'OFFERED', updated_at = now() where id = $1`,
          [appointment.id],
        )
        await client.query(
          `update ops.requests set status = 'ASSIGNED', updated_at = now() where id = $1`,
          [request.id],
        )
      }

      await client.query('commit')

      // 10. Real-time notifications emitted after transaction commit
      for (const cg of matchedCaregivers) {
        this.eventsService.emitToUser(cg.id, 'NEW_OFFER', {
          appointment_id: appointment.id,
          request_id: request.id,
          reference: request.reference,
          service_name: service.name_en,
          service_code: service.code,
          patient_name: input.patient_name || 'Patient',
          sub_city: addressSnapshot.sub_city_id || 'Addis Ababa',
          address: input.address || 'Patient Residence, Addis Ababa',
          landmark: input.landmark || null,
          latitude: input.latitude || 9.0105,
          longitude: input.longitude || 38.7891,
          price_santim: priceSantim,
          scheduled_date: schedDate,
          scheduled_time: schedTime,
          duration_minutes: input.duration_minutes || 120,
          clinical_notes: input.notes || 'Care visit requested',
          created_at: new Date().toISOString(),
        })
      }

      this.eventsService.emitToRole('ADMIN', 'NEW_REQUEST', {
        reference: request.reference,
        patient_name: input.patient_name,
        service_name: service.name_en,
        matched_caregivers_count: matchedCaregivers.length,
      })

      return {
        ...request,
        appointment,
        price_santim: priceSantim,
        currency: 'ETB',
        matched_caregivers_count: matchedCaregivers.length,
      }
    } catch (err) {
      await client.query('rollback')
      throw err
    } finally {
      client.release()
    }
  }

  async listCustomerRequests(customerUserId: string) {
    const query = `
      select
        r.id, r.reference, r.status, r.duration_minutes,
        r.preferred_date, r.preferred_time, r.created_at,
        s.name_en as service_name_en, s.name_am as service_name_am, s.code as service_code,
        p.full_name as patient_name,
        a.id as appointment_id, a.status as appointment_status,
        a.scheduled_start, a.scheduled_end, a.price_santim,
        cg.full_name as caregiver_name
      from ops.requests r
      join catalog.services s on s.id = r.primary_service_id
      join clinical.patients p on p.id = r.patient_id
      left join ops.appointments a on a.request_id = r.id and a.occurrence_index = 1
      left join auth.users cg on cg.id = a.caregiver_id
      where r.customer_user_id = $1
      order by r.created_at desc
    `
    const { rows } = await this.pool.query(query, [customerUserId])
    return rows
  }

  async getRequestDetail(customerUserId: string, requestId: string) {
    const query = `
      select
        r.id, r.reference, r.status, r.duration_minutes,
        r.preferred_date, r.preferred_time, r.address_snapshot, r.emergency_contact_snapshot,
        r.notes, r.created_at,
        s.name_en as service_name_en, s.name_am as service_name_am, s.code as service_code,
        p.id as patient_id, p.full_name as patient_name, p.age_years as patient_age, p.gender as patient_gender,
        a.id as appointment_id, a.status as appointment_status,
        a.scheduled_start, a.scheduled_end, a.price_santim,
        a.arrival_at, a.departure_at,
        cg.id as caregiver_id, cg.full_name as caregiver_name, cg.phone as caregiver_phone
      from ops.requests r
      join catalog.services s on s.id = r.primary_service_id
      join clinical.patients p on p.id = r.patient_id
      left join ops.appointments a on a.request_id = r.id and a.occurrence_index = 1
      left join auth.users cg on cg.id = a.caregiver_id
      where r.id = $1 and r.customer_user_id = $2
    `
    const { rows } = await this.pool.query(query, [requestId, customerUserId])
    if (rows.length === 0) {
      throw new NotFoundException('Request not found')
    }
    return rows[0]
  }

  async cancelRequest(customerUserId: string, requestId: string, reason?: string) {
    const client = await this.pool.connect()
    try {
      await client.query('begin')
      const reqRes = await client.query(
        `update ops.requests
         set status = 'CANCELLED', cancelled_at = now(), cancel_reason = $1, cancelled_by_role = 'CUSTOMER'
         where id = $2 and customer_user_id = $3
         returning id, status, reference`,
        [reason || 'Cancelled by customer', requestId, customerUserId],
      )
      if (reqRes.rows.length === 0) {
        throw new NotFoundException('Request not found')
      }

      const apptRes = await client.query(
        `update ops.appointments
         set status = 'CANCELLED', cancel_reason = $1, cancelled_by_role = 'CUSTOMER'
         where request_id = $2
         returning id, caregiver_id`,
        [reason || 'Cancelled by customer', requestId],
      )

      await client.query('commit')

      if (reqRes.rows[0]) {
        this.eventsService.emitToRole('ADMIN', 'REQUEST_CANCELLED', {
          request_id: requestId,
          reference: reqRes.rows[0].reference,
          reason: reason || 'Cancelled by customer',
          status: 'CANCELLED',
        })
      }

      if (apptRes.rows[0]?.caregiver_id) {
        this.eventsService.emitToUser(apptRes.rows[0].caregiver_id, 'REQUEST_CANCELLED', {
          appointment_id: apptRes.rows[0].id,
          request_id: requestId,
          reference: reqRes.rows[0]?.reference,
          message: 'Patient has cancelled this care visit request.',
        })
      }

      return { success: true, message: 'Request cancelled successfully' }
    } catch (err) {
      await client.query('rollback')
      throw err
    } finally {
      client.release()
    }
  }
}
