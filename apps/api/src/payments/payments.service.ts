import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { createHmac, randomBytes } from 'crypto'
import { Pool } from 'pg'
import { PG_POOL } from '../db/db.module'
import { EventsService } from '../events/events.service'

export interface PaymentClaimInput {
  amount_santim: number
  method: 'TELEBIRR' | 'CBE_BIRR' | 'BANK_TRANSFER' | 'CASH' | 'OTHER'
  customer_reference?: string
  notes?: string
}

export interface CreateTelebirrOrderInput {
  amount_etb?: number
  amount_santim?: number
  phone_e164?: string
  purpose?: 'CAREGIVER_REGISTRATION' | 'CUSTOMER_INVOICE'
  invoice_id?: string
  request_id?: string
  title?: string
}

export interface AuthorizeTelebirrOrderInput {
  prepay_id?: string
  merch_order_id?: string
  telebirr_phone: string
  pin: string
  amount_etb?: number
  amount_santim?: number
  purpose?: 'CAREGIVER_REGISTRATION' | 'CUSTOMER_INVOICE'
  invoice_id?: string
  request_id?: string
}

interface SandboxTelebirrOrder {
  prepay_id: string
  merch_order_id: string
  short_code: string
  merchant_name: string
  amount_santim: number
  amount_etb: number
  currency: 'ETB'
  phone_e164: string
  purpose: 'CAREGIVER_REGISTRATION' | 'CUSTOMER_INVOICE'
  invoice_id?: string
  request_id?: string
  title: string
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  receipt_number?: string
  signature?: string
  created_at: string
  paid_at?: string
}

@Injectable()
export class PaymentsService {
  private readonly sandboxOrders = new Map<string, SandboxTelebirrOrder>()

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(EventsService) private readonly eventsService: EventsService,
  ) {}

  getTelebirrSandboxConfig() {
    return {
      sandbox_enabled: true,
      provider: 'ETHIO_TELECOM_TELEBIRR_SANDBOX',
      merchant_name: 'Pillar Home Care Health Network',
      short_code: process.env.TELEBIRR_SHORT_CODE || '884210',
      ussd_shortcode: '*127#',
      fabric_app_id: process.env.TELEBIRR_FABRIC_APP_ID || 'SANDBOX-FABRIC-APP-2026',
      test_credentials: {
        approve_pin: '1234',
        insufficient_funds_pin: '0000',
        user_cancel_pin: '9999',
      },
    }
  }

  async createTelebirrSandboxOrder(input: CreateTelebirrOrderInput) {
    let amountSantim = Number(input.amount_santim) || 0
    if (!amountSantim && input.amount_etb) {
      amountSantim = Math.round(Number(input.amount_etb) * 100)
    }

    let invoiceId = input.invoice_id
    let requestId = input.request_id
    let title = input.title || 'Pillar Home Care Telebirr Payment'

    // If linked to an invoice or request, look up exact balance from DB
    if (invoiceId || requestId) {
      const invRes = await this.pool.query(
        `select id, request_id, invoice_number, total_santim, paid_santim, status
         from fin.invoices
         where ($1::uuid is not null and id = $1::uuid)
            or ($2::uuid is not null and request_id = $2::uuid)
         order by created_at desc limit 1`,
        [invoiceId || null, requestId || null],
      )
      if (invRes.rows[0]) {
        const inv = invRes.rows[0]
        invoiceId = inv.id
        requestId = inv.request_id
        const remaining = Math.max(0, Number(inv.total_santim) - Number(inv.paid_santim || 0))
        if (!amountSantim && remaining > 0) {
          amountSantim = remaining
        } else if (!amountSantim) {
          amountSantim = Number(inv.total_santim)
        }
        title = `Pillar Home Care Invoice ${inv.invoice_number}`
      }
    }

    if (!amountSantim || amountSantim <= 0) {
      const feeRes = await this.pool.query(
        `select setting_value from fin.system_settings where setting_key = 'caregiver_registration_fee'`,
      )
      const feeVal = feeRes.rows[0]?.setting_value
      amountSantim = Number(feeVal?.fee_santim) || 50000
    }

    const amountEtb = Math.round(amountSantim) / 100
    const randHex = randomBytes(3).toString('hex').toUpperCase()
    const ts = Date.now().toString().slice(-8)
    const prepayId = `PREPAY-TB-${ts}-${randHex}`
    const merchOrderId = `HC-ORD-${ts}-${randHex.slice(0, 4)}`
    const shortCode = process.env.TELEBIRR_SHORT_CODE || '884210'
    const phone = (input.phone_e164 || '0911000000').trim()

    const order: SandboxTelebirrOrder = {
      prepay_id: prepayId,
      merch_order_id: merchOrderId,
      short_code: shortCode,
      merchant_name: 'Pillar Home Care Health Network',
      amount_santim: amountSantim,
      amount_etb: amountEtb,
      currency: 'ETB',
      phone_e164: phone,
      purpose: input.purpose || (invoiceId || requestId ? 'CUSTOMER_INVOICE' : 'CAREGIVER_REGISTRATION'),
      invoice_id: invoiceId,
      request_id: requestId,
      title,
      status: 'PENDING',
      created_at: new Date().toISOString(),
    }

    this.sandboxOrders.set(prepayId, order)

    return {
      ...order,
      sandbox_mode: true,
      ussd_prompt: `USSD Push (*127#) to ${phone}: Confirm payment of ETB ${amountEtb.toFixed(2)} to ${order.merchant_name} (Shortcode: ${shortCode}). Enter Telebirr PIN:`,
      test_pins: {
        approve: '1234',
        insufficient_funds: '0000',
        cancel: '9999',
      },
    }
  }

  async authorizeTelebirrSandboxOrder(input: AuthorizeTelebirrOrderInput, userId?: string) {
    const pin = (input.pin || '1234').trim()
    if (pin === '0000') {
      throw new BadRequestException(
        'Telebirr Sandbox: Insufficient wallet balance simulated (Test PIN 0000). Use PIN 1234 to approve.',
      )
    }
    if (pin === '9999') {
      throw new BadRequestException(
        'Telebirr Sandbox: USSD Push session cancelled by user (Test PIN 9999). Use PIN 1234 to approve.',
      )
    }
    if (pin.length < 4) {
      throw new BadRequestException('Please enter a valid 4-digit Telebirr PIN (e.g. 1234).')
    }

    let order = input.prepay_id ? this.sandboxOrders.get(input.prepay_id) : undefined
    if (!order) {
      const created = await this.createTelebirrSandboxOrder({
        amount_etb: input.amount_etb,
        amount_santim: input.amount_santim,
        phone_e164: input.telebirr_phone,
        purpose: input.purpose,
        invoice_id: input.invoice_id,
        request_id: input.request_id,
      })
      order = this.sandboxOrders.get(created.prepay_id)!
    }

    const now = new Date()
    const yymmdd = now.toISOString().slice(2, 10).replace(/-/g, '')
    const receiptSuffix = randomBytes(3).toString('hex').toUpperCase()
    const receiptNumber = `TB${yymmdd}${receiptSuffix}`
    const secret = process.env.TELEBIRR_APP_SECRET || 'telebirr-sandbox-secret-2026'
    const signature = createHmac('sha256', secret)
      .update(`${order.prepay_id}|${order.merch_order_id}|${receiptNumber}|${order.amount_santim}`)
      .digest('hex')

    order.status = 'COMPLETED'
    order.receipt_number = receiptNumber
    order.signature = signature
    order.paid_at = now.toISOString()

    // If this is a customer invoice payment, record and confirm the payment in PostgreSQL immediately
    let settledInvoice: any = null
    if (order.purpose === 'CUSTOMER_INVOICE' || order.invoice_id || order.request_id || input.invoice_id || input.request_id) {
      const targetInvoiceId = order.invoice_id || input.invoice_id || null
      const targetRequestId = order.request_id || input.request_id || null

      const client = await this.pool.connect()
      try {
        await client.query('begin')
        const invRes = await client.query(
          `select id, invoice_number, customer_user_id, request_id, total_santim, paid_santim, status
           from fin.invoices
           where ($1::uuid is not null and id = $1::uuid)
              or ($2::uuid is not null and request_id = $2::uuid)
           order by created_at desc limit 1`,
          [targetInvoiceId, targetRequestId],
        )

        if (invRes.rows[0]) {
          const inv = invRes.rows[0]
          const payAmount = order.amount_santim || Number(inv.total_santim)
          const customerId = inv.customer_user_id || userId

          const payInsert = await client.query(
            `insert into fin.payments (
               invoice_id, customer_user_id, amount_santim, method,
               provider, status, provider_reference, customer_reference,
               payment_type, notes, confirmed_at, created_at, updated_at
             ) values ($1, $2, $3, 'TELEBIRR', 'TELEBIRR', 'CONFIRMED', $4, $5, 'SERVICE_INVOICE', $6, now(), now(), now())
             returning id`,
            [
              inv.id,
              customerId,
              payAmount,
              receiptNumber,
              input.telebirr_phone || order.phone_e164,
              `Telebirr Sandbox Instant Checkout (${order.merch_order_id})`,
            ],
          )

          const newPaidSantim = Math.min(
            Number(inv.total_santim),
            Number(inv.paid_santim || 0) + Number(payAmount),
          )
          const newStatus = newPaidSantim >= Number(inv.total_santim) ? 'PAID' : 'PARTIALLY_PAID'

          const updInv = await client.query(
            `update fin.invoices
             set status = $1, paid_santim = $2, paid_at = now(), updated_at = now()
             where id = $3
             returning id, invoice_number, status, total_santim, paid_santim`,
            [newStatus, newPaidSantim, inv.id],
          )
          settledInvoice = updInv.rows[0]

          await client.query('commit')

          this.eventsService.emitToRole('ADMIN', 'PAYMENT_CONFIRMED', {
            payment_id: payInsert.rows[0]?.id,
            invoice_id: inv.id,
            invoice_number: inv.invoice_number,
            amount_santim: payAmount,
            amount_etb: Math.round(payAmount / 100),
            reference: receiptNumber,
            status: 'CONFIRMED',
          })

          if (customerId) {
            this.eventsService.emitToUser(customerId, 'PAYMENT_CONFIRMED', {
              payment_id: payInsert.rows[0]?.id,
              invoice_id: inv.id,
              invoice_number: inv.invoice_number,
              request_id: inv.request_id,
              amount_santim: payAmount,
              amount_etb: Math.round(payAmount / 100),
              reference: receiptNumber,
              status: newStatus,
              message: `Telebirr payment of ETB ${(payAmount / 100).toFixed(2)} confirmed (Ref: ${receiptNumber}).`,
            })
          }
        } else {
          await client.query('commit')
        }
      } catch (e) {
        await client.query('rollback')
        throw e
      } finally {
        client.release()
      }
    }

    return {
      prepay_id: order.prepay_id,
      merch_order_id: order.merch_order_id,
      receipt_number: receiptNumber,
      short_code: order.short_code,
      merchant_name: order.merchant_name,
      telebirr_phone: input.telebirr_phone || order.phone_e164,
      amount_santim: order.amount_santim,
      amount_etb: order.amount_etb,
      currency: 'ETB',
      status: 'COMPLETED',
      signature,
      paid_at: order.paid_at,
      invoice: settledInvoice,
      message: `Telebirr Sandbox payment of ETB ${order.amount_etb.toFixed(2)} authorized! Receipt: ${receiptNumber}`,
    }
  }

  async listCustomerInvoices(customerUserId: string) {
    const query = `
      select
        i.id, i.invoice_number, i.status, i.currency,
        i.subtotal_santim, i.discount_santim, i.surcharge_santim,
        i.total_santim, i.paid_santim, i.notes,
        i.issued_at, i.due_at, i.paid_at,
        i.request_id,
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
        `select id, total_santim, status, invoice_number from fin.invoices where id = $1 and customer_user_id = $2`,
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

      const custRes = await client.query(
        `select full_name, phone_e164 from auth.users where id = $1`,
        [customerUserId],
      )
      const customer = custRes.rows[0]

      await client.query('commit')

      this.eventsService.emitToRole('ADMIN', 'PAYMENT_CLAIM_SUBMITTED', {
        payment_id: payment.id,
        invoice_id: invoiceId,
        invoice_number: inv.invoice_number,
        amount_santim: payment.amount_santim,
        amount_etb: Math.round(Number(payment.amount_santim) / 100),
        method: payment.method,
        customer_reference: input.customer_reference,
        customer_name: customer?.full_name || 'Customer',
        customer_phone: customer?.phone_e164 || '',
      })

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
        p.customer_reference, p.provider_reference, p.payment_type, p.notes, p.created_at, p.confirmed_at,
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
         returning id, invoice_id, amount_santim, customer_user_id`,
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

      this.eventsService.emitToRole('ADMIN', 'PAYMENT_CONFIRMED', {
        payment_id: paymentId,
        invoice_id: payment.invoice_id,
        amount_santim: payment.amount_santim,
        status: 'CONFIRMED',
      })

      if (payment.customer_user_id) {
        this.eventsService.emitToUser(payment.customer_user_id, 'PAYMENT_CONFIRMED', {
          payment_id: paymentId,
          invoice_id: payment.invoice_id,
          amount_santim: payment.amount_santim,
          status: 'PAID',
          message: 'Your payment has been verified and confirmed by finance.',
        })
      }

      return { success: true, status: 'CONFIRMED', message: 'Payment confirmed and invoice marked as PAID' }
    } catch (err) {
      await client.query('rollback')
      throw err
    } finally {
      client.release()
    }
  }
}
