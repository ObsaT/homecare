# 04 — Caregiver App Specification

Same Flutter codebase as the customer app, in role-gated **caregiver mode**. One release
train, one codebase, separate navigation and separate data access. See
[02-roles-and-permissions](02-roles-and-permissions.md) § 3.2.

Design constraints that come from the job, not from the platform:

- The user is standing, outdoors, possibly on a motorcycle, possibly in a taxi.
- Connectivity is intermittent. Offline capability is a requirement, not a nice-to-have.
- The screen may be read in bright sun or a dark room. Large type, high contrast, big targets.
- One hand. Primary actions live in the bottom third.
- Every second spent reading is a second spent not caring for a patient.

## Screen inventory

| # | Screen | Route | Purpose |
|---|---|---|---|
| G1 | Onboarding / credential upload | `/cg/onboarding` | Registration + qualification docs |
| G2 | Approval status | `/cg/status` | Pending / approved / rejected, read-only |
| G3 | Today (home) | `/cg/today` | The day at a glance, next visit |
| G4 | Offers inbox | `/cg/offers` | New assignments to accept or decline |
| G5 | Offer detail | `/cg/offers/:id` | Full context before deciding |
| G6 | Schedule | `/cg/schedule` | Day / week / list views |
| G7 | Visit detail | `/cg/visits/:id` | Care brief, address, actions |
| G8 | Navigation / en route | `/cg/visits/:id/nav` | Directions, live location, contact |
| G9 | Active visit | `/cg/visits/:id/active` | Timer, care log, vitals |
| G10 | Complete visit | `/cg/visits/:id/complete` | Structured documentation |
| G11 | Availability | `/cg/availability` | Weekly template + exceptions |
| G12 | Earnings | `/cg/earnings` | Visits and pay |
| G13 | Profile | `/cg/profile` | Personal details, credentials |
| G14 | Patient history | `/cg/patients/:id` | Their own authored visits only |
| G15 | Messages | `/cg/threads`, `/cg/threads/:id` | Per-assignment threads |
| G16 | Safety & incident report | `/cg/incident` | Report an incident |
| G17 | My ratings | `/cg/ratings` | Their own reviews |

---

## G1 — Onboarding / credential upload

Multi-step, resumable, local drafts.

**Step 1 — Personal**
- Full name, phone (OTP-verified), email (optional), password
- Photo from camera or gallery. **Required.** Caregivers with a profile photo get fewer
  no-cancels. Square crop, stored as a private object; never a public URL.
- Date of birth, gender, languages spoken (multi-select: Amharic, Oromo, Tigrinya, Somali,
  Afar, Sidamo, English, Other)
- Home sub-city, home woreda — **this drives dispatch suggestions**, so make it prominent with
  a one-line explanation: "Helps us send you visits near you."

**Step 2 — Professional**
- Professional title: Registered Nurse / Licensed Nurse / Nursing Student / Physiotherapist /
  Health Officer / Care Worker / Other
- Qualification level: Certificate / Diploma / Bachelor's / Master's
- Field of study
- Institution
- **Licence / registration number** — required
- **Licence issuing authority** — required
- **Licence issue date and expiry date** — expiry is validated: if it is in the past, the
  caregiver cannot be approved and the UI says so immediately
- Years of experience (number or select)
- Previous employers or facilities (optional, max 3)
- Specialisations (multi-select: wound care, post-surgical, geriatrics, paediatrics,
  physiotherapy, palliative, mental health, diabetes care, feeding and swallowing, mobility aid)
- Languages, repeated from step 1 — remove from step 1 and keep here, once

**Step 3 — Documents**
Photograph or file upload, per document type:

| Document | Required | Notes |
|---|---|---|
| Government ID | Yes | Front and back as two images |
| Professional licence | Yes | Must be legible; expiry visible |
| Health certificate | Per local requirement | See [16](16-open-questions.md) |
| Police clearance | Per local requirement | See [16](16-open-questions.md) |
| Training certificate | If claimed | |
| Vaccination record | If required by policy | |

Upload requirements, shown before upload: JPEG or PNG, max 5 MB, minimum 1000×700 px, all four
corners of the document visible. Client-side compression before upload. Per-document upload
progress. Resumable on poor connections — chunked upload with retry, since a 5 MB photo on a
weak connection in Addis will fail otherwise.

**Step 4 — Services and rate**
- Services you can provide (multi-select from the catalogue, filtered to what your qualification
  permits)
- **Admin approval is still required.** The caregiver can *request* to be cleared; an Admin
  grants it. Do not let a caregiver self-assert clinical clearance — that defeats the vetting.
- Pay model preference: Per visit / Per hour / Per shift. Informational; Admin decides.
- Bank or mobile-money account details for payment — masked, encrypted, visible only to Finance

**Step 5 — Declaration**
- [ ] I confirm the information I provided is accurate
- [ ] I hold a valid licence to practise the services I have selected
- [ ] I agree to the Terms of Service, including the confidentiality of patient information
- [ ] I agree to the Privacy Policy
- Submit → status `PENDING_REVIEW`

## G2 — Approval status

A read-only screen that stays in the caregiver's navigation until approved. This is important
for trust: the caregiver can see exactly where they are in the process.

- **Pending** — a progress list: profile received → documents received → under review →
  admin verification. Estimated review time. A **Contact office** action.
- **Changes requested** — the specific missing or rejected items, listed item by item, with
  inline re-upload. Not a vague "please resubmit".
- **Approved** — welcome sheet, what is cleared for which services, and the first assignment.
- **Rejected** — the reason, in writing, and whether re-application is possible.
- **Suspended** — the reason, the effective date, and how to appeal. Never a generic error.

Push notification on every status change.

## G3 — Today (home)

1. **Greeting and status line** — "Good morning, Almaz. 3 visits today." Plus a
   **Available / Unavailable** toggle, mirrored in dispatch.
2. **Next visit card** — the single most important element:
   - Patient name and age, gender-appropriate title only ("Mr. Bekele", not "Mr. Bekele, male, 78,
     diabetic" on a card someone might read over a shoulder)
   - Service, duration, start time
   - Address and distance estimate
   - A countdown chip: "in 2 h 15 m" / "leave by 09:40" / "starting now"
   - **View details** and **Navigate** buttons
3. **Today's route** — ordered list of remaining visits with time, patient, service, address.
   Tapping any row jumps to that visit.
4. **Quick actions** — Report a problem, Call dispatch, Emergency.
5. **Pending offers** — a count badge if offers are awaiting response, with a response deadline.

The caregiver's whole day should be readable in under five seconds. If the design fights that,
redesign the design.

## G4 — Offers inbox

New assignments offered to this caregiver, pending response.

Each row: service, patient first name only, date and time, duration, distance estimate, and
sub-city. **Response deadline** with a countdown. Declined offers are hidden; expired offers
move to an Expired tab with a reason.

Offer expiry in v1: **4 hours** for a next-day or later visit, **90 minutes** for a same-day
visit. Configurable. On expiry the dispatcher is notified and the offer auto-releases. This
prevents a caregiver from sitting on an offer that blocks the schedule.

Swipe actions: Accept, Decline.

## G5 — Offer detail

Everything needed to decide without a phone call:

- Service, duration, date and time, sub-city, distance from the caregiver's home area
- **Care brief** — a deliberately minimal clinical summary: patient first name and age band,
  primary care need in one line, mobility, allergy flag if any, and whether the caregiver is
  cleared for the required qualification
- **Explicit trust warning** if relevant: "This patient requires a licensed nurse. You are
  cleared. Confirm you are comfortable with this patient's needs."
- Address is **not** shown until acceptance
- Payout: amount the caregiver earns for this visit
- Buttons: **Accept** (primary), **Decline**

**Decline** opens a reason sheet: Too far / Not available / Not qualified for this case /
Personal / Patient conflict / Other + free text. Reasons feed dispatch analytics — if 40% of
declines are "too far", that is a pricing or dispatch problem, and you want to know.

## G6 — Schedule

Views: Day / Week / Agenda.

- Month strip with a heat indicator (open slots, booked days, pending offers)
- Day view: a timeline from 06:00 to 24:00 with visit blocks positioned by time, sized by
  duration. Overlaps are rendered visibly, not stacked invisibly.
- Week view: 7 columns, blocks by day, colour by status
- Agenda view: flat list, grouped by day, with distances
- Tapping a block opens G7. Tapping an empty slot opens the availability editor for that day.
- **Block the time** action to declare unavailability — an offer arriving in a blocked window is
  never offered.

## G7 — Visit detail

- Service, patient, date, time range, duration
- **Care brief** — the full version, for this caregiver only:
  - Name, age, gender, and how the caregiver should address them
  - Primary care needs, mobility level, communication notes (hearing, vision, language)
  - Allergies, prominently displayed if any
  - Current medications, with those requiring administration flagged
  - Special requirements: gate code, parking, pets, shoes, cultural notes, preferred approach
  - Household contact name and phone — **the customer's contact is shared with the caregiver
    only while the visit is within 12 h of start or currently active.** See [02](02-roles-and-permissions.md)
    § 3.2.
  - Care plan notes from the Clinical Supervisor
- Address, with **Navigate**, **Call customer**, and **Message us**
- Estimated travel time and a **Leave now** prompt at `start − travel estimate − 10 min`
- Access notes as a checklist the caregiver can tick on arrival: "Pets secured, clear path,
  private room available"
- Buttons by status:
  - `ACCEPTED`: **Start visit** (primary) — enabled 15 minutes before the scheduled start. Before
    that, show "You can start from HH:MM".
  - `EN_ROUTE`: **Mark arrived**
  - `IN_PROGRESS`: **Complete visit**
  - `COMPLETED`: read-only, with a link to the record and a note that amendments after 24 h
    need a supervisor
- **Safety**: an always-visible **Report a problem** action (G16) and a **Call emergency
  services** shortcut

## G8 — Navigation / en route

- **Mark en route** action — notifies the customer, starts live location sharing
- Turn-by-turn is handed to the native maps app via a deep link (Google Maps / Amap / OSM
  depending on device). Do not rebuild turn-by-turn.
- In-app map showing the destination, the caregiver's position, and live ETA from the routing
  provider. **Display to the customer, hide from other caregivers and from customers who are not
  the patient household.**
- Copy the address to clipboard, share via the OS share sheet, call the destination
- **Call customer** — reveals the number only within the permitted window
- **Arrival code** — show a 4-digit code the caregiver reads to the customer, which the customer
  enters in G13 to confirm arrival. Cheap, effective proof of arrival, no extra hardware.
  Optional in v1; recommended.
- **Mark arrived** → sets arrival time and GPS, notifies the customer, transitions to
  `IN_PROGRESS`
- Safety action always visible: **I'm at the wrong address** / **Customer not home** / **Call
  dispatch**

## G9 — Active visit

The screen the caregiver looks at for hours. Optimised for glanceability over density.

- **Header**: patient name, service, elapsed timer (monospace, hh:mm:ss), start time
- **Patient safety banner** — allergies and key precautions, pinned
- **Departed-status sync indicator** — "Location shared with the customer", with a visible
  state, because a caregiver needs to know their location is visible
- **Quick vitals capture** — a grid of large buttons opening compact numeric inputs:
  - Blood pressure (systolic/diastolic), Heart rate, Temperature, Respiratory rate,
    Blood glucose, Oxygen saturation, Weight
  - Each with an optional "unusual" flag and note
  - Values are added to a running list on this visit; the caregiver enters them at the end or as
    they go
- **Care log checklist** — task-based, derived from the service definition:
  - Personal care: bathing, hair, oral care, dressing, continence support, skin check
  - Wound care: wound assessment, dressing change, photo, odour/slough note
  - Nursing: medication administration (per med row), vital signs, catheter care,
    mobility exercises, patient education
  - Elderly: safety check, hydration, meals, companionship, activity
  - Feeding: assistance, amount eaten, fluid intake
  - Vitals: each vital as a checklist item
  - Physiotherapy: exercises performed, repetitions, mobility improvement, exercises for home
- Each checklist item: done / not applicable / **needs attention** — with the option to attach a
  note or a photo (wound photos are essential for wound care; they go to a private store with
  consent, never a public URL, and require explicit patient consent at booking)
- **Notes** — free text, autosaved locally every few seconds, **encrypted at rest on the
  device**. This is the field most likely to contain sensitive clinical detail.
- **Call family / call dispatch / emergency** — always visible
- Offline indicator and a "Saved on device" confirmation, because the caregiver must trust that
  nothing is lost

## G10 — Complete visit

Deliberately short. The caregiver is tired and this is the step most likely to be skipped
entirely, and a skipped care log is a legal and clinical problem.

Structure:
1. **Departure** — time (auto-set to now, editable), location captured
2. **Summary** — what was delivered: checkboxes of the care-log items performed, auto-filled
   from G9 so the caregiver confirms rather than retypes
3. **Vitals** — the values captured, editable, each with an "outside expected range" flag
4. **Observations** — free text (the main clinical note field), max 4000 chars, encrypted
5. **Supplies used** — repeatable rows: item, quantity. Backed by a supplies catalogue with
   quantities and unit prices, so you can cost and reorder supplies. Out-of-stock items are
   flagged.
6. **Incidents** — if anything went wrong: severity, description, action taken, and a mandatory
   **Call dispatch** acknowledgement
7. **Follow-up** — toggle. If on: recommendation text, a suggested next visit, and a suggested
   interval. Surfaces in the Clinical Supervisor's queue.
8. **Signature** — customer or authorised family member signs on the caregiver's phone. Store
   the stroke vector, not just the image. If nobody can sign, allow a skip with a reason; do not
   block visit completion on a signature.
9. **Attachments** — photos with a label and a consent flag
10. **Confirmation** — a read-back screen listing everything entered, with **Edit** links per
    section

Buttons: **Save draft** (always available, offline-safe), **Complete visit** (primary, requires
a confirmation step: "This visit is now recorded and cannot be edited after 24 hours. Complete?").

**24-hour amendment window:** the caregiver can edit their own visit record for 24 hours. After
that, the record locks and only a Clinical Supervisor can amend, with a reason. State this
before submission so it is not a surprise.

**Submission is offline-first.** The caregiver taps Complete with no signal, sees "Saved on your
phone. It will upload when you have a connection", and can go home. The app uploads
automatically, retries with exponential backoff, and tells the caregiver when it lands. Alert
the caregiver if it has not synced after 6 hours — via a dispatcher task, not by nagging them.

## G11 — Availability

Two parts:

**Weekly template** — for each of the 7 days, toggle available/unavailable and set a start and
end time. Defaults: available Monday to Saturday 08:00–17:00. Multiple windows per day are
supported (a morning block and an evening block).

Copy: "This tells dispatch when you can take visits. It does not mean you have been booked —
you will still see and accept each visit."

**Date exceptions** — add a specific date: unavailable all day, or a custom window, with a
reason (sick leave, personal, training). Blocked windows are never offered.

**Time off** — request leave for a date range; a dispatcher approves or declines; declining
requires a reason.

Also: a **notification radius** setting (default 10 km) limiting how far they want to travel, and
a **max visits per day** cap (default 3). These two settings quietly determine whether your
caregiver utilisation is healthy or whether your caregivers are burning out and leaving.

## G12 — Earnings

- Period selector: this week / this month / last month / custom
- Summary: gross earnings, number of visits, total hours, average per hour, average per visit
- Visit rows: date, patient, service, duration, amount, status (Confirmed / Pending payment)
- Status legend explaining when money lands: "Payments are processed on the [date]. Completed
  visits are included in the next payment run."
- **Statement** action per period, downloadable as PDF, and viewable by Finance
- No caregiver sees customer billing. They see their own pay only.

## G13 — Profile

Personal details (editable), photo, languages, contact preference, credential details
(read-only, with "contact Admin to change" — a licence number is a verified fact, not a
self-service field), documents with per-item status, emergency contact, and app settings
(language, notifications, biometric lock, cached data clear).

## G14 — Patient history

Restricted to visits **this caregiver authored or worked**, with dates, services, and a
read-only summary of each visit record. The full clinical record of a patient is not exposed
here; a caregiver sees their own history, not the whole chart. After an assignment ends, only
this authored history remains.

## G15 — Messages

One thread per assignment. The caregiver sees the customer, the assigned address, and the
customer's phone only within the permitted window.

Critical rule: **messages are for logistics, not clinical content.** A caregiver must not
discuss medication doses, diagnoses, or clinical judgement in chat. The composer shows a
persistent one-line reminder, and a keyword heuristic flags a message for dispatcher review when
it detects clinical language, quietly routing it to a human without blocking the caregiver. The
correct channel for clinical communication is the visit record and the Clinical Supervisor. This
is a safety control, not a censorship one — see [11-security](11-security.md) § 6.

## G16 — Safety & incident report

Accessible from every screen, and available even offline.

- Category: patient condition deteriorated / fall / medication error or near miss / injury /
  property damage / no access to property / suspected abuse or neglect / vehicle or traffic
  incident / other
- Severity: Low / Medium / High / Critical
- What happened (free text, 2000 chars, encrypted)
- Actions taken
- Who was present
- Photo attachments
- **Immediate danger selector** — if critical, a prominent red panel: **Call emergency
  services now** with the verified number, plus **Call dispatch now**. It does not wait for
  submission. Save the report locally and upload when possible.
- Submit → notifies the dispatcher and the Clinical Supervisor immediately, and creates a
  high-priority task. An unacknowledged critical report escalates automatically after 5 minutes.

## G17 — My ratings

- Average overall rating with the distribution
- Recent reviews with the comment, the visit service, and the date
- A "what rated well / what to improve" summary, generated from the review dimensions
- A private, admin-only response capability: the caregiver can respond once to a review, and the
  response is shown publicly

---

## Caregiver app cross-cutting requirements

### Offline-first, seriously
This is the difference between an app that gets used and one that gets ignored.

- Cache today's and the next 7 days of assignments, including addresses and care briefs
- Store cached patient data **encrypted on device** using the platform keystore, and purge it on
  logout and after 7 days of no use
- Local drafts for care logs, notes, and photos; autosave every few seconds
- A durable outbox queue for visit completion, incident reports, and messages, with retry and
  backoff
- A visible sync state — online, offline, pending uploads (count), last sync time
- Conflict handling: the server is authoritative for schedule; local visit records merge on
  `client_record_id` idempotency, never by timestamp
- Never lose a completed visit. If sync fails repeatedly, escalate to a dispatcher alert

### Session and device security
- Biometric or PIN lock on the caregiver app (a shared family phone is a realistic risk)
- Screen capture blocked where the platform permits it
- No patient names in the app switcher or notification previews — see [11](11-security.md) § 9
- Auto-logout after 30 minutes idle, shorter than the customer app's 12 hours
- Remote session revocation: suspending an account takes effect on the caregiver's next request
  and kills live-location sharing immediately

### Notifications for caregivers
Offer received (with a response deadline), offer expiring soon, visit starting in 2 hours,
leave-now prompt, visit confirmed, schedule changed, cancellation, incident escalation, payment
processed, approval status changed. Push plus SMS for time-critical items — see
[09-notifications](09-notifications.md).

### Low-end device performance
The target device is not a flagship. Budget for:

- App binary under 25 MB and cold start under 2.5 s on a 2019-era mid-range Android
- List screens virtualised; never load a full year of visits
- Images cached at the size actually displayed, thumbnails for lists
- No jank while the caregiver is scrolling to read a care brief
- Graceful behaviour with 2 GB RAM: aggressive image cache eviction, no memory leaks in the
  photo picker