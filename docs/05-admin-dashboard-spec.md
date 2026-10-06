# 05 — Admin Dashboard Specification

The dashboard is the business. Customers and caregivers are consumers; your ops team operates the
platform through this. Design its information architecture around one dispatcher's day, not around
a database schema.

## Design principles

1. **Dispatcher's queue is the home page.** The first thing a dispatcher needs to know is what is
   unassigned and what needs a decision. Everything else is secondary.
2. **Role-specific nav.** Finance does not need "Caregiver approvals" in their menu. Render the
   navigation from the permission table, so the menu cannot drift from access control.
3. **Server-side everything.** Filters, sorting, pagination, aggregation, and CSV export all run
   on the server. A dashboard that loads 40,000 appointments into the browser will die in month
   three.
4. **Every list has a saved filter and a shareable URL.** A dispatcher who filters to
   "unassigned, today, wound care" must be able to bookmark that URL and send it to a colleague.
5. **Every destructive action is a confirmation with a typed reason**, and every one is audited.
6. **Sparse data looks good.** New accounts have zero visits. Empty states must look intentional,
   with the next action on them.

## Navigation structure

Rendered from permissions; see [02-roles-and-permissions](02-roles-and-permissions.md).

```
Dashboard
Operations
  ├── Request Queue           Dispatcher, Admin, CS
  ├── Schedule (Day / Week)   Dispatcher, Admin, CS
  ├── Active Visits (Map)     Dispatcher, Admin, CS
  └── Assignments             Dispatcher, Admin, CS
People
  ├── Customers               Dispatcher, Admin, CS, Finance (billing fields only)
  ├── Caregivers              Dispatcher (read), Admin, CS
  └── Staff & Roles           SA
Catalogue
  ├── Services                Admin
  ├── Prices                  Admin, Finance (read)
  ├── Care Packages           Admin
  ├── Supplies                Admin
  └── Sub-cities & Woredas    SA
Finance
  ├── Invoices                Finance, Admin (read), SA
  ├── Payments                Finance, SA
  ├── Payment Claims          Finance, SA
  └── Reports                 Finance, Admin, SA
Quality
  ├── Visits & Clinical Records   CS, SA
  ├── Incidents & Follow-ups     CS, Dispatcher, SA
  └── Reviews & Ratings          Admin, CS, Dispatcher (read)
Operations / Admin
  ├── Notifications & Broadcasts     Admin, SA
  ├── Audit Log                      Admin, Finance (read), CS (clinical only), SA
  └── Settings                       SA
```

---

## A1 — Dashboard

Date selector: Today / This week / This month / Custom. All figures respect the selected
permission scope.

### Operations row

| Card | Value | Sub-detail | Action |
|---|---|---|---|
| **Needs attention** | count | requests needing review, unanswered info requests, unassigned within 2 h | → Request Queue, pre-filtered |
| Unassigned requests | count | with an age indicator: >2 h in red | → Assignment |
| Appointments today | total | X confirmed, Y unassigned, Z in progress | → Schedule |
| Visits today | total | completed / in progress / not started | → Schedule |
| **Fill rate** | % | confirmed ÷ requested, this period | → Report |
| On-time arrival | % | target 85% | → Report |
| Caregivers available now | count | available / total approved | → Caregivers, filtered |
| Coverage by sub-city | heat strip | counts per sub-city for today | → Schedule, filtered |

### Finance row

Revenue this period, outstanding balance, invoices issued, payments received, refunds,
caregiver payables, revenue per visit hour. See [10-payments](10-payments.md).

### Quality row

Documentation compliance (must be 100%), caregiver rating average, reviews awaiting
moderation, open incidents, follow-up flags open, no-shows this period, late or missing caregiver
visit records (visits completed more than 6 h ago with no synced record).

### Activity feed

A chronological list of platform events, each clickable to the entity, filtered by permission,
with patient names visible only to roles permitted to see the customer record. Include patient
name redaction for Dispatcher-level views where the entity is clinical.

**Must render meaningfully with zero data.** Every card shows an em-dash, a one-line explanation,
and the primary next action.

## A2 — Request Queue

The most-used page in the system.

**Filters:** status, service, urgency, sub-city, caregiver, assignment state, date range,
payment state, customer, free text across customer name, patient name, request number, phone.
Date presets: Today / This week / Overdue / Custom. Every filter persists in the URL.

**Bulk actions:** Assign caregiver (bulk, with conflict detection), Request information, Cancel,
Export CSV.

**Columns:** request number, submitted (with age), customer, patient, service, scheduled date
and time, urgency chip, status chip, assignment state, unassigned duration, amount, balance,
actions.

**Sort:** urgency first, then age descending for unassigned. Unassigned requests older than 2 h
sort to the top and are highlighted. Never make a dispatcher hunt for an at-risk request.

**Row expansion:** care brief, patient info, quote breakdown, timeline, assignment history
(including declined offers with reasons), messages, invoices.

**Inline quick actions:** Assign, Request info, Cancel, Open full record.

**Assignment modal:** eligible caregivers filtered by cleared service, qualification match,
availability window, sub-city match, current load, rating, and no prior conflict. Show why each
is eligible, and show the reason for exclusion for those you filtered out. Offer-mode and
direct-assign toggle. See [08-workflows](08-workflows.md) § 4.

## A3 — Schedule

**Day view**

- Vertical time axis from 06:00 to 24:00, 15-minute granularity
- Caregiver columns (up to 8 side by side; scroll or collapse beyond that)
- Appointment blocks coloured by status, sized by duration
- Unassigned appointments in a separate left-hand gutter, draggable onto a caregiver column
- Block width reflects duration; minimum 20 px so short visits stay clickable
- Live now-line; block hover shows a compact summary

Drag-and-drop assignment is optional. If it ships, reassignment must be confirmed and audited,
and collisions must be blocked visibly. If it slips in v1, do not pretend it exists — a
click-to-assign modal is sufficient and safer.

**Week view:** 7 day columns, visit-count heat strip per day, coverage gaps per sub-city.

**Views:** Calendar / List / Sub-city / Unassigned only.

Each block: customer, patient, service, status, caregiver, duration, and flags (unassigned,
overdue, reschedule requested, flagged incident). All actions available inline.

## A4 — Active visits (map)

For dispatchers and the Clinical Supervisor.

- Map with all `EN_ROUTE` and `IN_PROGRESS` visits
- Caregiver markers; patient markers; lines between a caregiver and their active visit
- List beside the map: caregiver, patient, service, started at, elapsed, last location update
- Click a caregiver for a detail panel: current visit, arrival time, elapsed against expected
  duration, contact actions, note history
- **Stale location indicator** — greyed with an age label if no update for 10 minutes. Never show
  a stale position as if it were current
- Alerts: overdue visits (elapsed > expected + 30 min), a visit with no arrival confirmation,
  a caregiver who has not moved since the last two updates
- Privacy: caregiver live location is visible to Dispatcher and Admin while a visit is active,
  and to no one otherwise. Patient addresses shown here are permitted for these roles. Record
  each map session in the audit log with the reason viewed

## A5 — Assignments

- Unassigned queue, sorted by urgency then age
- Pending offers: who offered, to whom, when it expires, offer history with declines and reasons
- Reassignment queue
- Coverage report per sub-city per time band, showing where you have no caregiver coverage
- **Decline analytics:** decline reasons aggregated by caregiver and service, with trend over
  time. Rising "too far" declines mean your travel pricing is wrong. Rising "not qualified"
  declines mean your clearance data is stale

## A6 — Customers

**List:** name, phone, sub-city, patients count, total visits, last booking date, lifetime value,
outstanding balance, account status, joined date. Filters including outstanding balance > 0 and
no booking in 90 days. Search across name, phone, patient name, request number.

**Detail — Customer tab:** profile, verification state, contact, addresses, emergency contact,
consent records with version and timestamp, account status, notes, lifetime metrics, data
requests, and account actions (suspend, reactivate, request document).

**Patients tab:** each patient's profile, mobility, care needs, medications, allergies, and
their own appointment history. Clinical free-text notes are visible only to the Clinical
Supervisor.

**Visits tab:** all requests and appointments with status and timeline.

**Billing tab:** invoices, payments, claims, balance. Finance only for amounts; other roles see
status but not amounts, per [02](02-roles-and-permissions.md).

**Care record tab** (CS and SA only): the longitudinal clinical record across all visits, with
amendment history.

**Actions:** Suspend (with reason; blocks new bookings, does not cancel in-progress visits),
Reactivate, Send a message, Request missing document, Export data, Request closure handling.

## A7 — Caregivers

**List:** photo, name, title, qualification, licence number and expiry, cleared services,
sub-city, status, rating, visits this month, completion rate, on-time rate, lifetime visits,
current load, last active. Filters: status, qualification, service, sub-city, licence expiring
within 30/60/90 days, currently available, has capacity today.

**Detail tabs:**

- **Overview** — profile, status, current load, today and next 7 days, lifetime metrics
- **Qualifications** — all credentials, licence number, expiry, verification record with who
  verified it and when, documents with per-document status
- **Services** — cleared services, each with the qualifier that permits it, and who granted it
- **Availability** — weekly template, exceptions, effective dates, plus a 4-week capacity
  forecast in hours
- **Patients** — current assignments only, with end-date visibility
- **Performance** — visits, completion rate, on-time rate, average rating with dimension
  breakdown, documentation compliance, decline rate by reason, average travel time per visit
- **Earnings** — per-visit pay, totals, payment-run status (Finance)
- **Sessions** — active devices, last login, last location update; **Revoke sessions** action
- **Activity** — their own visit records, their responses, their decline reasons, with a
  standing note that this is visible to them

**Actions:** Approve, Request changes (itemised), Reject (with reason, visible to caregiver),
Suspend (with reason and effective date, revokes sessions), Reinstate, Reset password, Send
message, Assign patient, Adjust pay rate, View clinical feedback (CS).

**Bulk:** approve a queue of pending caregivers, expiring-licence digest.

## A8 — Services & Prices

**Services list:** code, name (EN / AM), category, description, base price, billing unit,
default duration, requires-licence flag, active, sort order, booking count. Toggle active,
duplicate, reorder.

**Service editor:** bilingual name and description, category, **what is included** and **what is
not included** (both shown in the customer app), duration bands and prices per band,
qualification required to deliver it, supplies checklist template (used by G9/G10),
care-checklist template (used by G9/G10), active flag, sort order.

The care checklist template is worth the effort: it is what makes visit documentation fast and
consistent, which is what makes compliance measurable.

**Prices list:** service, billing unit, price in santim, effective-from and effective-to,
surcharges, transport by sub-city. Price changes create a new row rather than overwriting, so
historic invoices keep the price they were issued at. A **simulate** tool: given a service,
duration, date, time and sub-city, show the computed quote so you can sanity-check pricing before
publishing.

## A9 — Invoices & Payments

**Invoices list:** number, customer, patient, request, issue date, due date, total, paid, balance,
status, dispute flag. Filters: unpaid, overdue, disputed, by customer, by date range.
**Actions:** issue, send, void (with reason), record payment, mark disputed, resend, export.

**Invoice detail:** line items, surcharges, payments applied, balance, audit trail, the originating
request and visits, and the customer's payment claim thread if any.

**Record payment modal:** amount, method, reference, paid date, note. A partial payment is
allowed and the balance stays open. Show the caregiver payables impact.

**Payment claims:** claims submitted by customers from C16, with the receipt photo, the claimed
amount and reference, and a confirm or reject action with a reason. This queue is the front line
of manual payment processing. Add a target: every claim acknowledged within one business day.

**Reconciliation view:** payments recorded but not matched to a claim, and claims open more than
3 days. Both are leakage.

## A10 — Reports

Server-side aggregation with CSV and PDF export. Date range mandatory. Every report respects
role scope.

1. **Revenue** — total, by service, by sub-city, by week, average per visit, average per hour,
   surcharge breakdown
2. **Visits** — count, completed, cancelled, no-show, cancelled-by-actor, by service, by
   sub-city
3. **Fill rate** — requested vs confirmed, by service, sub-city, week
4. **On-time arrival** — by caregiver and by service, with a distribution of arrival deltas
5. **Caregiver performance** — visits, completion, on-time, rating, documentation compliance,
   decline rate, travel time
6. **Customer retention** — repeat rate, time to second booking, lifetime value distribution,
   churn
7. **Documentation compliance** — completed visits missing a care log, with the caregiver and age
8. **Caregiver payables** — per caregiver per period, unpaid total, payment-run status
9. **Decline and reassignment reasons** — operational diagnosis
10. **Capacity and coverage** — available hours vs booked hours by sub-city and week

## A11 — Visits & Clinical Records (CS, SA)

Deliberately a separate section, with separate access control and separate navigation.

- **Visit list:** date range, caregiver, patient, service, flags. Row shows documentation status
- **Visit record:** the full structured record — care log with per-item status, vitals with
  out-of-range flags, observations, supplies, incident link, follow-up, signature presence,
  photos, amendment history, and full audit history of who read it
- **Amendment:** authorise an amendment with a mandatory reason. Never edit in place. Show the
  before and after diff
- **Clinical alerts queue:** out-of-range vitals, incidents, follow-up flags, patients whose
  condition the caregiver flagged as deteriorating. Sorted by severity
- **Care quality review:** per caregiver, sample visit records, notes, feedback to the caregiver
- **Patient chart (CS, SA only):** longitudinal record across visits with medications and
  allergies. Every view audited

## A12 — Incidents & Follow-ups

- Incident list: severity, category, caregiver, patient, reported at, acknowledged at, resolved at
- Critical incidents pinned and unacknowledged ones escalating. Acknowledgement requires a note
- Resolution workflow: investigate, resolution note, corrective action, notify caregiver,
  notify customer, close
- **Escalation matrix:** critical incident unacknowledged after 5 minutes → SA; after 30 minutes →
  SA plus phone call. Implement as a scheduled job, not a hope
- Follow-up flags: recommendation text, suggested next visit, open or closed, who closed it and how
- Incidents involving a customer must be logged and reviewed by the Clinical Supervisor and the
  customer informed, per your policy. Write that policy before launch

## A13 — Reviews & Ratings

- Review list: caregiver, service, rating dimensions, comment, moderation status
- Dimensions: professionalism, punctuality, quality — plus overall
- Moderation: approve, hide, respond on behalf of the company. Hiding requires a reason
- Aggregate view: average per caregiver with dimension breakdown, trend, and the lowest-scoring
  dimension, which is your operational improvement signal
- **Do not allow review deletion.** Hide with a reason and keep the row. Review integrity matters
  more than convenience

## A14 — Notifications & Broadcasts

**Templates:** event key, channel, language, subject, body, variables. Editable per channel and
per language. Preview with sample data before enabling. Version history.

**Broadcasts:** audience (all customers, all caregivers, sub-city, service, active request),
channel, content, schedule or send now. Two required fields: a plain-text fallback and a
per-channel length limit. Compliance: health data must never appear in a broadcast body.

**Delivery log:** per-recipient delivery status, channel, timestamp, failure reason. Support
re-sending a single notification.

## A15 — Audit Log

The platform's own record of what happened to it.

- Filters: actor, action, entity type, entity, date range, IP
- Columns: timestamp, actor and role, action, entity, IP, device, request id, before/after diff
  for changes
- **Health-record access events are called out separately**: who read which patient's chart, when,
  from where. Clinicians reviewing this log is the best detective tool you have
- Export CSV for the compliance file. Retention per [11-security](11-security.md) § 8
- Append-only. No delete, no edit. Retention by policy, enforced by a scheduled job
- The log viewer itself is audited. Reading the log is an action

## A16 — Settings

**General:** company name, logo, support number, urgent-care number, verified emergency number,
office hours, Amharic and English copy overrides.

**Booking:** office hours, same-day cutoff, minimum lead time, booking horizon (90 days),
maximum visits per caregiver per day, offer expiry windows, cancellation policy windows and
fees.

**Surcharges and pricing rules:** night hours and rate, weekend and holiday calendar, urgent
rates, transport by sub-city, minimum booking durations per service.

**Notifications:** channel enablement, templates, quiet hours, per-role defaults.

**Data and retention:** retention periods, deletion-request handling, export settings,
data-processing consent version.

**Integrations:** SMS provider credentials, FCM project, maps provider keys, payment-gateway
configuration (inactive in v1 but present).

**Feature flags:** per-surface toggles to enable or disable functionality without a deploy —
caregiver approval, new booking wizard, check-in codes, supplies, broadcasting, i18n completeness.

Every settings change is versioned and audited with a diff, and takes effect immediately.

---

## Cross-cutting dashboard requirements

| Area | Requirement |
|---|---|
| Authentication | Email + password with enforced 2FA; session timeout 8 h idle / 30 d absolute; device list with revoke; a Security page showing recent logins and an alert on a new device |
| Authorisation | Server-enforced on every query; nav rendered from the permission table; a client-side 403 page that names the missing permission in dev builds only |
| Accessibility | WCAG 2.1 AA; full keyboard operation; a dense-operations mode that survives the default colour palette |
| Mobile responsiveness | Desktop-first, but the dispatcher queue must be usable on a phone. A dispatcher in the field with one phone is the normal case |
| Performance | Dashboard under 2 s at 10k appointments; lists under 1 s with server pagination; heavy reports async with an email-on-complete notification |
| Bulk operations | Select many, act once, with a summary of what will change and per-item results. Every bulk action audited item by item |
| Immutability | Dispatcher-facing operational records cannot be edited once complete. Corrections go through amendment flows |
| Export | CSV on every list, respecting the active filters and the user's scope, with an export audit event |
| Print | Appointment schedule and day sheet printable for the office, deliberately excluding clinical notes |
| Time | Africa/Addis_Ababa for display, UTC in storage, ETB for currency, with a visible timezone label on time-sensitive pages |