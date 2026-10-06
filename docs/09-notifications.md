# 09 — Notification System

## 1. Rules that override everything

1. **No patient health information in any notification body.** Not push, not SMS, not email, not
   a lock screen. The caregiver's phone may be unlocked in front of a patient; a customer's phone
   may be seen by a colleague. "Your visit is confirmed" passes. "Wound care visit for your mother
   Almaz at 14:00, Bole" does not.
2. **No patient name in the caregiver's notification body.** Use the appointment reference and the
   sub-city: "New visit 20 Oct, 09:00, Bole." The caregiver learns who they are seeing by opening
   the app, which requires authentication. This also prevents a leaked phone from disclosing your
   client list.
3. **No clinical values in SMS.** A vital sign or a diagnosis on a SMS gateway screen is a
   disclosure to whoever holds the phone.
4. **Enforce 1 in code.** A payload allowlist validated at write time per
   [06-data-model](06-data-model.md) § 10. A notification that fails validation is dropped and
   logged, not sent. Add a CI test with a deliberately clinical payload.
5. **Every notification is resolvable.** Deep-link to a screen. A notification the user cannot act
   on from is a notification that generates a phone call to your office.
6. **Every notification is individually rate-limited.** A webhook loop must not be able to text 500
   customers at once.

## 2. Channels

| Channel | Use | Reliability |
|---|---|---|
| In-app | Always-on record of everything that happened | Source of truth. Write every notification row |
| Push (FCM) | Everything time-sensitive | Unreliable on poor networks and backgrounded-killed apps |
| SMS | Time-critical only: offers, arrivals, critical incidents, appointment changes, payment due | Expensive per message; carrier-dependent; the channel that reaches a caregiver with no data |
| Email | Invoices, receipts, policy documents, monthly statements | Cheap, low urgency |
| Local notification | Scheduled reminders, scheduled on-device | Works offline |

**Priority rule:** if the outcome of a missed notification is operational harm, use SMS. If it is
inconvenience, push alone is enough. Concretely: caregiver offers → SMS + push. Caregiver
appointment reminder → push, with a local fallback. Customer payment reminder → push, then SMS on
the second reminder. Marketing → push, opt-in only.

## 3. Event matrix

`P` push · `S` SMS · `E` email · `A` in-app · `L` local (on-device)

### Customer

| Event | P | S | E | A | L | Timing |
|---|---|---|---|---|---|---|
| `REQUEST_SUBMITTED` | ● | ● | | ● | | Immediately; SMS confirms you got it |
| `REQUEST_REVIEWING` | ● | | | ● | | On dispatcher pickup |
| `REQUEST_NEEDS_INFO` | ● | ● | | ● | | Immediately — this blocks their booking |
| `REQUEST_APPROVED` | ● | | | ● | | On approval |
| `REQUEST_ASSIGNED` | ● | ● | | ● | | On assignment, with caregiver name |
| `REQUEST_CONFIRMED` | ● | | | ● | | On customer confirm or auto-confirm |
| `APPOINTMENT_REMINDER_24H` | ● | | | ● | ● | T-24 h |
| `APPOINTMENT_REMINDER_2H` | ● | | | ● | ● | T-2 h |
| `CAREGIVER_EN_ROUTE` | ● | | | ● | | On en route |
| `CAREGIVER_ARRIVED` | ● | | | ● | | On arrival |
| `VISIT_STARTED` | ● | | | ● | | On arrival |
| `VISIT_COMPLETED` | ● | | | ● | | On completion |
| `VISIT_NOT_CONFIRMED` | ● | | | ● | | T+6 h, no customer confirmation |
| `REVIEW_REQUESTED` | ● | | | ● | | T+1 h after completion |
| `INVOICE_ISSUED` | ● | | ● | ● | | On issue |
| `PAYMENT_DUE` | ● | | ● | ● | ● | On issue, and 3 days before due |
| `PAYMENT_OVERDUE` | ● | ● | | ● | | Configurable interval, max 3, then handoff to a human |
| `PAYMENT_CONFIRMED` | ● | | ● | ● | | On confirmation |
| `APPOINTMENT_CANCELLED` | ● | ● | | ● | | Immediately |
| `APPOINTMENT_RESCHEDULED` | ● | ● | | ● | | Immediately |
| `OFFER_EXPIRED_AND_REASSIGNED` | ● | ● | | ● | | When a new caregiver is assigned |
| `REQUEST_UNABLE_TO_FULFILL` | ● | ● | | ● | | Immediately, with alternatives |
| `FOLLOW_UP_REQUIRED` | ● | | | ● | | When the supervisor raises a follow-up |
| `INCIDENT_NOTICE` | ● | ● | | ● | | Per incident-notification policy |
| `DOCUMENT_REQUESTED` | ● | | | ● | | If policy requires documents |

### Caregiver

| Event | P | S | E | A | L | Timing |
|---|---|---|---|---|---|---|
| `CAREGIVER_STATUS_CHANGED` | ● | ● | ● | ● | | On approval, changes requested, rejection, suspension |
| `OFFER_RECEIVED` | ● | ● | | ● | ● | Immediately; SMS carries the response deadline |
| `OFFER_EXPIRING` | ● | | | ● | | 30 min before expiry |
| `OFFER_EXPIRED` | ● | | | ● | | On expiry |
| `OFFER_DECLINED` | ● | | | ● | | Confirms it was received |
| `APPOINTMENT_CONFIRMED` | ● | | | ● | ● | On confirmation |
| `APPOINTMENT_REMINDER_24H` | ● | | | ● | ● | T-24 h |
| `LEAVE_NOW` | ● | | | ● | ● | T − travel estimate − 10 min |
| `APPOINTMENT_CANCELLED` | ● | ● | | ● | | Immediately |
| `APPOINTMENT_RESCHEDULED` | ● | ● | | ● | | Immediately |
| `VISIT_NOT_STARTED` | ● | ● | | ● | | Start + 15 min |
| `VISIT_DEPARTURE_OVERDUE` | ● | | | ● | | End + 45 min |
| `VISIT_RECORD_MISSING` | ● | ● | | ● | | End + 6 h |
| `SYNC_PENDING` | ● | | | ● | | After 6 h unsynced |
| `INCIDENT_ACKNOWLEDGED` | ● | | | ● | | When a supervisor picks it up |
| `INCIDENT_CRITICAL` | ● | ● | | ● | | Immediate, plus escalation chain |
| `PAYMENT_PROCESSED` | ● | | ● | ● | | On payment run |
| `NEW_REVIEW` | ● | | | ● | | On publish |
| `ASSIGNMENT_REASSIGNED` | ● | | | ● | | When taken off a visit |

### Internal (staff)

| Event | P | S | E | A | Timing |
|---|---|---|---|---|---|
| `NEW_REQUEST` | ● | | | ● | Immediately |
| `REQUEST_OVER_2H_UNASSIGNED` | ● | ● | | ● | Hourly sweep |
| `ASSIGNMENT_EXPIRED` | ● | | | ● | On expiry |
| `NO_SHOW_DETECTED` | ● | ● | | ● | On detection |
| `CUSTOMER_CANCELLED_LATE` | ● | | | ● | On cancellation inside the window |
| `OUTSTANDING_BALANCE_OVER_THRESHOLD` | ● | | | ● | Daily |
| `PAYMENT_CLAIM_OVER_24H` | ● | | | ● | Daily |
| `LICENCE_EXPIRING_30D` | ● | | ● | ● | Nightly |
| `DOCUMENTATION_COMPLIANCE_BREACH` | ● | | | ● | Nightly |
| `OVERDUE_CAREGIVER_RECORD` | ● | | | ● | Hourly |

## 4. Templates

Stored in `notif.templates`, editable per channel and locale in the admin dashboard, with versioning.
Every new event requires `en` and `am` templates before it ships. An event with no template is
disabled, not sent with an empty body.

Variables use `{{name}}`. Available: `{{customer_first_name}}`, `{{caregiver_first_name}}`,
`{{service_name_en}}`, `{{service_name_am}}`, `{{scheduled_date}}`, `{{scheduled_time}}`,
`{{sub_city}}`, `{{request_reference}}`, `{{appointment_reference}}`, `{{amount}}`,
`{{response_deadline}}`, `{{expires_in}}`, `{{office_phone}}`.

### Examples

**`OFFER_RECEIVED` — SMS, en**
```
[Company] New visit offer. 20 Oct 09:00, 2h, Bole. Offer expires 13:00.
Accept in the app: {{deep_link}}
```
**`OFFER_RECEIVED` — SMS, am**
```
[Company] አዲስ ጉዞ ጥያቄ። 20 ኦክቶ 09:00፣ 2 ሰዓት፣ ቦሌ። ጥያቄው በ13:00 ያበቃል።
በአፕ ውስጥ ይቀበሉ: {{deep_link}}
```

**`REQUEST_ASSIGNED` — push, en**
```
Caregiver assigned
{{caregiver_first_name}} will visit on {{scheduled_date}} at {{scheduled_time}}.
```

**`VISIT_COMPLETED` — SMS, en**
```
[Company] Your visit on {{scheduled_date}} is complete. Invoice {{invoice_number}} is ready.
Pay: {{payment_instructions_short}}
```

**`INCIDENT_CRITICAL` — SMS, en**
```
[Company] URGENT: incident reported. Acknowledge now in the admin dashboard. {{deep_link}}
```

The incident SMS carries no clinical content. It tells a human to go look, where the access
control already governs them.

**Amharic review requirement.** A language mistake on a safety message is a safety incident. Have
the Amharic templates reviewed by a fluent speaker with healthcare familiarity before launch, and
have them sign off. Do not machine-translate the emergency and incident templates and ship them.

## 5. Delivery architecture

```
domain event (request.submitted, appointment.accepted, ...)
   └─► outbox table, written in the same transaction as the state change
        └─► dispatcher (separate process)
             ├─ resolves recipients and preferences
             ├─ loads the template for channel + locale
             ├─ renders, then validates the payload against the PHI allowlist
             ├─ enqueues per-channel jobs
             │    ├─ FCM (batched, 500 per call)
             │    ├─ SMS provider (queued, rate-limited per provider quota)
             │    └─ email provider
             └─ writes notif.notifications rows with delivery status
```

**Use the transactional outbox, not direct calls from the request handler.** If you push an SMS
inside the request transaction, the SMS provider's latency is now your API latency and your booking
request can fail because a notification failed. The outbox makes the state change atomic with the
intent to notify, and it survives a process restart.

**At-least-once delivery.** The outbox is at-least-once, so consumers must be idempotent on
`(event_id, channel)`. A customer receiving "your visit is confirmed" twice is worse than one
notification and a support ticket, but it is not catastrophic, so prefer availability over
exactly-once complexity.

## 6. Rates, quotas, and quiet hours

| Queue | Limit | On exceed |
|---|---|---|
| `push` | 10,000/min | Backpressure; do not drop silently |
| `sms` | Provider quota, typically 5–50/sec | Queue; alert if the backlog exceeds 10 min |
| `email` | 5,000/hour | Queue |
| Per-user per-event | 1 per 60 s | Suppress; log |
| Critical SMS | 20/hour per recipient | Allow through; a repeat critical alert is justified |

**Quiet hours** default 22:00–07:00 local. Push and in-app notifications are deferred, not
dropped. SMS is sent only for `INCIDENT_CRITICAL`, `APPOINTMENT_CANCELLED`, `OFFER_RECEIVED`,
`ASSIGNMENT_REASSIGNED`, and `APPOINTMENT_RESCHEDULED`. Implement quiet hours per channel, not per
event, and make the override list explicit.

**Kill switch.** Per-event and per-channel, from the admin dashboard, effective immediately. You
will need it the first time a template has a mistake in it, and it should not require a deploy.

## 7. Delivery tracking and user-facing state

Write a `notif.notifications` row for everything, including push the device never displayed. Fields
per [06-data-model](06-data-model.md) § 7.

The in-app notification centre is the user-visible record. It must not depend on push having
worked — on a caregiver with a flaky connection, push is often the channel that fails, and if the
caregiver's in-app inbox is also empty because the same network was down, they see nothing at all.

`GET /notifications` returns rows with `read_at`, `event_key`, a localized title and body, and a
`deep_link`. Tapping marks read and navigates.

Failure handling: after 3 failed SMS attempts, mark `FAILED` and alert an operator with the user
reference. A silently failed SMS to a caregiver is how a visit gets missed.

## 8. Push notification specifics

- FCM for Android, APNs via FCM for iOS. FCM is one implementation for both.
- Deep links encoded in the payload as a path, never a full URL, so a compromised link cannot
  redirect.
- `collapse_key` for `OFFER_RECEIVED` on the caregiver device so a stack of offers becomes one
  notification with a badge count, not ten rows.
- Android channel groups per audience: `bookings`, `visits`, `offers`, `alerts`, `payments`. A
  caregiver who mutes "offers" should still get a critical alert.
- iOS critical alerts require an entitlement from Apple. Do not assume it. Until approved, route
  critical caregiver alerts through SMS.
- Request notification permission at a moment with context, not at launch: after a caregiver
  accepts their first offer, or after a customer's first booking. A permission prompt with no
  context is declined, and you cannot ask twice.
- If permission is denied, fall back to SMS for time-critical events and say so in the app.
- Version-gate payloads so an old build does not receive a payload it cannot parse.

## 9. SMS specifics

- Use an established provider. Verify current APIs, pricing, and business-account requirements
  before committing — see [16-open-questions](16-open-questions.md).
- Encode as GSM-7 where possible; Ethiopic characters are not in GSM-7 and will cost more per
  segment. Amharic SMS cost roughly 2–3× a Latin message. Confirm with the provider.
- Keep SMS under 160 GSM-7 characters, or accept 3–4 segments for Amharic and shorten accordingly.
  Amharic SMS must be short enough not to be expensive.
- Include a short, recognisable sender ID. Confirm whether alphanumeric sender IDs are available
  from your provider.
- Include a phone-based deep link: `https://{domain}/s/{token}` resolving to the in-app screen.
  This is what makes a caregiver act on an SMS without hunting for the app.
- Deduplicate against recent sends for the same phone and event.
- Never log message bodies. Log reference, recipient hash, provider id, and status.

## 10. Amharic and English handling

- `notif.templates` has a `locale` column; `en` is mandatory, `am` is mandatory before launch for
  all customer- and caregiver-facing events.
- Recipient locale: `users.preferred_language`, falling back to device locale at registration,
  then `en`.
- **When no translation exists for a user's locale, fall back to `en` and record the miss** in a
  metric. A silent fallback means you never learn you have gaps.
- Mixed-language content: never generate an Amharic sentence containing an English service name.
  Service names are stored bilingually precisely so this does not happen.
- Amharic numerals: keep numerals in Latin digits (`2 ሰዓት`) for consistency with the rest of the
  UI and to avoid font fallback problems on low-end Android. Check this renders correctly on the
  cheapest devices you can find before launch.
- The emergency screen defaults to Amharic regardless of app language, as specified in
  [03-customer-app-spec](03-customer-app-spec.md) § C22.

## 11. Operational dashboards and alerting

Metrics per event and channel:

| Metric | Purpose |
|---|---|
| Queued, sent, delivered, failed by event and channel | Health |
| Delivery latency p50 and p95 by channel | Detect provider degradation |
| SMS backlog depth and age | Provider throttle detection |
| Outbox age (oldest unprocessed) | The single best indicator of a stalled dispatcher |
| PHI-allowlist rejections | Should be zero; any occurrence is a bug to fix immediately |
| Quiet-hour deferral count | Capacity planning |
| Per-user notification volume | Complaint early-warning |

Alerts:

| Condition | Threshold |
|---|---|
| Outbox age | > 5 min |
| SMS backlog | > 500 messages or > 10 min old |
| Push failure rate | > 5% over 15 min |
| Any PHI-allowlist rejection | 1 |
| Scheduler heartbeat missing | 2 min |
| Delivery rate drop vs 7-day baseline | 30% |

## 12. What to cut if notifications prove expensive

SMS is the main cost. If it becomes painful, in this order:

1. Drop SMS for `REQUEST_SUBMITTED` and `PAYMENT_DUE`; keep it only for offers, changes, and
   critical incidents. Customers tolerate not being told their request arrived.
2. Batch caregiver appointment reminders into a daily digest plus a same-morning SMS for the next
   day's visits.
3. Move to push-only for customers, who have reliable data, and keep SMS for caregivers, who may
   not.

Do not cut SMS for offer deadlines or critical incidents. Those two are where SMS earns its cost,
because missing them means a missed visit or an unhandled incident.