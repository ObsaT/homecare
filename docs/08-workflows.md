# 08 — Workflows & State Machines

The heart of the system. If a developer reads one document, this should be it. Status values match
`ops.request_status` and `ops.appointment_status` in [06-data-model](06-data-model.md).

## 1. Two entities, two machines

A **request** is the customer's intent to receive care. An **appointment** is one scheduled,
assignable visit. A one-time booking produces one request and one appointment. A recurring booking
produces one request and N appointments, each assigned, each attended, each billed independently.

This split is the single most important modelling decision in the platform. It is what lets a
customer skip week 3 of an 8-week series without cancelling the series, lets you reassign one
visit, and lets each visit have its own visit record, invoice, and payment.

**The request's status is always derived from its appointments.** Never set them independently and
never let them drift. Define the aggregation rule and apply it in one place, inside the same
transaction as the appointment change.

### Derivation rules

| Appointment statuses | Request status |
|---|---|
| All `PENDING` / `OFFERED` | `APPROVED` |
| All `CANCELLED` | `CANCELLED` |
| Any `ACCEPTED`, rest `PENDING` / `OFFERED` | `ASSIGNED` (all accepted) or `APPROVED` (mixed) |
| All `ACCEPTED` | `ASSIGNED` |
| Any `EN_ROUTE` | `EN_ROUTE` |
| Any `IN_PROGRESS` | `IN_PROGRESS` |
| All `COMPLETED` | `COMPLETED` |
| Mixed `COMPLETED` and future `PENDING` / `ACCEPTED` / `OFFERED` | `CONFIRMED` |
| Mixed `COMPLETED` and `CANCELLED` | `CONFIRMED` |
| Every appointment `UNABLE_TO_FULFILL` | `UNABLE_TO_FULFILL` |

## 2. Request state machine

```
   DRAFT
     │  submit (customer)
     ▼
  SUBMITTED ──────────────────────────────┐
     │  dispatcher picks up                │  dispatcher: unable to fulfill
     ▼                                    ▼
 UNDER_REVIEW ──────────────────────► UNABLE_TO_FULFILL ──► CLOSED
     │                                 (alternatives offered)
     │  dispatcher: need more info
     ▼
 NEEDS_INFO ──────────────────────────► UNDER_REVIEW
     │  customer answers
     │
     ▼
 UNDER_REVIEW
     │  dispatcher approves
     ▼
  APPROVED ───────────────────► (appointments created)
     │  first appointment assigned
     ▼
  ASSIGNED
     │  customer confirms / caregiver accepts
     ▼
  CONFIRMED
     │  caregiver marks en route
     ▼
   EN_ROUTE
     │  caregiver marks arrived
     ▼
  IN_PROGRESS
     │  caregiver completes
     ▼
  COMPLETED ──► invoice issued ──► CLOSED
```

Cancellation is available from `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `NEEDS_INFO`, `APPROVED`,
`ASSIGNED` and `CONFIRMED`. Once `EN_ROUTE` or `IN_PROGRESS`, cancellation is no longer a customer
option — a dispatcher must cancel with a reason. This boundary exists because the caregiver has
already travelled or is already in the home.

### Transition table

| From | To | Actor | Guard conditions |
|---|---|---|---|
| `DRAFT` | `SUBMITTED` | Customer | All required fields present; consent recorded; lead-time rule satisfied |
| `SUBMITTED` | `UNDER_REVIEW` | Dispatcher | — |
| `SUBMITTED` | `UNABLE_TO_FULFILL` | Dispatcher | Reason and alternatives required |
| `UNDER_REVIEW` | `NEEDS_INFO` | Dispatcher | `info_request` non-empty |
| `NEEDS_INFO` | `UNDER_REVIEW` | Customer | `info_response` non-empty |
| `UNDER_REVIEW` | `APPROVED` | Dispatcher | Service active; caregiver capacity exists **or** dispatcher accepts a backlog |
| `APPROVED` | `ASSIGNED` | System | ≥1 appointment `ACCEPTED` and none `CANCELLED` |
| `ASSIGNED` | `CONFIRMED` | Customer or System | Customer confirms, or auto-confirm after 2 h |
| `CONFIRMED` | `EN_ROUTE` | Caregiver | Assignment accepted |
| `EN_ROUTE` | `IN_PROGRESS` | Caregiver | Arrival recorded; GPS within tolerance |
| `IN_PROGRESS` | `COMPLETED` | Caregiver | Visit record present or created in the same request |
| `COMPLETED` | `CLOSED` | System | Invoice issued and settled, or 30 days elapsed |
| any pre-en-route | `CANCELLED` | Customer / Dispatcher / System | Reason required; cancellation policy applied |
| `UNABLE_TO_FULFILL` | `SUBMITTED` | Customer | Customer selects an alternative |
| `UNABLE_TO_FULFILL` | `CLOSED` | System | After the alternative window |

An illegal transition returns `409 INVALID_STATE_TRANSITION` with the list of currently allowed
transitions. That is more useful than a generic error, and it makes the state machine testable from
the client side.

## 3. Appointment state machine

```
  PENDING ──offer──► OFFERED ──accept──► ACCEPTED ──en route──► EN_ROUTE
     ▲                  │                    │                     │
     │            decline/expire            │                arrive
     │                  ▼                    ▼                     ▼
     └──reopen── DECLINED / EXPIRED      CANCELLED           IN_PROGRESS
                                        NO_SHOW                 │
                                                               │ complete
                                                               ▼
                                                           COMPLETED
```

| From | To | Actor | Guards |
|---|---|---|---|
| `PENDING` | `OFFERED` | Dispatcher / System | Caregiver eligible, availability window covers the whole visit |
| `PENDING` | `ACCEPTED` | Dispatcher | Direct assign mode |
| `OFFERED` | `ACCEPTED` | Caregiver | `expires_at > now()`; no conflicting assignment; conditional update on `status = 'OFFERED'` |
| `OFFERED` | `DECLINED` | Caregiver | Reason required |
| `OFFERED` | `EXPIRED` | System | `expires_at < now()`; release other offers |
| `ACCEPTED` | `EN_ROUTE` | Caregiver | — |
| `EN_ROUTE` | `IN_PROGRESS` | Caregiver | Arrival recorded; GPS within 2 km or override reason |
| `IN_PROGRESS` | `COMPLETED` | Caregiver | Visit record submitted |
| any pre-`EN_ROUTE` | `CANCELLED` | Dispatcher / System | Reason; fee calculation; notification |
| `ACCEPTED` | `CANCELLED` | System | Caregiver suspended or licence expired |
| `ACCEPTED` | `NO_SHOW` | Dispatcher | Side recorded; grace period of 30 min elapsed |
| any | `UNABLE_TO_FULFILL` | Dispatcher | Reason; whole-series decision |

### Cancellation policy

Configurable, and the reason it must be configuration: your real cost is a wasted caregiver
journey, and the refund policy is a commercial decision that will change as you learn.

| When cancelled | Inside 24 h of start | More than 24 h out |
|---|---|---|
| Customer | 50% cancellation fee | No fee |
| Caregiver | No customer fee; caregiver forfeits a portion | No fee |
| Dispatcher, caregiver fault | Full refund | Full refund |
| Force majeure | Configurable percentage | No fee |

Fee is recorded as a `SURCHARGE`/`ADJUSTMENT` line on the invoice with the policy clause as the
explanation, never as an unexplained adjustment.

## 4. Assignment engine

### Eligibility

A caregiver is eligible for an appointment only if **all** are true:

1. `approval_status = 'APPROVED'`, `users.status = 'ACTIVE'`
2. `is_available = true` (live toggle, may differ from scheduled availability)
3. The service is in `ops.caregiver_services` for this caregiver
4. The caregiver's `professional_title` satisfies the service's `required_qualification`, and
   `requires_licence` is satisfied
5. `licence_expires_on >= appointment date` — **not** merely today. A licence expiring mid-week
   invalidates later visits in that week
6. An availability window or approved exception covers `[scheduled_start, scheduled_end]`
7. No overlapping appointment, and not in transit to another
8. `max_visits_per_day` not exceeded
9. Distance from the caregiver's home area to the address ≤ `notification_radius_km`
10. Not blocked by an unresolved incident with that customer
11. Optional: not the caregiver's own relative, and not a customer in the same household

Exclusion reasons are returned with the candidate list (`GET /admin/assignments/available`), never
silently dropped. See the reasoning in [07-api-contract](07-api-contract.md) § 8.

### Race condition

Parallel offers must not double-book:

```sql
update ops.appointments
   set status = 'ACCEPTED', caregiver_id = $1, updated_at = now()
 where id = $2 and status = 'OFFERED';
-- rowcount must be 1; 0 means another caregiver won the race
```

When rowcount is 0, return `409 CONFLICT` with the winning caregiver's first name only, and
notify the losing caregiver: "This visit has been taken by another caregiver. Sorry." Losing
racers should be told plainly. Silence looks like a broken app.

### Offer expiry

| Visit start | Offer window |
|---|---|
| Same day | 90 minutes |
| Next day or later | 4 hours |

Extendable by a dispatcher. On expiry, release sibling offers, move the appointment back to
`PENDING`, notify the dispatcher, and increment an unassigned-age metric. Prefer a dispatcher who
sees an expired offer over an automatic reassignment they did not sanction.

### Suggested ordering

Default sort for the suggestion list, in order:

1. Previously cared for this patient and the customer preferred the same caregiver
2. Sub-city match
3. Shortest travel time
4. Fewest visits already that day
5. Highest completion rate
6. Highest rating

Reassignment follows the same order, with a bias toward a caregiver who has worked with this
patient before. Care continuity is a clinical safety measure, not a convenience — a patient with
dementia who gets a different caregiver every week declines care. Implement "same caregiver as
last time" as a real preference with real weight, and expose it to the dispatcher.

## 5. Visit lifecycle

```
accepted → (reminder 24h) → (reminder 2h) → (leave-now prompt) → en_route → arrived → in_progress → completed
```

| Step | Trigger | Records | Notifies |
|---|---|---|---|
| Reminder 24 h | Scheduled job, `T-24h` | — | Customer, caregiver |
| Reminder 2 h | Scheduled job, `T-2h` | — | Customer, caregiver |
| Leave-now | Scheduled job, `T - travel - 10m` | — | Caregiver |
| No start alert | Scheduled job, `start + 15m`, status still `ACCEPTED` | — | Caregiver, dispatcher |
| Arrival overdue | Scheduled job, `start + 30m`, status still `EN_ROUTE` | — | Dispatcher |
| Departure overdue | Scheduled job, `end + 45m`, status still `IN_PROGRESS` | — | Dispatcher, caregiver |
| Record missing | Scheduled job, `end + 6h`, no visit record | Flag | Caregiver, dispatcher |
| Sync escalation | Scheduled job, 6 h without upload sync | Flag | Dispatcher |
| Completed | Caregiver | Visit record, patient/caregiver metrics, payables | Customer, billing |

Every scheduled job is idempotent and re-runnable. Deduplicate on `(appointment_id, event)`.

### Arrival verification

Tiered, strongest first:

1. **GPS proximity** — arrival within 2 km of the resolved address. Cheap, automatic, wrong on
   poor GPS. Treat as a signal, not proof.
2. **Customer arrival code** — the caregiver reads a 4-digit code, the customer enters it.
   Effective against a caregiver who marks arrival from home.
3. **Customer confirmation** — a post-visit confirmation checkbox in C13.
4. **Dispute resolution** — timestamps, GPS trace, and visit record as evidence.

Tier 2 is the one to build if you can only afford one, because it is the only one that involves
the customer and therefore survives a dispute.

## 6. Recurring bookings

Generated at request time, up to 30 occurrences. Beyond that, regenerate the next 10 occurrences
once fewer than 5 remain.

Per-occurrence independence:

| Action | Effect |
|---|---|
| Cancel one occurrence | Only that appointment. The series continues |
| Skip one occurrence | Appointment cancelled with reason `SKIPPED` |
| Reschedule one | Only that appointment |
| Reassign one | Only that appointment |
| Cancel the series | All future non-completed appointments cancelled, with a reason |
| Pause the series | No generation; future appointments set to `PENDING_PAUSED`, then `PENDING` on resume |

**Recurring and offline records.** At completion of occurrence *n*, fire the next-occurrence job
that ensures occurrence *n+1* exists (idempotent on `(request_id, occurrence_index)`) and, if the
service benefits from continuity, offers it to the caregiver who completed *n*. This is the
cheapest way to secure recurring revenue: the customer does not have to rebook, and the caregiver
is already on site.

**Continuity preference.** If the customer selected "same caregiver", *n+1* is assigned directly to
the caregiver who completed *n*, not offered. If they are unavailable, notify the dispatcher rather
than silently switching — an unexplained change of caregiver is exactly what generates a complaint.

## 7. Exception paths

### Caregiver no-show

Dispatcher marks `NO_SHOW` after the 30-minute grace period. In one transaction: cancel or
reassign the appointment, record the no-show against the caregiver's metrics, notify the customer
with an apology and a proposed replacement time, create a dispatcher task, and consider a service
credit if policy allows. Never leave a customer notified and unassigned.

### Caregiver sickness or no-show mid-visit

Caregiver reports they cannot attend. Reassignment engine runs with the sick caregiver excluded.
Customer gets a single consolidated update, not a chain. If no replacement exists within the
window, `UNABLE_TO_FULFILL` with alternatives and a refund decision.

### Customer no-show

Caregiver arrives, waits 15 minutes, then reports. Dispatcher confirms with the customer, then
marks `NO_SHOW`. Apply the customer cancellation fee per policy. Record it — repeated customer
no-shows are a real cost and the customer deserves to be told.

### Caregiver licence expires mid-series

A nightly job finds appointments assigned to caregivers whose licence expires before the appointment
date. It flags them in the dispatcher queue with `LICENCE_EXPIRED` as the exclusion reason, and
auto-releases the assignment. Do not silently keep the booking; that is a regulatory exposure.

### Caregiver suspended

All future assignments released, active visits flagged for immediate dispatcher attention,
sessions revoked, live-location sharing stopped. Visits in `IN_PROGRESS` are an operational
emergency: a dispatcher must call the caregiver and the customer.

### Customer account suspended

New bookings blocked. Existing appointments flagged in the queue with 72 hours' notice.
In-progress visits are not auto-cancelled — a customer's ability to pay should not end care in
progress for someone who is ill.

### Offline visit completion never syncs

Outbox retries with exponential backoff. After 6 h, a dispatcher alert. After 24 h, a direct
contact with the caregiver, because a missing visit record is a documentation-compliance failure,
not just a sync error. Never silently lose a record; never invent one either.

## 8. Invoice generation

Triggered on visit completion, unless a recurring request is configured to invoice monthly.

```text
for each completed appointment without an invoice:
    1. price at the service price effective at appointment.scheduled_start
    2. apply surcharges: night, weekend/holiday, urgent, transport (by sub-city)
    3. apply duration bands and minimums
    4. create fin.invoices (DRAFT) and fin.invoice_lines
    5. if request.billing = PER_VISIT: issue immediately
       if MONTHLY: leave DRAFT until the run job
    6. create fin.caregiver_payables for the caregiver
    7. notify the customer with the amount due
```

Additional hours are billed only with prior customer approval, recorded as an `ADJUSTMENT` line
naming who approved it. A surprise bill for overtime is the fastest way to lose a customer who
otherwise liked you.

## 9. Caregiver suspension and its knock-on effects

```
suspend(caregiver_id, reason)
  ├─ status → SUSPENDED; kill sessions; stop live location
  ├─ future OFFERED  → EXPIRED (with reason)          → notify caregiver
  ├─ future ACCEPTED  → offer back to the pool          → notify customer if unassignable
  ├─ today ACCEPTED/EN_ROUTE → dispatcher task, URGENT  → human decides
  ├─ IN_PROGRESS      → dispatcher task, URGENT
  ├─ payables: keep; settle what's earned
  ├─ patient standing assignments → end-dated with reason
  ├─ cached patient data purged on next sync (server sends a purge instruction)
  └─ audit: SUSPEND with reason, actor, count of affected appointments
```

The `IN_PROGRESS` and today's `EN_ROUTE` cases need a human, not automation. Automating them
means a patient may be left alone. Make the task the loudest thing in the dispatcher's queue.

## 10. Incident escalation

| Severity | Notify | Acknowledge by | Escalate if unacknowledged |
|---|---|---|---|
| `LOW` | Dispatcher | 24 h | 48 h → Admin |
| `MEDIUM` | Dispatcher, Clinical Supervisor | 4 h | 8 h → Admin |
| `HIGH` | Dispatcher, Clinical Supervisor, Admin, **SMS** | 1 h | 2 h → Super Admin |
| `CRITICAL` | Everyone above, **SMS and push**, customer if consent to contact exists | **5 min** | 15 min → Super Admin + phone call |

The critical path must work when push fails. SMS is the fallback, because a caregiver may have no
data. Escalation runs as a scheduled job, not as an in-process timer, because the process that
detected the incident may have restarted.

Customer notification of a clinical incident is a policy decision, not an engineering one. Write
the policy, get legal input, then automate it. Get this wrong in either direction — notifying
without care, or withholding from a patient entitled to know — and you own the consequence.