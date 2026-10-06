# 01 — Product Scope & Service Model

## 1. The business in one paragraph

[Company Name] Home Care connects families in Addis Ababa who need in-home nursing, elderly,
post-hospital, and personal care with vetted caregivers. The customer books a visit through a
mobile app, your operations team assigns a caregiver, the caregiver travels to the address,
delivers care, and documents what happened. The customer pays after the service. You take a
margin on the difference between what the customer pays and what the caregiver earns.

## 2. Who this is for

**Customer (the payer).** Adult children living elsewhere, or the patient themselves.
Frequently non-technical. Frequently Amharic-speaking. Frequently anxious — they are handing a
vulnerable person to a stranger. Trust is the product, not the software.

**Patient (the receiver).** The elderly, post-surgical, chronically ill, or disabled person.
Often does not use the app at all. Every design decision follows from this: the patient is not
the user, so the app is designed for the payer's anxiety and control.

**Caregiver (the deliverer).** A nurse or care worker in the field, on a phone with intermittent
connectivity, possibly in traffic, possibly at the door with no signal. Needs a small, clear
"today's jobs" screen that works offline.

**Dispatcher / ops (you).** Assigning the right caregiver to the right patient. This is the
highest-leverage human in the system and the dashboard is built around their day.

## 3. Service catalogue (v1)

Nine services, all fixed-price, all requiring at least one qualified caregiver:

| Code | Service | Typical duration | Requires licensed nurse | Repeat-typical |
|---|---|---|---|---|
| `NURSING` | Nursing care | 2–8 h | Yes | Yes |
| `ELDERLY` | Elderly care | 4–12 h | No (trained care worker) | Yes |
| `POST_HOSPITAL` | Post-hospital care | 4–24 h | Yes | Yes |
| `WOUND_CARE` | Wound care | 1–2 h | Yes | Yes |
| `MEDICATION` | Medication support / administration | 1–2 h | Yes (RN) | Yes |
| `PERSONAL_CARE` | Personal care (bathing, dressing) | 2–4 h | No | Yes |
| `FEEDING` | Feeding assistance | 1–2 h | No | Yes |
| `VITALS` | Vital-sign monitoring | 1–3 h | Yes | Yes |
| `PHYSIOTHERAPY` | Physiotherapy | 1–2 h | Yes (physio) | Yes |
| `OTHER` | Other (reviewed manually) | varies | Reviewed | No |

`OTHER` exists so you never have to say "not supported" to a customer who has a real need. Every
`OTHER` request is reviewed by a human before pricing.

**Pricing is intentionally empty in this document.** See [15-roadmap-and-budget](15-roadmap-and-budget.md)
for how to derive it. Prices live in the database as rows in `service_prices` and are editable
from the admin dashboard without a code deploy.

### What services are NOT in v1

Be explicit with your team and with customers about these. Each one requires clinical
governance, not just engineering:

- Intravenous therapy / injections at home
- Catheter insertion or management
- Home-based childbirth
- Any service requiring a prescription the platform cannot verify
- Resuscitation / emergency response
- 24/7 live care packages

Adding these requires a clinical governance process (see [16](16-open-questions.md)), not just
new rows in a services table.

## 4. Geography

Launch city: **Addis Ababa**, with structured addresses as:

`Sub-city → Woreda → Kebele → House number → Landmark → Map pin`

The sub-city list is a fixed, admin-editable reference table (not a hardcoded enum) because
Addis has restructured its sub-cities before and will again. Store it in `sub_cities` and
`woredas`; do not hardcode.

**Distance handling in v1:** no automatic travel-time calculation. Caregivers are assigned by
sub-city manually, because a dispatcher who knows which caregiver lives near Bole is faster
and better than an algorithm at launch. Record `travel_minutes_estimate` on the appointment for
later analysis.

## 5. Operating hours and scheduling

- Office: 8:00–18:00, seven days. Home care itself extends beyond this.
- Bookings accepted up to **90 days** ahead.
- Bookings for **today** accepted until **09:00** for same-day service (cutoff so dispatch has
  time to assign). Configurable per admin settings.
- Minimum lead time for a new customer: **4 hours**.
- Emergency/urgent requests: accepted, but flagged as `URGENT` and routed to the urgent-care
  line, not promised as a guaranteed response.

## 6. The MVP boundary

This is the line between what you build now and what you pay for later. Be disciplined.

### IN v1 — the shipped release

**Customer app**
- Registration with phone OTP, login with password
- Profile, addresses, emergency contacts, patients
- Service catalogue browsing with pricing
- Service request: patient info, schedule, location, requirements
- Recurring bookings (daily / weekly / biweekly / monthly)
- Request status tracking with live state
- Upcoming visit list with caregiver name and photo once assigned
- In-app messaging thread per request (non-clinical use only)
- Quote and invoice viewing
- Payment status and balance
- Post-visit rating and review
- Push + SMS notifications
- Emergency information screen
- Amharic / English

**Caregiver app**
- Caregiver onboarding: profile, qualification, license details, document upload
- Approval status tracking
- Availability schedule (weekly template + date exceptions)
- Offer inbox: accept / decline with reason
- Today's route: ordered list of visits
- Visit detail with patient care brief
- Start visit (records GPS + timestamp + device)
- Live location sharing during visit
- Complete visit: structured care log, vitals, supplies, notes, follow-up
- Caregiver earnings view
- Offline queue for visit completion when there is no signal

**Admin dashboard**
- Login, dashboard, role-based menus
- Dashboard: today's numbers, revenue, pending queue
- Customer management: list, profile, patients, history, invoices, suspend
- Caregiver management: list, approve/reject, documents, availability, performance
- Service management: CRUD + pricing
- Request management: queue, review, request-info, approve, decline-with-reason
- Assignment: browse eligible caregivers, assign, reassign
- Appointment board: day / week calendar view
- Visit monitoring: active visits map
- Invoices and payment recording
- Reviews moderation
- Reports: revenue, visits, caregiver performance
- Audit log viewer

### OUT of v1 — explicitly deferred

| Feature | Why deferred | When to revisit |
|---|---|---|
| Telebirr / CBE Birr / card payment | Merchant onboarding, API agreements, settlement takes weeks and needs the business to be operating first | Phase 2, after first revenue |
| WhatsApp Business API | Requires a verified business and a Meta app review; SMS covers v1 | Phase 2 |
| In-app chat (live support) | Support is a phone call at this volume | When >50 daily requests |
| Family multi-user accounts | One payer per patient is enough at launch | Phase 2 |
| Subscription / care packages | Requires 3+ months of pricing data to price correctly | Phase 3 |
| Insurance / third-party billing | Complex reconciliation, needs a partner payer | Phase 3 |
| Prescriptions / medication dispensing | Clinical governance required | Phase 3 |
| Video consultation | Not core to the delivery model | Phase 3 |
| Caregiver route optimization | Useless with 3 caregivers | After ~20 caregivers |
| Multi-city launch | Requires a different dispatch and travel model | When Addis is stable |
| Native iOS before iOS demand | Flutter ships both; Play Store distribution first | On demand |
| Offline-first full app | Offline queue for visit completion only in v1 | Phase 2 |

The most important line here: **payments and WhatsApp are deferred, not forgotten.** They are
also the two things customers will ask about most. Plan your launch messaging around manual
payment instructions being clear.

## 7. Success metrics

Instrument these from day one. A home-care business without visit-level data cannot price,
cannot schedule, and cannot tell whether a caregiver is good.

| Metric | Definition | v1 target (first 90 days) |
|---|---|---|
| Booking conversion | Requests that reach `CONFIRMED` / total submitted | > 70% |
| Fill rate | Appointments filled with a caregiver / appointments requested | > 85% |
| Median assignment time | Request submitted → caregiver assigned | < 4 hours (office hours) |
| On-time arrival | Caregiver arrived within ±15 min of scheduled start | > 85% |
| Completion rate | Started visits / confirmed appointments | > 95% |
| Zero-no-show rate | Completed visits / appointments | < 5% |
| Caregiver utilization | Paid visit hours / caregiver available hours | 50–70% (too high = no slack) |
| Repeat booking rate | Customers with ≥2 completed bookings, within 60 days | > 40% |
| Customer satisfaction | Mean overall rating | > 4.4 / 5 |
| Revenue per visit hour | Collected ETB / total visit hours | Tracked, target set after pricing |
| Documentation compliance | Completed visits with a full care log | 100% — no exceptions |
| Caregiver retention | Caregivers active in the last 30 days | > 85% |

**Guardrail metric:** zero PHI incidents, zero unauthenticated access to patient records.
This one is not a target to optimise; it is a release gate. See [11-security](11-security.md).

## 8. Business model assumptions

Recorded explicitly so the developers and your accountant can see the assumptions behind the
schema.

**Revenue:** fixed price per service per duration band. Optional surcharges:
- Night visit (21:00–06:00): +20%
- Weekend/holiday: +10%
- Urgent / short-notice: +25%
- Transport reimbursement: fixed ETB per visit, set by admin
- Additional hours beyond the booked duration, only with prior customer approval

**Caregiver pay:** per visit, per hour, or per day — configurable per caregiver. Default is
per hour with a minimum visit guarantee. Recurring long bookings (a 12-hour elderly care shift)
are paid as shifts, not hourly, to avoid admin overhead.

**Margin target:** 25–35% gross. Anything below 25% and you cannot afford to absorb a
reassignment, a no-show, or a refund. See [15](15-roadmap-and-budget.md) for the worked example.

**The economic reality that matters:** in a care business, the cost that surprises people is
travel and idle time between short visits. Price and dispatch accordingly. A 1-hour wound-care
visit across town is not profitable at the same rate as a 4-hour shift. The pricing table must
let you charge travel or set minimum booking durations.

## 9. Customer support model

Define it now, because it drives the app's messaging and the emergency screen.

- **Urgent care line:** a published Addis phone number answered during office hours. Visible on
  the app home screen and on every caregiver's profile.
- **Emergency:** the app shows official Ethiopian emergency numbers and directs the user to the
  nearest emergency department. **The app must not imply it provides emergency medical
  response.** This is a safety and liability boundary. See [03](03-customer-app-spec.md) § Emergency.
- **In-app support:** a "Call us" and "Message us" action on every request. No chatbot in v1.

## 10. Definition of "home health care" for your business

Because the phrase carries regulatory weight, define your scope in writing and have it reviewed:
are you a private healthcare provider, a home-care support service, or a staffing agency? This
determines licensing. The distinction is between **performing clinical acts** (nursing, wound
care, medication administration) and **non-clinical support** (bathing, companionship,
household assistance). Clinical acts performed by licensed professionals under your
supervision carry obligations that non-clinical support does not. Raise this with a local lawyer
before you sell clinical services — see [16-open-questions](16-open-questions.md).