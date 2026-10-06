import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { Pool } from 'pg'
import { PG_POOL } from '../db/db.module'

export interface CreateReviewInput {
  rating_overall: number
  rating_professionalism: number
  rating_punctuality: number
  rating_quality: number
  comment?: string
  is_public?: boolean
}

@Injectable()
export class ReviewsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async createReview(customerUserId: string, appointmentId: string, input: CreateReviewInput) {
    const client = await this.pool.connect()
    try {
      await client.query('begin')

      // Verify appointment is completed and belongs to customer
      const apptRes = await client.query(
        `select a.id, a.caregiver_id, a.status, r.customer_user_id
         from ops.appointments a
         join ops.requests r on r.id = a.request_id
         where a.id = $1 and r.customer_user_id = $2`,
        [appointmentId, customerUserId],
      )
      if (apptRes.rows.length === 0) {
        throw new NotFoundException('Appointment not found for this customer')
      }
      const appt = apptRes.rows[0]

      if (appt.status !== 'COMPLETED') {
        throw new BadRequestException('Reviews can only be submitted for completed visits')
      }
      if (!appt.caregiver_id) {
        throw new BadRequestException('No caregiver associated with appointment')
      }

      // Check if review already exists
      const existing = await client.query(
        `select id from ops.reviews where appointment_id = $1`,
        [appointmentId],
      )
      if (existing.rows.length > 0) {
        throw new BadRequestException('A review has already been submitted for this visit')
      }

      // Insert review
      const revRes = await client.query(
        `insert into ops.reviews (
          appointment_id, customer_user_id, caregiver_id,
          rating_overall, rating_professionalism, rating_punctuality, rating_quality,
          comment, is_public
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        returning id, rating_overall, comment, created_at`,
        [
          appointmentId,
          customerUserId,
          appt.caregiver_id,
          input.rating_overall,
          input.rating_professionalism,
          input.rating_punctuality,
          input.rating_quality,
          input.comment || null,
          input.is_public !== false,
        ],
      )
      const review = revRes.rows[0]

      // Recompute caregiver average rating
      const avgRes = await client.query(
        `select count(*)::int as cnt, avg(rating_overall)::numeric(3,2) as avg_rating
         from ops.reviews where caregiver_id = $1`,
        [appt.caregiver_id],
      )
      const { cnt, avg_rating } = avgRes.rows[0]

      await client.query(
        `update ops.caregiver_profiles
         set rating_count = $1, rating_avg = $2, updated_at = now()
         where user_id = $3`,
        [cnt, avg_rating, appt.caregiver_id],
      )

      await client.query('commit')
      return review
    } catch (err) {
      await client.query('rollback')
      throw err
    } finally {
      client.release()
    }
  }

  async getCaregiverRatings(caregiverUserId: string) {
    const query = `
      select
        r.id, r.rating_overall, r.rating_professionalism, r.rating_punctuality, r.rating_quality,
        r.comment, r.created_at,
        c.full_name as customer_name
      from ops.reviews r
      join auth.users c on c.id = r.customer_user_id
      where r.caregiver_id = $1 and r.is_public = true
      order by r.created_at desc
    `
    const { rows } = await this.pool.query(query, [caregiverUserId])
    return rows
  }
}
