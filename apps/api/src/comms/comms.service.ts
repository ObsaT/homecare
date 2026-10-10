import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common'
import type { Pool } from 'pg'
import { PG_POOL } from '../db/db.module'
import { EventsService } from '../events/events.service'

export interface SendMessageInput {
  appointment_id?: string
  request_id?: string
  content: string
  message_type?: 'CHAT' | 'QUICK_UPDATE' | 'EMERGENCY_SOS' | 'BROADCAST_ANNOUNCEMENT' | 'ETA_UPDATE'
  metadata?: Record<string, unknown>
}

@Injectable()
export class CommunicationsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(EventsService) private readonly eventsService: EventsService,
  ) {}

  async sendMessage(senderUserId: string, input: SendMessageInput) {
    if (!input.content || !input.content.trim()) {
      throw new BadRequestException('Message content cannot be empty')
    }

    const client = await this.pool.connect()
    try {
      await client.query('begin')

      // 1. Fetch sender info
      const userRes = await client.query(
        `select id, full_name, role, phone_e164 from auth.users where id = $1`,
        [senderUserId],
      )
      if (userRes.rows.length === 0) {
        throw new NotFoundException('User not found')
      }
      const sender = userRes.rows[0]

      // 2. Resolve appointment and request
      let appointmentId: string | null = input.appointment_id || null
      let requestId: string | null = input.request_id || null
      let counterpartUserId: string | null = null
      let patientName: string = 'Patient'
      let appointmentReference: string = 'VISIT'

      if (appointmentId || requestId) {
        const query = `
          select a.id as appointment_id, a.caregiver_id, a.status as appointment_status,
                 r.id as request_id, r.customer_user_id, r.reference,
                 p.full_name as patient_name
          from ops.requests r
          left join ops.appointments a on a.request_id = r.id
          left join clinical.patients p on p.id = r.patient_id
          where (a.id::text = $1 or r.id::text = $1 or r.reference = $1)
          limit 1
        `
        const matchRes = await client.query(query, [appointmentId || requestId])
        if (matchRes.rows.length > 0) {
          const m = matchRes.rows[0]
          appointmentId = m.appointment_id
          requestId = m.request_id
          appointmentReference = m.reference
          patientName = m.patient_name || 'Patient'

          // If caregiver sent, counterpart is customer; if customer sent, counterpart is caregiver
          if (sender.role === 'CAREGIVER') {
            counterpartUserId = m.customer_user_id
          } else if (sender.role === 'CUSTOMER') {
            counterpartUserId = m.caregiver_id
          }
        }
      }

      const msgType = input.message_type || 'CHAT'

      // 3. Insert record into ops.communications
      const insRes = await client.query(
        `insert into ops.communications (
          appointment_id, request_id, sender_user_id, sender_name,
          sender_role, recipient_role, message_type, content, metadata
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        returning id, appointment_id, request_id, sender_name, sender_role, message_type, content, metadata, created_at`,
        [
          appointmentId,
          requestId,
          senderUserId,
          sender.full_name,
          sender.role,
          'ALL',
          msgType,
          input.content.trim(),
          JSON.stringify(input.metadata || {}),
        ],
      )
      const record = insRes.rows[0]

      await client.query('commit')

      // 4. Real-time broadcast
      const eventPayload = {
        id: record.id,
        appointment_id: appointmentId,
        request_id: requestId,
        reference: appointmentReference,
        patient_name: patientName,
        sender_id: senderUserId,
        sender_name: sender.full_name,
        sender_role: sender.role,
        message_type: msgType,
        content: record.content,
        metadata: input.metadata || {},
        created_at: record.created_at,
      }

      if (msgType === 'EMERGENCY_SOS') {
        // High priority alarm
        this.eventsService.emitToRole('ADMIN', 'EMERGENCY_SOS', eventPayload)
        if (counterpartUserId) {
          this.eventsService.emitToUser(counterpartUserId, 'EMERGENCY_SOS', eventPayload)
        }
      } else if (msgType === 'BROADCAST_ANNOUNCEMENT') {
        this.eventsService.broadcast('BROADCAST_ANNOUNCEMENT', eventPayload)
      } else {
        // Chat or quick update
        this.eventsService.emitToRole('ADMIN', 'CHAT_MESSAGE', eventPayload)
        if (counterpartUserId) {
          this.eventsService.emitToUser(counterpartUserId, 'CHAT_MESSAGE', eventPayload)
        }
      }

      return record
    } catch (err) {
      await client.query('rollback')
      throw err
    } finally {
      client.release()
    }
  }

  async getMessagesForAppointment(targetId: string) {
    const query = `
      select
        c.id, c.appointment_id, c.request_id,
        c.sender_user_id, c.sender_name, c.sender_role,
        c.recipient_role, c.message_type, c.content, c.metadata,
        c.created_at
      from ops.communications c
      where c.appointment_id::text = $1
         or c.request_id::text = $1
         or c.request_id in (select id from ops.requests where reference = $1)
      order by c.created_at asc
      limit 100
    `
    const { rows } = await this.pool.query(query, [targetId])
    return rows
  }

  async getLiveFeedForAdmin(limit = 50) {
    const query = `
      select
        c.id, c.appointment_id, c.request_id,
        c.sender_user_id, c.sender_name, c.sender_role,
        c.message_type, c.content, c.metadata, c.created_at,
        r.reference as request_reference,
        s.name_en as service_name,
        p.full_name as patient_name
      from ops.communications c
      left join ops.requests r on r.id = c.request_id
      left join catalog.services s on s.id = r.primary_service_id
      left join clinical.patients p on p.id = r.patient_id
      order by c.created_at desc
      limit $1
    `
    const { rows } = await this.pool.query(query, [limit])
    return rows
  }
}
