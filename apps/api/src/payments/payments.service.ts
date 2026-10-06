import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { Pool } from 'pg'
import { PG_POOL } from '../db/db.module'

export interface PaymentClaimInput {
  amount_santim: number
  method: 'TELEBIRR' | 'CBE_BIRR' | 'BANK_TRANSFER' | 'CASH' | 'OTHER'
  customer_reference?: string
  notes?: string
}

@Injectable()
export class PaymentsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async listCustomerInvoices(customerUserId: string) {
    const query = `
      select
        i.id, i.invoice_number, i.status, i.currency,
        i.subtotal_santim, i.total_santim, i.paid_santim,
        i.issued_at, i.due_at, i.paid_at,
        r.reference as request_reference,
        s.name_en as service_name_en, s.name_am as service_name_am
      from fin.invoices i
      left join ops.requests r on r.id = i.request_id
      left join catalog.services s on s.id = r.primary_service_id
      where i.customer_user_id = $1
      order by i.created_at desc
    `
    const { rows } = await this.pool.query(query, [customerUserId])
    return rows
  }

  async submitPaymentClaim(customerUserId: string, invoiceId: string, input: PaymentClaimInput) {
    const client = await this.pool.connect()
    try {
      await client.query('begin')

      const invRes = await client.query(
        `select id, total_santim, status from fin.invoices where id = $1 and customer_user_id = $2`,
        [invoiceId, customerUserId],
      )
      if (invRes.rows.length === 0) {
        throw new NotFoundException('Invoice not found')
      }

      const inv = invRes.rows[0]
      if (inv.status === 'PAID') {
        throw new BadRequestException('Invoice is already paid')
      }

      const payRes = await client.query(
        `insert into fin.payments (
          invoice_id, customer_user_id, amount_santim, method,
          provider, status, customer_reference, notes
        ) values ($1, $2, $3, $4, 'MANUAL', 'PENDING_CONFIRMATION', $5, $6)
        returning id, status, amount_santim, method, created_at`,
        [
          invoiceId,
          customerUserId,
          input.amount_santim || inv.total_santim,
          input.method,
          input.customer_reference || null,
          input.notes || null,
        ],
      )
      const payment = payRes.rows[0]

      await client.query('commit')
      return {
        ...payment,
        message: 'Your payment claim has been submitted. Our finance team will verify it against the statement.',
        expected_confirmation_hours: 24,
      }
    } catch (err) {
      await client.query('rollback')
      throw err
    } finally {
      client.release()
    }
  }

  async listAllPayments(statusFilter?: string) {
    let query = `
      select
        p.id, p.amount_santim, p.method, p.status,
        p.customer_reference, p.notes, p.created_at, p.confirmed_at,
        i.invoice_number, i.total_santim,
        c.full_name as customer_name, c.phone_e164 as customer_phone
      from fin.payments p
      join auth.users c on c.id = p.customer_user_id
      left join fin.invoices i on i.id = p.invoice_id
    `
    const params: string[] = []
    if (statusFilter) {
      query += ` where p.status = $1`
      params.push(statusFilter)
    }
    query += ` order by p.created_at desc limit 50`

    const { rows } = await this.pool.query(query, params)
    return rows
  }

  async confirmPayment(paymentId: string, adminUserId: string, note?: string) {
    const client = await this.pool.connect()
    try {
      await client.query('begin')

      const payRes = await client.query(
        `update fin.payments
         set status = 'CONFIRMED', confirmed_by = $1, confirmed_at = now(), notes = coalesce(notes, '') || ' ' || coalesce($2, '')
         where id = $3
         returning id, invoice_id, amount_santim`,
        [adminUserId, note || '', paymentId],
      )
      if (payRes.rows.length === 0) {
        throw new NotFoundException('Payment not found')
      }
      const payment = payRes.rows[0]

      if (payment.invoice_id) {
        await client.query(
          `update fin.invoices
           set status = 'PAID', paid_santim = paid_santim + $1, paid_at = now(), updated_at = now()
           where id = $2`,
          [payment.amount_santim, payment.invoice_id],
        )
      }

      await client.query('commit')
      return { success: true, status: 'CONFIRMED', message: 'Payment confirmed and invoice marked as PAID' }
    } catch (err) {
      await client.query('rollback')
      throw err
    } finally {
      client.release()
    }
  }
}
