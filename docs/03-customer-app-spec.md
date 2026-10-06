# 03 — Customer App Specification

Screens, fields, validation, and states. Field naming matches [06-data-model](06-data-model.md).
Every screen lists its empty, loading, and error states — the three most commonly skipped
parts of a spec and the three most common sources of a bad first impression.

## Screen inventory

| # | Screen | Route | Purpose |
|---|---|---|---|
| C1 | Onboarding / value prop | `/onboarding` | Explain, set expectations |
| C2 | Phone entry | `/auth/phone` | Start registration or login |
| C3 | OTP verification | `/auth/otp` | Prove phone ownership |
| C4 | Registration form | `/auth/register` | Collect identity details |
| C5 | Login (password) | `/auth/login` | Returning user |
| C6 | Home | `/home` | Entry point to every action |
| C7 | Request care wizard | `/request/:step` | 6-step booking flow |
| C8 | Service catalogue | `/services` | Browse all services |
| C9 | Service detail | `/services/:code` | What it includes, price |
| C10 | Requests list | `/requests` | All requests, filterable |
| C11 | Request detail + tracker | `/requests/:id` | Status, caregiver, actions |
| C12 | Upcoming visits | `/visits` | Schedule view |
| C13 | Visit detail | `/visits/:id` | Caregiver info, prep, actions |
| C14 | Messages | `/threads`, `/threads/:id` | Non-clinical communication |
| C15 | Quote / price breakdown | `/requests/:id/quote` | Estimate, surcharge lines |
| C16 | Invoices & payments | `/billing` | Balances, payment history |
| C17 | Post-visit review | `/visits/:id/review` | Rating and comment |
| C18 | Patients | `/patients` | Household patient list |
| C19 | Patient editor | `/patients/:id` | Health profile |
| C20 | Profile & settings | `/profile` | Account, language, consent |
| C21 | Address editor | `/addresses/:id?` | Structured Addis addresses |
| C22 | Emergency info | `/emergency` | Safety information |
| C23 | Notifications | `/notifications` | Notification centre |
| C24 | Help / support | `/help` | Contact, FAQ |

---

## C1 — Onboarding

Three full-screen slides, swipeable, with a Skip action on every slide except the first.

- Slide 1: "Care at home, from people you can trust." Vetted nurses and care workers.
- Slide 2: "Book in under two minutes." Choose a service, a time, and we handle the rest.
- Slide 3: "You're always told who's coming." You see your caregiver's name and photo before
  the visit.
- Button: **Get started** → C2.
- Link: **I already have an account** → C5.

Also on this screen, in the language matching the device: a single line stating the service area
("Currently serving Addis Ababa sub-cities: Bole, Kirkos, Nega Alemiya, Yeka, Arada, Gullele,
Lideta, Shashemene, Kolfe Keranio, Akaky Kaliti, Aba Shum Mellash — more coming") with a link to
the full list. Setting expectations prevents support calls.

## C2 — Phone entry

**Fields**

| Field | Type | Validation | Notes |
|---|---|---|---|
| Phone | Tel, numeric keypad | Ethiopian format, required | See format rules below |

**Format rules.** Accept `09xxxxxxxx`, `07xxxxxxxx`, `+2519xxxxxxxx`, `9xxxxxxxx`, `2519xxxxxxxx`.
Normalise internally to E.164 `+2519XXXXXXXX`. Show a hint when the number looks wrong *before*
submitting: "That number looks short. Ethiopian mobile numbers have 9 digits after 0."
Do not block submission on the pattern alone; let OTP be the real check.

**Buttons:** Continue (primary, full width), Language selector (top right, persistent).

**Errors:** network failure → inline message + Retry. Rate limited → "Too many attempts.
Try again in N minutes." Count down visibly.

## C3 — OTP verification

Send a 6-digit code. Resend every 45 seconds, max 5 sends. Code valid 10 minutes.

- 6 separate one-character boxes with a single hidden input, auto-advance on entry, auto-submit
  on the 6th.
- Paste support: pasting a 6-digit string fills all boxes.
- Wrong code: shake animation, "Incorrect code. N attempts remaining."
- 3 wrong attempts: new code required, and after 5, a 15-minute lockout on that phone number.
- **Backspace behaviour:** clearing the last box focuses the previous and clears it.
- Buttons: **Verify**, **Resend code** (with countdown), **Change number**.
- Display: "Sent to +251 9XX XXX XXX". Never reveal the number in full on a shared screen —
  mask the middle three digits.

**Failure mode that matters:** if the number is not registered, do not say "no account exists" on
this screen. Say "We could not verify that number. Check it and try again, or continue
registration." Confirming which numbers exist in your system is an enumeration risk.

## C4 — Registration form

Two steps on one scrollable page with a clear progress indicator.

**Step 1 — About you**

| Field | Type | Required | Validation |
|---|---|---|---|
| Full name | Text, 2 words min | Yes | 2–100 chars, letters and spaces and hyphens |
| Email | Email | No | RFC-shaped, max 254 |
| Password | Password, masked | Yes | Min 10 chars, must not be one of the 20 commonest passwords, strength meter |
| Confirm password | Password | Yes | Must match |
| Address | Structure picker | Yes | See C21 |
| Emergency contact name | Text | Yes | 2–100 chars |
| Emergency contact phone | Tel | Yes | Must differ from the account phone |

**Step 2 — Consent**

- [ ] I agree to the Terms of Service (link, opens in-app modal with full text)
- [ ] I agree to the Privacy Policy (link)
- [ ] I consent to the processing of health data for the purpose of providing care. This is a
  **separate checkbox with distinct copy** — it must not be bundled into "I agree to the terms."
  Bundling health-data consent into general terms is exactly the pattern regulators object to.
- [ ] Optional: send me service updates and offers

Both required boxes must be checked. Record `consent_version` and a timestamp for each — see
[11-security](11-security.md) § 7.

**Buttons:** Create account (primary), Back.
**Success:** navigate to C6 with a welcome sheet offering the first booking.

**Password requirements shown to the user before they fail validation**, not after.

## C5 — Login (password)

Fields: phone, password. Button: **Sign in**. Link: **Forgot password** → OTP-based reset
(verification C3, then a new-password screen with the same rules as C4). Show
"Use phone code instead" as a secondary option.

Rate limit: 5 failed attempts → 15-minute lockout, escalating to 24 h after repeated offences
from the same number or device. Never reveal whether the phone exists. Generic error:
"We could not sign you in. Check your details and try again."

Optional sign-in providers (Google, Apple) — build as pluggable from the start, enable later.

## C6 — Home

Layout, top to bottom:

1. **Greeting + language toggle** — "Good morning, Abebe" and a globe icon.
2. **Urgent care strip** — persistent, subtle, amber. "[Company Name] urgent line: 9XX XXX XXX".
   Tapping opens a call action. Present on every screen via an app bar affordance, never a
   full-screen takeover.
3. **Primary action** — a single large filled button: **Request home care**.
4. **Next visit card** — if a visit exists in the next 24 hours: date/time, service, caregiver
   photo and name (or "Being arranged"), address, and a **View details** link.
5. **Request in progress** — if any request is between SUBMITTED and CONFIRMED: a status card
   with the current status label and the tracker. This is the reassurance the anxious user
   needs most.
6. **Quick actions** — four tiles: My patients, Upcoming visits, Messages, Billing.
7. **Service shortcuts** — horizontal scroll of the six most-used services, each with name and
   "from ETB X".
8. **Help** — small link to C24.

Empty state (no data at all): replace items 4 and 5 with an illustration and one line: "No
upcoming care. Request care whenever you need it." Never show an empty dashboard with three
blank sections.

## C7 — Request care wizard

Six steps. Progress bar with labelled steps. **Every step autosaves locally**, so a dropped
connection or a backgrounded app does not lose 15 minutes of typed input. A resumable draft is
created on first entry; it is submitted or discarded explicitly.

### Step 1 — Who needs care?

- Patient selector: existing patients as cards (name, age, care-needs summary), or **Add new
  patient** which opens C19 inline and returns here.
- Service selection: a searchable list of the 9 services with a one-line description and
  "from ETB X". Selecting one shows an inline expandable summary of what is included.
- Optional: **Additional services** (multi-select). This supports real cases such as nursing plus
  physiotherapy. Each addition re-quotes the price transparently.

### Step 2 — Patient details

- Patient name (prefilled), age or date of birth (toggle — store DOB, display age), gender
  (Male / Female / Other / Prefer not to say)
- **Care needs** — multi-select chips plus a free-text field (max 2000 chars)
- **Mobility** — Independent / Needs assistance / Uses walking aid / Wheelchair / Bedbound /
  Other
- **Relevant medications** — repeatable rows: name, dose, frequency, time of day. Mark any that
  require administration. Warn: "A licensed nurse must administer medications. Our nurse will
  confirm the care plan."
- **Special requirements** — free text (max 1000 chars): pets, gate code, no shoes inside,
  religious requirements, preferred caregiver gender, language
- **Consent checkbox:** "I confirm I am authorised to arrange care for this patient."
  Required. A family member booking for a parent must be explicit about this.

Field-level note: this is health data. It is encrypted at rest per [11-security](11-security.md),
never logged in plaintext, never included in analytics events, and never sent to third-party
analytics. Show the user that it is handled securely — a one-line note under the step title
builds trust.

### Step 3 — When?

- **One-time or recurring** — segmented control.
  - One-time: date picker (min = today + 4 h lead, max = today + 90 d), start time picker
    (15-min granularity), duration picker (1–24 h in 30-min steps; default = service default)
  - Recurring: frequency (Daily / Weekly / Every 2 weeks / Monthly on day N), days-of-week
    selector for weekly, end condition (After N visits / On date / Never), same start time and
    duration
- **Suggested times** — for same-day and urgent, show what is likely available given your
  current caregiver capacity. Availability is advisory at this step; final confirmation happens
  after assignment. Label it "Most caregivers are free at:" so it does not become a promise.
- Timezone: Africa/Addis_Ababa, stored UTC. Display local. Never store a naive local timestamp.

### Step 4 — Where?

- Address selector: saved addresses as cards, or **Add new address** → C21 inline
- Location capture: map with a draggable pin, or "Use my current location" (requests a GPS fix;
  if denied, fall back to manual: sub-city → woreda → kebele → house number → landmark)
- Landmark field (required, min 5 chars). In Addis a landmark is often more useful than a house
  number, so make this prominent rather than a footnote.
- **Access notes** — "Is there a gate, a dog, a floor without a lift, a building the caregiver
  should enter through?" Optional but asked, because it prevents failed visits.

Validation: the address must resolve to a known sub-city. If the pin falls outside the served
area, warn early: "This address may be outside our current service area. We'll confirm within
2 hours." Do not silently accept and fail at assignment time.

### Step 5 — Emergency contact & urgency

- Emergency contact for this patient: prefill from the account, editable, with name, phone,
  relationship
- **Urgency** — three options with honest copy:
  - Routine (default) — "Care within a scheduled visit"
  - Urgent (next 24 h) — "Needed within 24 hours"
  - Urgent (today) — "Needed today if possible"
- If Urgent is selected, show the urgent-care strip and the note: "For a medical emergency,
  please call [emergency number] or go to the nearest emergency department. This service is not
  an emergency response."
- Special instructions (free text, 500 chars)

### Step 6 — Review & submit

A single consolidated review of all five steps, each row with an **Edit** link that returns to
that step with state preserved.

Below it, the **price estimate** (see C15):
- Service base price
- Duration line (hours × rate, or flat per visit)
- Surcharges: night / weekend / urgent, each with its own line and reason
- Transport, if applicable
- **Estimated total: ETB X**
- "This is an estimate. The final amount is confirmed on your quote and may change if the
  service requirements change."

Buttons: **Request care** (primary), Back. Secondary: **Save as draft**.

**Post-submit behaviour**
- Success sheet: "Request received", what happens next in three lines ("We'll review and assign
  a caregiver. You'll get a notification."), the request number, and two buttons: **View
  request** and **Add to calendar**.
- Calendar: write an `.ics` event with start/end, title "Home care visit — [Service]", location
  as the address, and a description with the service code and request number. **Do not put
  patient health details in the calendar description** — calendars sync to third-party servers.
  This is a real and commonly missed leak. Include the request number and a deep link back into
  the app instead.

## C8 — Service catalogue

List of the 9 services. Each card: icon, English name, Amharic name, one-line description,
"from ETB X", duration default, and a badge if it requires a licensed nurse. Search and filter
by category. If a service is inactive, it does not appear; if a customer's existing request uses
a now-inactive service, existing bookings remain visible and are labelled.

## C9 — Service detail

- Title, description
- **What is included** — checklist (each service needs this written by you before launch;
  it is the single most useful thing on this screen and the cheapest way to reduce support calls)
- **What is not included** — equally important, and legally protective
- Duration and price bands as a small table
- "Requires a licensed nurse" badge where applicable
- Frequently asked questions for that service
- Primary button: **Request this service** → C7 with the service preselected

## C10 — Requests list

Tabs: All / Upcoming / In progress / Completed / Cancelled.
Each row: service name, patient name, date and time, status chip, caregiver name once assigned,
amount, and a chevron. Filter by date range. Pull to refresh. Paginated, infinite scroll.

Swipe actions: Cancel (only when status allows it, per
[08-workflows](08-workflows.md)) and Contact.

## C11 — Request detail & tracker

The most-visited screen. Sections:

1. **Header** — service, patient, request number, booking date and time
2. **Status tracker** — a horizontal stepper with the seven stages from the original spec,
   each with a label, an icon, and a timestamp where it applies:
   `Requested → Under review → Caregiver assigned → Confirmed → Caregiver arriving → In
   progress → Completed`
   Current stage highlighted, past stages ticked, future stages greyed. Tapping a completed
   stage shows what happened and when.
3. **Caregiver card** — appears at "Caregiver assigned". Photo, name, professional qualification,
   experience, languages spoken, a **Verify** line explaining how the caregiver was vetted
   (licence checked, training, background), and a "same caregiver" preference toggle that
   applies to future bookings.
4. **Appointment** — date, start, end, duration, address with a map thumbnail and a "View map"
   action, and access notes.
5. **Price** — link to C15.
6. **Actions**, contextual to status:
   - `SUBMITTED` / `UNDER_REVIEW` — Cancel request, Message us, Call us
   - `NEEDS_INFO` — **Provide information** (prominent; see below)
   - `ASSIGNED` — Confirm caregiver, Request a change, Cancel
   - `CONFIRMED` — Message caregiver (through us, not direct), Reschedule request, Cancel
   - `EN_ROUTE` — Live status note, Message us
   - `IN_PROGRESS` — Message us, Call us
   - `COMPLETED` — View visit summary, Leave a review, Pay invoice
   - `UNABLE_TO_FULFILL` — reason, alternatives offered, Contact office (see below)
   - `CANCELLED` — cancellation reason, Re-book this service (prefilled request)
7. **Timeline** — a chronological log of every event with timestamps: submitted, reviewed,
   caregiver offered, accepted, arrival recorded, completed, invoiced. Customers find this
   reassuring and it reduces "where is my nurse" calls dramatically.
8. **Invoice summary** — if any, with balance and a Pay button (which in v1 shows payment
   instructions rather than a gateway).

**NEEDS_INFO state.** Shown as a distinct amber panel, not just a status chip: "Our team needs
a little more information before we can assign a caregiver", with the specific questions inline
in a form the customer can answer on this screen. Answering re-submits without a new request
and notifies the dispatcher. This is the highest-value improvement to request completion rate.

**UNABLE_TO_FULFILL state.** A dedicated full-width panel: apology, a plain-language reason
("We do not have a physiotherapist available in your sub-city this week"), what was tried, and
offered alternatives (different service, different date, a referred partner). Buttons: **Request
alternative dates**, **Choose another service**, **Contact our office**. Tone matters here — this
is a customer you want to keep. Never show a bare failure state.

## C12 — Upcoming visits

Grouped by day: Today / Tomorrow / This week / Later. Each row: time range, service, caregiver
photo and name, patient name, address, status chip. Swipe: Get directions, Message us, Cancel
(where allowed). Empty state: "No upcoming visits. Request care whenever you need it." plus
a primary **Request care** button.

## C13 — Visit detail

- Date, time range, duration, service
- **Caregiver card** with photo, name, qualification, "Verified by [Company]" line, languages
- Address with map and **Directions** (external maps deep link)
- **Preparation checklist** — derived from the access notes and special requirements, plus a
  standard list: secure pets, clear the path, provide a private room, have medication
  available, valid ID for the caregiver to see if required
- Live status card when `EN_ROUTE` or `IN_PROGRESS`: status text and last-updated timestamp
- Actions: **Message us**, **Cancel visit**, **Directions**, and after completion **Leave a
  review**
- Arrival proof, once the visit completes: arrival and departure timestamps, and an
  **I confirm this visit took place** checkbox with a submit action. This is a lightweight
  dispute-resolution control and is worth building.

## C14 — Messages

Thread list: one thread per request, showing the other party, last message preview, unread count,
and timestamp. Thread view: bubbles, sender avatar, timestamps, and a composer.

**Constraint, enforced in the UI copy:** "Please do not send detailed medical information
through chat. Our team will discuss clinical details during the visit or by phone." Show this
once when the thread is first opened, dismissible.

Message delivery states: sending, sent, delivered, read, failed (with Retry). Offline queue:
composed messages queue and send on reconnect, visible as "Waiting to send".

Escrow-style rule: a message can be sent any time the request exists. The customer is never
locked out of communication.

## C15 — Quote & price breakdown

Line items, each with a label and amount:

| Line | Source |
|---|---|
| Service base fee | `service_prices` for the service |
| Duration adjustment | hours × hourly rate, when billed hourly |
| Night surcharge | `night` if start between 21:00 and 06:00 |
| Weekend / holiday surcharge | `weekend` or the Ethiopian public holiday calendar |
| Urgent surcharge | `urgent` if urgency is urgent |
| Transport / travel | Fixed amount by sub-city |
| Discount | Promo code or admin-applied |
| **Total** | Summed; VAT if applicable (confirm with your accountant) |

Each surcharge line shows a one-line explanation. State whether the amount is fixed or
estimated. Link to the full price list. Show what happens if the visit runs long: "Additional
hours are billed at the hourly rate and require your approval in advance."

## C16 — Invoices & payments

- Outstanding balance card at the top, prominent if non-zero
- Invoice list: number, service, date, total, paid/partial/unpaid chip, **View**
- Payment history: date, amount, method, reference, receipt number
- Payment instructions (v1): account name, bank, account number, Telebirr/CBE Birr number, and
  the exact reference to quote — with a copy-to-clipboard button for the reference
- **I have paid** button → a form: amount, date, method, transaction reference, optional
  upload of a transfer receipt photo. Submission creates a `payment_claim` for Finance review
  and shows "Your payment is being verified. This usually takes one business day."
- Dispute action: **Report a problem with this bill** → creates a flagged invoice task for
  Finance with the conversation attached

Do not mark a payment as complete from the customer's claim. Finance confirms it against the
bank statement. See [10-payments](10-payments.md).

## C17 — Post-visit review

Shown after `COMPLETED`, once, with the caregiver name and photo.

- **Overall rating** — 1–5 stars, required
- **Professionalism** — 1–5 stars, required
- **Punctuality** — 1–5 stars, required
- **Quality of service** — 1–5 stars, required
- **Comment** — optional, 1000 chars, with an optional "share with [Company]" toggle,
  default on, because reviews with consent are useful to you and the caregiver
- Submit once. Edit within 7 days. After that, locked.
- Incentive, if you run one: "Rate this visit to get ETB X off your next booking" — only if the
  economics work, and never as a condition of receiving care.

## C18 — Patients

List of the customer's patients. Each card: name, age, gender, mobility, key care needs
truncated, active-service badge, and an **Active** / **Past** separator. **Add patient** primary
action. Swipe to edit.

## C19 — Patient editor

Form fields per C7 Step 2. Also: allergies, doctor's name and phone, current medications as
repeatable rows, an optional photo, and a private notes field visible only to the household.

Show a clear note: "This information is encrypted and only visible to the caregiver assigned to
your patient and to our clinical supervisor." That sentence is a feature.

Deletion: soft delete with confirmation, warning that the clinical record is retained per policy
but hidden from the app. See [11-security](11-security.md) § 8.

## C20 — Profile & settings

Sections:
- **Personal** — name, email, phone (with re-verification on change), password change
- **Addresses** — list, add, edit, set default, delete
- **Emergency contacts** — list, add, edit, delete
- **Language** — English / አማርኛ (system, plus the device-language default detected on first run)
- **Notifications** — per-channel toggles for push, SMS, email, grouped by event category
- **Privacy & consent** — view and re-download the privacy policy and consent records, with a
  timestamp and version for each, and a **Withdraw consent** action that explains the consequence
- **Household access** — read-only in v1: who else can see this household. Shows a note that
  inviting family members arrives in a later release, so the screen does not promise it
- **Support** — call, message, FAQ
- **Account** — **Request account closure** with an explicit explanation of what is deleted,
  what is retained and why, and a confirmation that this cannot be undone. Never a hidden
  "delete my account" in a settings list.

## C21 — Address editor

Structured, in order, all required except where noted:

1. Label (Home / Work / Other) — required
2. Sub-city — required, from the reference table
3. Woreda — required, filtered by sub-city
4. Kebele — required, free text with validation (Ethiopic digits and Latin both accepted;
   normalise to Latin internally)
5. House number — required
6. Landmark — required, min 5 chars. Helper text: "A nearby shop, church, or junction that helps
   a caregiver find you quickly."
7. Phone for this address — optional
8. Map pin — draggable, or "Use my current location"
9. Access notes — optional free text

**GPS permission is requested here, not at app launch.** Ask when the user reaches the pin
step, with a rationale string explaining why. If denied: the structured address plus the
landmark is enough for dispatch, so the flow must complete without a pin. Save the pin anyway
if they grant it, and use the centroid of the sub-city for travel estimates if they do not.

## C22 — Emergency information

Reachable from the home screen strip, from every appointment detail, and from a persistent
app-bar affordance. Not a full-screen takeover, except when explicitly opened.

Content, in this order:
1. **Amharic first, English second** — for this screen specifically, Amharic is the default
   regardless of app language. It may be the only thing read in a crisis.
2. **For a medical emergency: call [official Ethiopian emergency number]** — stored as an
   admin-editable config value. Verified number appears before launch — see
   [16-open-questions](16-open-questions.md).
3. **Go to the nearest emergency department.** A static, non-geolocated statement is more honest
   than a broken "find nearest" feature. If you build hospital lookup later, it must be
   maintained, or it will send people somewhere wrong.
4. **Our urgent care line: [number]** — labelled clearly as **not** an ambulance and **not** an
   emergency service: "For urgent care questions and to reschedule visits. We are not an
   emergency response service."
5. **Office hours** and what happens if you call outside them
6. A short "why this screen exists" note for the customer

No account data is required to view this screen. It works pre-login and offline. This matters:
the person in a crisis may not have your app open.

## C23 — Notifications

Grouped by day. Unread indicator on the tab bar badge. Each item: icon by type, title, body,
timestamp, deep link to the relevant screen. A **Mark all read** action. Notification settings
shortcut. Tapping an item opens its target screen and marks it read.

## C24 — Help & support

- **Call our office** (primary), **Message us**
- Urgent-care line, marked as not-an-emergency
- FAQ in English and Amharic, grouped by booking, caregivers, payments, and safety
- "How we vet our caregivers" — an explainer page. Reduces the single most common objection.
- Privacy policy, terms
- App version, and a "Report a problem" action that opens an email with diagnostic data
  attached only on the user's confirmation

---

## Customer app cross-cutting requirements

### Offline and poor connectivity
- Cache the service catalogue, the customer's own patients, and upcoming visits
- The booking wizard autosaves locally and survives an app kill
- Queue requests and messages; show clear pending state
- Show a connectivity indicator, but never block a write action — queue and let the user proceed
- On reconnect, sync and surface failures honestly

### Push and local notifications
FCM for push, an in-app inbox for reliability, and local notifications for scheduled
reminders. See [09-notifications](09-notifications.md) for the event matrix.

### Accessibility
Minimum 48 dp touch targets, dynamic text to 200% without truncation, screen-reader labels on
every icon-only control, contrast at or above WCAG AA (4.5:1 for body text), and no
meaning-by-colour-only status indication — pair every colour with an icon and a text label. The
caregiver screen should support a larger default type size, since users will be reading it in
poor light.

### Data protection visible in the UI
- Privacy notice on first launch, before registration
- Consent capture as separate, specific checkboxes ([11](11-security.md) § 7)
- Screenshot deterrence on clinical screens where the platform allows it ([11](11-security.md) § 9)
- No patient health data in notification bodies. "Your visit is confirmed" — never
  "Wound care visit for your mother at 14:00".
- A "download my data" request action, routed to a human, per [11](11-security.md) § 8