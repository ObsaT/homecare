# 10 — Payments & Pricing

## 1. Decision: manual payment recording in v1

No gateway integration ships in the first release. The customer sees a quote, sees an invoice,
and pays by whatever means already works in Addis Ababa. Your Finance person records the payment
against the invoice in the dashboard. The app shows the resulting balance.

**Why this is right for v1:**

- A gateway needs a registered business, merchant onboarding, settlement agreements, and often a
  volume history. That is weeks of work with a business that has not yet delivered a visit.
- Manual recording starts working on day one and gets better with process, not with engineering.
- The failure mode is a human forgetting to record a payment. That is a solvable operations problem
  with a reconciliation report.
- The schema is already built so the integration is additive. See § 8.

**What you must build so this does not leak money:**

- Every customer claim is queued and acknowledged within one business day
- An unmatched-claims report
- An overdue-invoices report with escalation
- Cash reconciliation: `payments` recorded by method against the bank statement and cash box
- A rule that **Finance, not the customer, confirms a payment.** A customer claim is a claim, not a
  payment.

This is also the honest position for customers. "Pay by bank transfer and we will confirm within
one business day" is a worse experience than a card, but it is one you can actually deliver on day
one. Do not promise a gateway you have not integrated.

## 2. Money representation

**All amounts are integers in santim (ETB cents).** `1 ETB = 100 santim`.

```json
{ "total_santim": 180000, "currency": "ETB" }   // ETB 1,800.00
```

Never use floats for money. A float cannot represent 0.10 exactly, and in a system that sums
hundreds of line items per invoice, the error accumulates into reconciliation failures you cannot
explain to an accountant. Store integers, add integers, format only at the presentation edge.

Formatting rules:

- Display `ETB 1,800.00` — thousands separators, two decimals, `ETB` prefix
- Format via `Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB' })`, verified
  against the Ethiopian locale rather than assumed
- Amharic UI shows the same numerals in Latin digits, for consistency with the rest of the app
- VAT and tax status: confirm with your accountant before charging. Healthcare service VAT treatment
  in Ethiopia needs a professional answer, and the answer may differ between clinical and
  non-clinical services. Until confirmed, `tax_santim` is zero and no line item claims otherwise.

## 3. Pricing model

Configurable per service in `catalog.services` and `catalog.service_prices`. The price model is
admin-editable with effective dating, so you never need a deploy to change prices and you never
retroactively change what a customer was quoted.

### Billing units

| Unit | Use for | Behaviour |
|---|---|---|
| `PER_VISIT` | Short, defined tasks: wound care, physio | Flat price. Duration still recorded |
| `PER_HOUR` | Nursing, personal care, feeding, vitals | Rate × billable hours, with `min_units` |
| `PER_DAY` | Elderly care, post-hospital care | Flat daily rate for a band of hours |
| `PER_SESSION` | Packages, bundles | Fixed, from `care_packages` |

### Duration bands

The mechanism that lets you charge a 12-hour shift fairly without a complex formula.

```json
{ "bands": [
  { "from_minutes": 0,  "to_minutes": 60,   "amount_santim": 60000,  "unit": "PER_VISIT" },
  { "from_minutes": 60, "to_minutes": 120,  "amount_santim": 100000, "unit": "PER_VISIT" },
  { "from_minutes": 120,"to_minutes": 240,  "amount_santim": 180000, "unit": "PER_VISIT" },
  { "from_minutes": 240,"to_minutes": 480,  "amount_santim": 330000, "unit": "PER_VISIT" },
  { "from_minutes": 480,"to_minutes": null, "amount_santim": 600000, "unit": "PER_VISIT" }
] }
```

The customer sees this as a small table on C9. Transparency on price bands is worth more than
optimising them: a customer who does not understand why a longer visit costs more feels
overcharged, and calls you about it.

### Surcharges

| Surcharge | Default | Configurable |
|---|---|---|
| Night (21:00–06:00) | +20% | Yes, and the window itself |
| Weekend (Sat, Sun) | +10% | Yes |
| Public holiday | +15% | Yes, against the Ethiopian holiday calendar |
| Urgent (24 h) | +15% | Yes |
| Urgent (same day) | +25% | Yes |
| Transport | Fixed per sub-city, ETB 0–200 | Per sub-city, from a table |
| Additional hour beyond booked | Hourly rate +50% | Requires prior customer approval |
| Cancellation inside 24 h | 50% of the service fee | Yes |
| Caregiver no-show | Refund in full, no cancellation fee | Generally fixed by policy |

Holiday handling: store Ethiopian public holidays as a table with date and name in both languages,
maintained by an Admin. A moving religious holiday calendar is a recurring maintenance item — set a
reminder each year to confirm the dates rather than assuming the Gregorian date holds.

### Caregiver pay

Configurable per caregiver in `ops.caregiver_settings`: `PER_HOUR`, `PER_VISIT`, or `PER_SHIFT`.
Default `PER_HOUR` with a minimum visit guarantee. `PER_SHIFT` for long bookings, because paying a
caregiver by the hour for a 12-hour shift generates payables nobody wants to reconcile.

Pay is created on visit completion (`fin.caregiver_payables`), approved in a payment run, then paid.
A caregiver's pay must not depend on the customer having paid. If they are both right, collect
from the customer; do not hold the caregiver's money hostage to a receivables problem.

## 4. Quote lifecycle

Three distinct concepts. Conflating them is how billing disputes start.

| Stage | Owner | Mutable | Meaning |
|---|---|---|---|
| **Estimate** | System | Recomputed freely | Indicative, from current prices. Not a commitment |
| **Quote** | System | Frozen at issue | A price issued to the customer for a specific visit. Held on the appointment |
| **Invoice** | Finance | Only via issue, void, adjust | A billing document with a number. Legally operative |

```text
Booking (C7 step 6)        → estimate  (displayed, explicitly marked an estimate)
Request approved           → quote     (frozen on the appointment, expires with the quote validity)
Visit completed            → invoice   (DRAFT, priced from the frozen quote)
Finance issues             → invoice   (ISSUED, numbered, customer notified)
Customer pays              → payment   (PENDING_CONFIRMATION, then CONFIRMED)
Paid in full               → invoice   (PAID), request → CLOSED
```

**The quote freezes the price.** If you change `catalog.service_prices`, existing appointments keep
their quoted price. Otherwise you can change prices mid-week and a customer's confirmed visit costs
something different from what they agreed to.

`price_breakdown` is stored as JSONB on the appointment, structured so it can also be written to
`invoice_lines` at issue time. Store enough structure to reconstruct the invoice without
recomputing.

### Quote validity

Default 48 hours for future visits, 4 hours for same-day. After expiry, a change to duration,
service, or address requires re-quoting. The app says "Price confirmed" or "Price may have changed"
rather than silently repricing.

## 5. Discounts

`discount_santim` on the invoice, expressed as a line item with a stated reason, applied by an
Admin or Dispatcher with the permission, and audited with the actor. No percentage discount field
silently changing a total — the reason is the point.

Vouchers, if you run them, are separate: `promo_codes` with a code, a value type (`PERCENT` or
`FIXED`), a validity window, a max-uses, a per-customer limit, and a stackable flag. Applied at
quote time and carried onto the invoice line, so the discount is visible to Finance.

## 6. Manual payment flow

```
Customer pays by transfer or cash
   │
   ├─ Customer claims it in the app (C16)
   │    POST /invoices/{id}/payment-claim
   │    → fin.payments { status: PENDING_CONFIRMATION, customer_reference, receipt photo }
   │    → Finance queue, notification to Finance
   │
   ├─ Finance matches against the bank statement or the cash box
   │    POST /admin/payment-claims/{id}/confirm
   │    → fin.payments { status: CONFIRMED, confirmed_by, confirmed_at }
   │    → recompute invoice paid_santim and status
   │    → notify the customer PAYMENT_CONFIRMED
   │
   ├─ Finance rejects
   │    POST /admin/payment-claims/{id}/reject { reason }
   │    → payment FAILED with the reason
   │    → notify the customer with the reason and the correct reference format
   │
   └─ Or Finance records it directly, without a customer claim
        POST /admin/payments
        → same rows, `recorded_by` = the Finance user
```

Reconciliation rule: an amount matched by reference and date. If the customer says they paid
ETB 1,800 and the statement shows ETB 1,800 from an unrecognised reference, that is a legitimate
match once Finance confirms. Do not auto-match on amount alone; two customers can easily pay the
same amount.

### Payment statuses

| Status | Meaning | Who sets it |
|---|---|---|
| `PENDING_CONFIRMATION` | Claimed or recorded, not yet verified | Customer claim, or Finance recording |
| `CONFIRMED` | Verified against a statement or the cash box | Finance only |
| `FAILED` | Claim rejected, with a reason | Finance |
| `REVERSED` | Was confirmed, then reversed. Reason mandatory, audited | Finance |

**Reversal, not deletion.** A payment record is never deleted. `fin.payments` is append-only apart
from status transitions, and every transition is audited with the actor. An accountant who cannot
reconcile a ledger because rows vanished will stop trusting the system entirely.

## 7. Invoice lifecycle

```
DRAFT ──issue──► ISSUED ──partial payment──► PARTIALLY_PAID ──full──► PAID
  │                  │                              │                    │
  │                  └──► OVERDUE (if past due_at)  │                    │
  │                                                         refund ──────┘
  └──► VOID (any time before payment, reason mandatory)
```

Plus `DISPUTED` reachable from `ISSUED`, `PARTIALLY_PAID`, or `OVERDUE`, and `REFUNDED` from
`PAID`. Disputed invoices are excluded from revenue reporting and appear on a dedicated report, so
a disputed invoice never quietly inflates or deflates your numbers.

Voiding an issued invoice requires `ADMIN` or `FINANCE`, a reason, and:
- Not permitted once any confirmed payment exists — reverse the payment first, then void
- The customer is notified with the reason
- The visit remains `COMPLETED`; voiding a billing document does not undo care delivered

### Invoicing cadence

| Request type | Invoice timing |
|---|---|
| One-time | On visit completion |
| Recurring, short visits | Per visit |
| Recurring, long shifts | Weekly or monthly aggregate, per `billing` on the request |
| Package / prepaid | On purchase, as an advance; services draw it down |

Prepaid balances: `fin.invoices` with `status = PAID` creates a customer credit applied to
subsequent invoices. Track it as an `ADVANCE` line item, not as negative revenue.

## 8. Gateway seam for phase 2

The schema is built so a gateway is an implementation of one interface, not a redesign.

```ts
export interface PaymentProvider {
  name(): 'TELEBIRR' | 'CBE_BIRR' | 'CARD' | 'MANUAL';
  createPaymentIntent(input: {
    invoiceId: string;
    amountSantim: number;        // integer santim, never a float
    customerPhoneE164: string;   // gateways here are mobile-first
    reference: string;
    description: string;
    callbackUrl: string;
  }): Promise<{ intentId: string; status: string; clientPayload?: unknown }>;

  verifyWebhook(headers: Record<string, string>, rawBody: Buffer):
    Promise<{ valid: boolean; providerReference: string; intentId: string;
               amountSantim: number; status: string }>;

  getStatus(intentId: string): Promise<{ status: string; amountSantim: number }>;

  refund(input: { paymentId: string; amountSantim: number; reason: string }):
    Promise<{ refundId: string; status: string }>;
}
```

Requirements when you add one:

1. **Amounts as integers, converted to the gateway's expected unit only at the boundary.** Telebirr
   amounts are in cents too, but verify.
2. **Webhook signature verification against the raw body.** Do not verify a re-serialised JSON body.
3. **Webhook idempotency** on `provider_reference`. Gateways retry; you must not double-apply.
4. **Outbound reconciliation.** Nightly job comparing gateway settlement reports against
   `fin.payments`. Discrepancies alert Finance.
5. **Never trust the client's success callback.** Only a verified webhook, or an active status
   query, can move a payment to `CONFIRMED`.
6. **A gateway timeout is not a payment failure.** Query status before offering retry, or you will
   double-charge a customer. This is the single most common integration bug in payments.
7. **Sandbox testing before live.** Run a full lifecycle in the sandbox with real edge cases:
   timeout, duplicate webhook, out-of-order webhook, partial capture, refund, dispute.

Before choosing a provider, verify current APIs, fees, settlement cycles, merchant-account
requirements, and business-registration prerequisites. See
[16-open-questions](16-open-questions.md). Do not let a developer pick a provider by convenience of
the sandbox.

## 9. Reports

| Report | Contents |
|---|---|
| Revenue | By day, week, service, sub-city, caregiver; gross, net of refunds, discounts, surcharges |
| Outstanding | By age bucket: current, 1–7 d, 8–30 d, 30+ d |
| Overdue | With customer contact, invoice link, escalation state |
| Payment claims | Pending, confirmed, rejected, and time to confirmation |
| Unmatched payments | Confirmed payments with no invoice, or no reference match |
| Refunds | By reason and approver |
| Caregiver payables | By period and caregiver, with payment-run status |
| Margin | Revenue minus caregiver cost minus transport, per visit and per service |
| Average days to pay | The number that tells you whether your customers' behaviour matches your policy |
| Price change audit | Every price change with the actor, date, and before/after |

## 10. Money handling rules

1. Integer santim everywhere. No floats, no decimal strings in arithmetic.
2. Server-authoritative pricing. The client displays a quote; it never computes a binding total.
3. Every amount that changes state is written inside a transaction that also writes the audit row.
4. Payments are never deleted. Reversal only, with a reason and an actor.
5. Prices are effective-dated. Never overwrite a price row that a quote or invoice has referenced.
6. Every adjustment has a reason and an actor.
7. Finance is the only role that can confirm, reverse, or void a financial document.
8. Reconcile daily, not monthly. The cost of an unreconciled month is a week of work.
9. Invoice numbers are sequential, never reused, and gapless within a period. Gaps look like
   tampering to an auditor. Use a database sequence, not `max(invoice_number) + 1`.
10. Test every rounding path. Band boundaries, partial payments, refunds that straddle a band, and
    the santim-to-etB conversion are exactly where a rounding bug hides.

## 11. Launch prerequisites

Before the first real payment:

- [ ] Business account open with the chosen bank
- [ ] Mobile-money merchant account (Telebirr, CBE Birr) — can wait until phase 2, but open it
- [ ] Written cancellation and refund policy, published in the app
- [ ] Written overtime-billing policy, since it requires customer approval
- [ ] Confirmed VAT and tax treatment, from an accountant
- [ ] Price list signed off, and loaded into `catalog.service_prices` with effective dates
- [ ] Surcharge percentages approved
- [ ] Transport charges per sub-city, based on real numbers from your first month
- [ ] Finance user trained on the claim queue and the reconciliation report
- [ ] Receipt template with your logo and tax details
- [ ] Written policy on what happens when a customer disputes a bill

Confirm whether your services attract VAT or any other tax before charging. Charging the wrong tax
is an obligation you cannot unwind by being customer-friendly about it later.