# 14 — QA & Testing Strategy

## 1. What "done" means here

A feature is done when it is implemented, tested at every layer below, accessible in both
languages, visible in the audit log, and working with the network off. Not when it renders.

In a care platform the cost of a bug is asymmetric. A wrong font size is an annoyance. A caregiver
not seeing a change to a medication instruction, or a customer seeing another household's address,
ends the business. That asymmetry is why the test plan below is weighted toward permission,
privacy, and the field than toward the visual layer.

## 2. Test pyramid

| Layer | Share | What | Runs on |
|---|---|---|---|
| Unit | 60% | Pure logic: pricing, availability, state transitions, eligibility, validation, encryption round-trips | Every commit |
| Integration | 25% | Real Postgres with RLS, real Redis, real object storage, real queues | Every commit |
| Contract | 5% | API schema, backward compatibility, mobile and dashboard client compatibility | Every commit |
| E2E | 8% | Full flows through a real browser and a real device or emulator | Every PR to develop |
| Manual and exploratory | 2% | UX, Amharic rendering, real devices, usability | Weekly, and per release |

Note the low E2E share. E2E is the slowest and most brittle layer; use it for the flows that matter
and cover the branching logic in unit tests. A suite of 400 E2E tests that fails randomly gets
ignored, and an ignored suite protects nothing.

## 3. Layer detail

### Unit

Priority areas, in order:

1. **Pricing engine** — every duration band boundary, every surcharge combination, minimums,
   partial invoices, rounding at santim level. Property-based tests: total always equals the sum of
   lines, never negative, currency consistent
2. **State machines** — every legal transition succeeds; **every illegal transition throws**. A
   generated test over the full transition table asserting no unexpected transition is permitted
3. **Eligibility engine** — each of the 11 rules, and each rule failing independently
4. **Availability** — weekly templates plus exceptions, overnight windows, timezone boundaries,
   midnight, month ends
5. **Recurrence** — daily, weekly, biweekly, monthly on the 29th, 30th, 31st. A monthly booking
   on the 31st in February is a real bug every time
6. **Encryption** — round-trip, nonce uniqueness, tamper detection, key rotation, wrong-key failure
7. **Validation** — phone normalisation for every accepted format, Ethiopian format validation
8. **Permission predicates** — one test per cell in the [02](02-roles-and-permissions.md) matrix
9. **Recurring-series generation** — idempotency on `(request_id, occurrence_index)`

### Integration

Real infrastructure, never mocked. A mocked database will not catch the RLS policy that is subtly
wrong, and RLS is a primary security control here.

- Migrations up and down, on an empty database and on one with data
- RLS policies: for each protected table, one test per role proving access, and one proving
  denial
- Transactional outbox: kill the consumer mid-processing, verify no loss and no duplication
- Queue retry and dead-letter behaviour
- Scheduler jobs: idempotent when run twice, correct when run late
- Key rotation with data written under both versions

### Contract

- The OpenAPI document validates, and client code compiles against it
- Additive changes allowed; removing or retyping a field fails the build
- Old mobile builds against a new API: the test simulates the previous app version's payloads
- Every error code in [07](07-api-contract.md) is exercised at least once

### E2E

Full flows, per role:

**Customer:** register → verify OTP → add patient → add address → request care → dispatcher
reviews → assign → confirm → caregiver arrives → visit completes → invoice issued → customer pays
→ Finance confirms → customer reviews.

**Caregiver:** register → upload credentials → admin approves → set availability → receive offer →
accept → navigate → arrive → complete visit with vitals, notes, and a photo → sync.

**Dispatcher:** log in → see the queue → review a request → request information → answer arrives →
approve → check eligibility → assign → handle a decline → reassign → close the visit.

**Finance:** issue an invoice → record a payment → process a claim → reject a claim → reverse a
payment → reconcile.

**Clinical Supervisor:** read a visit record → find an out-of-range vital → review an incident →
amend a record with a reason → close a follow-up.

Plus: the exception flows. Caregiver no-show, customer cancellation inside 24 hours, licence expiry
mid-series, offline completion, provider outage, a critical incident, a bad notification template
(kill switch).

### Exploratory and manual

Not scripted. Scripted suites test what you thought of.

- Amharic rendering on a real low-end Android, outdoors, at every screen
- 200% text scale on every screen
- Screen reader through the booking flow
- Real caregiver usability sessions. Have three caregivers use the app while you watch and do not
  help. Watch what they struggle with, and note it without correcting them
- Real customer sessions, including one Amharic-only speaker
- Real Addis network conditions: force 2G, add 800 ms latency, drop connection mid-submission
- Battery drain over a full caregiver day
- Behaviour with storage full
- Behaviour with clock skew, since visit timing depends on device time

## 4. Security testing

Non-negotiable, and CI-gated. See [11](11-security.md).

| Test | Method | Pass condition |
|---|---|---|
| Permission matrix | Every endpoint × every role | Positive passes, **negative returns 403** |
| IDOR, cross-household | Customer A reads Customer B's data | 404, no data leaked |
| IDOR, cross-caregiver | Caregiver A reads Caregiver B's appointment | 404 |
| Clinical schema isolation | Every role against every protected table | Only authorised roles |
| RLS bypass | Direct DB access with the app role | RLS holds |
| Mass assignment | Inject `role`, `status`, `price_santim` into a request body | Rejected |
| Price manipulation | Submit a client-computed total | Server recomputes; client value ignored |
| Privilege escalation | Customer sets their own role | Rejected |
| Token reuse | Replay a rotated refresh token | Family revoked, `401` |
| Rate limits | Exceed every documented limit | `429` with `Retry-After` |
| OTP enumeration | Unknown vs known phone | Identical response, body, and timing |
| File upload | Malicious file, oversized, wrong MIME, EXIF GPS | Rejected or stripped |
| SSRF | Location and photo URLs pointing at internal IPs | Blocked |
| Injection | SQL injection across every parameter | Parameterised, no leakage |
| XSS | Patient name, address, landmark, message body | Escaped everywhere |
| PHI in logs | Capture all logs and errors during E2E | Zero PHI keys |
| PHI in analytics | Inspect every event and property | Zero PHI |
| PHI in notifications | Attempt a clinical payload | Rejected by the allowlist |
| PHI in URLs | Inspect every request | No clinical value in any URL |
| Screenshot handling | Capture the screen on clinical views | Blocked or detected per platform |
| Session revocation | Suspend a caregiver mid-session | Access denied on the next request |

**Every negative test is mandatory.** An endpoint with no permission test passes a suite that only
asserts the happy path. That is how IDOR bugs ship.

## 5. Offline and connectivity testing

The caregiver app's defining constraint. Test with real network manipulation, not mocks.

| Scenario | Expected |
|---|---|
| Load the today-screen with no signal | Cached visits and care briefs shown, offline banner |
| Complete a visit with no signal | Saved locally, clear "Saved on your phone", syncs on reconnect |
| Kill the app after completing a visit | Record persists, syncs on next launch |
| Replay a completed visit | `duplicate: true`, one record only |
| Lose signal mid-upload of a photo | Resumes, no duplicate, integrity verified |
| Reconnect after 6 hours | Escalation alert, not silent loss |
| Compose a message offline | Queued, visible as pending, sends on reconnect |
| Server rejects an offline sync | Clear error, caregiver informed, no data lost |
| Two devices, same account, caregiver accepts then the server rejects | Conflict handled, no double-booking |
| Clock skew between device and server | Server time authoritative, deviation recorded |
| Storage full mid-photo | Clear message, no corrupt record |
| Airplane mode through a full visit | Every step still works |

Also: the queue must be durable. A queue in memory is lost when the app is killed, which is exactly
when you need it.

## 6. Device and browser coverage

### Android (primary)

| Tier | Device class | Minimum OS |
|---|---|---|
| Primary | Samsung Galaxy A-series, Tecno Spark, Infinix Hot | Android 10 (API 29) |
| Secondary | Older and lower-end | Android 8 (API 26) |
| Latest | Current flagship | Current |

Test on real hardware, not only the emulator. Emulators misrepresent memory pressure, GPS
behaviour, and camera performance.

Performance budgets:

| Metric | Budget |
|---|---|
| App binary | < 25 MB |
| Cold start | < 2.5 s |
| Warm start | < 1 s |
| Today-screen time to content | < 1 s from cache, < 2 s online |
| Frame rate while scrolling a care brief | 60 fps |
| Memory | < 200 MB on a 2 GB device |
| Battery over an 8-hour day with background location | < 15% |
| Visit completion form interaction | < 60 taps |

Sixty taps to complete a visit is generous. If it takes more, caregivers skip documentation, and
missing documentation is a legal problem.

### iOS

iPhone 12 or newer, iOS 16+. Same performance budgets. Note that iOS background location is far
more restrictive; verify live location sharing actually works when the app is backgrounded, and
design the fallback if it does not.

### Admin browsers

Chrome, Edge, Safari, Firefox. Current and previous major version. The dashboard is desktop-first
but must work on a phone, because a dispatcher in the field has one phone.

## 7. Performance testing

| Scenario | Target |
|---|---|
| Booking submission | < 800 ms server time |
| Dispatcher queue, 50k appointments | < 500 ms |
| Schedule day view | < 1 s |
| Caregiver today-screen, 20 visits | < 200 ms cached |
| Visit completion upload with a photo | < 5 s on 4G |
| Client lists | < 1 s |
| Revenue report, 12 months | < 3 s |
| Concurrent | 100 active users, 20 caregivers location pinging |

Load test at 3× expected peak with a real-shaped dataset. A dashboard that is fast with 200 seeded
requests is not fast at 20,000.

## 8. Localisation testing

| Test | Requirement |
|---|---|
| Language switching | Instant, no restart, preserves screen state |
| Amharic completeness | Every user-facing string in `am`. No key falls back to English |
| Fallback detection | Deliberately missing `am` string shows `en` **and** increments the metric |
| Text expansion | Layout holds at Amharic string lengths |
| 200% text scale | No truncation, no horizontal scroll |
| Mixed content | No English service names inside Amharic sentences |
| Numbers and dates | Latin digits, correct format, correct calendar |
| Font rendering | All Ethiopic glyphs on the lowest-cost target device, no clipping |
| Currency | `ETB` formatting correct, thousands separators correct |
| Clinical review | Amharic clinical copy reviewed by a fluent healthcare speaker, recorded |
| Emergency screen | Amharic by default regardless of app language |

## 9. Accessibility testing

Automated plus manual. Automated catches roughly a third of issues.

| Tool | Coverage |
|---|---|
| Flutter `integration_test` semantics checks | Labels, roles, contrast |
| axe-core on the dashboard | Automated accessibility rules |
| Screen reader manual pass | VoiceOver (iOS), TalkBack (Android) through critical flows |
| Contrast verification | Token-level, both themes |
| Text-scale pass | Every screen at 200% |
| Keyboard-only pass | Dashboard, all interactive elements |
| Reduced motion | Animation preferences respected |

WCAG 2.1 AA for both apps and the dashboard. Where you fall short of full conformance, document
which criterion and why, rather than claiming conformance you do not have.

## 10. Data integrity tests

Money and clinical records, tested specifically:

- Integer santim throughout: no float ever reaches a money column
- Invoice total always equals the sum of its lines
- Rounding at every band boundary
- Partial payments accumulate correctly; the balance never goes negative
- Refunds never exceed the payment
- Reversals never delete history
- Invoice numbers are sequential, unique, and never reused
- Prices are effective-dated; a quote never changes after issue
- Visit records lock after 24 hours
- Amendments are appended, never in place; the original is preserved
- Concurrent accept on one offer yields exactly one winner
- Recurrence generation is idempotent
- `audit.log` chain verification detects an injected or modified row
- Field encryption round-trips, and raw table inspection shows no plaintext

## 11. Release gates

Nothing ships to production without all of these.

**Automated, blocking:**

- [ ] All unit, integration, contract, and E2E tests pass
- [ ] Every permission matrix test passes, positive and negative
- [ ] Every IDOR test passes
- [ ] PHI-leak tests pass across logs, analytics, errors, notifications, and URLs
- [ ] Dependency scan: no high or critical CVE
- [ ] SAST and container scan: no unresolved high or critical
- [ ] No secret detected
- [ ] No breaking API change without a version bump
- [ ] Migrations apply and roll back cleanly on a populated database
- [ ] Backup restore rehearsed for this release
- [ ] Mobile crash-free above threshold on internal and closed testing
- [ ] Performance budgets met

**Manual, blocking:**

- [ ] Amharic pass on every changed screen
- [ ] Accessibility pass on every changed screen
- [ ] Empty, loading, error, permission, and offline states verified
- [ ] Real-device pass on the primary Android device
- [ ] Clinical review of any changed clinical copy
- [ ] Runbook updated for any new failure mode
- [ ] Rollback plan written and understood
- [ ] Feature flag defaults correct

**Non-blocking, but required before any real patient data:**

- [ ] Independent penetration test passed
- [ ] Legal review complete
- [ ] Insurance in place
- [ ] Staff trained and recorded

## 12. Beta and pilot plan

Do not launch to the public. Launch to a cohort you control.

### Internal (week 1–2)

A team account per role plus 3 seeded caregivers, testing on a variety of devices. Goal: crashes,
bugs, and obviously broken flows.

### Closed beta (week 3–6)

- 5–10 caregivers, hand-picked
- 10–20 customers, recruited from your existing network
- Real services, real payments, real visits
- Weekly check-ins with every caregiver. Ask what was confusing
- Daily error review
- Release to the beta cohort every few days

**Watch documentation compliance above everything else.** If caregivers are not completing visit
records, the app is failing at the one job that matters most. That is the signal that the
completion form is too long, or that they are being interrupted.

### Pilot (week 7–10)

20–30 caregivers, 50–100 customers. Full operational load. Legal, insurance, and compliance in
place. Formal incident response active.

### Public launch

Only when the pilot runs two consecutive weeks with:

- Zero PHI incidents
- Documentation compliance above 95%
- Fill rate above 80%
- Crash-free rate above 99.5%
- No unresolved severity-1 or severity-2 defects
- A working backup restore
- A written and rehearsed breach plan

## 13. Severity definitions

| Severity | Meaning | Response | Example |
|---|---|---|---|
| **S1** | Patient safety, privacy, or financial breach | Immediate, roll back or hotfix | Cross-patient data leak; wrong caregiver assigned; a caregiver marked arrived without visiting |
| **S2** | A core flow is broken, with no workaround | Same day | Booking cannot be submitted; visit record cannot be saved; no caregiver can be assigned |
| **S3** | A core flow is degraded, workaround exists | Next release | Notification does not arrive, app still works |
| **S4** | Cosmetic or minor | Backlog | Label truncation; an empty state reads awkwardly |

S1 and S2 get an incident record: timeline, root cause, fix, and a test that would have caught it.
That last part is the one that reduces future incidents, and it is the one teams skip.

**The tests that must never be skipped**, because they correspond to S1:

- Cross-household and cross-caregiver data access
- No PHI in notifications, logs, or URLs
- State machine integrity, especially `IN_PROGRESS` → `COMPLETED`
- Double-booking under concurrent offers
- Caregiver approval and licence enforcement
- Offline visit record durability
- Encryption round-trip and key rotation
- Audit log integrity

## 14. Test data

- Generated and obviously synthetic. Names, addresses, and clinical details invented, never
  resembling real people
- Seed every status, including the ones you would rather avoid: reassigned twice, partially paid,
  disputed, declined three times, licence expired, offline-synced late
- 12 months of history so reports and retention jobs have something to work on
- A patient with 200 historical visits, to test pagination and performance
- An account with 5 patients and 12 addresses, to test the household edge cases
- A caregiver cleared for 9 services and fully booked, to test the availability edge cases
- Named fixtures for the critical flows, so a failing E2E test tells you exactly what broke

Never production data in a test environment. Not anonymised, not sampled. Ever.