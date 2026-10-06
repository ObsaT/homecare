# 11 — Security, Privacy & Compliance

This document is not optional reading. A platform that handles patient names, health
conditions, addresses, and medication lists, and that gives care providers access to them, is a
high-value target and a legal obligation. Build this in from the first commit.

**This is an engineering specification, not legal advice.** Ethiopian and Addis Ababa city
regulatory requirements must be confirmed by a qualified local lawyer before launch. The specific
items to raise with them are listed in [16-open-questions](16-open-questions.md).

## 1. What counts as sensitive here

| Category | Examples | Handling |
|---|---|---|
| **PHI — protected health information** | Diagnoses, care needs, medications, allergies, vitals, visit notes, wound photos, mobility, service type tied to a named patient | Field-level encryption, clinical schema, clinical audit log, restricted roles |
| **PII** | Names, phone numbers, email, addresses, GPS, emergency contacts | Encrypted where sensitive, minimised everywhere, access logged |
| **Credentials** | Passwords, OTPs, tokens, refresh tokens, API keys, licence numbers, bank details | Argon2id / sha256+pepper, never stored in plaintext, never logged |
| **Financial** | Invoices, payments, bank details | `fin` schema, Finance-only access, append-only records |
| **Operational** | Service prices, schedules, caregiver location | Business confidential, least privilege |

Note that in this platform, almost every business record becomes PHI in combination. A caregiver's
name plus a service code plus a date is a patient identity disclosure if the caregiver is a
neighbour. Aggregate only, never expose a service list next to a customer list on a shared screen.

## 2. Threat model

Realistic threats for this system, ranked by expected impact:

| # | Threat | Mitigation |
|---|---|---|
| 1 | Caregiver browsing patients they are not assigned to | Object-level scope checks, RLS, clinical audit log, anomaly detection |
| 2 | Customer A seeing Customer B's data (IDOR) | UUIDs are not authorisation. Scope every query by owner. 404 not 403 |
| 3 | Insider browsing of clinical records | Clinical audit log, per-read logging, pattern alerts, least privilege by role |
| 4 | Stolen or shared phone exposing cached data | Keystore-encrypted cache, biometric lock, idle timeout, remote wipe |
| 5 | Database backup leak | Encrypted volumes, KMS keys, encrypted backups, tested restoration |
| 6 | Man-in-the-middle interception | TLS everywhere, certificate pinning on the mobile apps, HSTS |
| 7 | Notification leaking PHI on a locked screen | PHI-free payloads, enforced by allowlist. See [09](09-notifications.md) § 1 |
| 8 | Screenshot or screen recording of a care brief | `FLAG_SECURE` on Android, screen-capture detection on iOS, deterrence only |
| 9 | Public URL to a private object | Private buckets, no ACL, short-lived signed URLs, all access audited |
| 10 | Card or bank details in logs or error tracking | Redaction filter, CI test that fails on PHI keys |
| 11 | Credential stuffing | Rate limits, lockouts, breached-password checks, device fingerprinting |
| 12 | Malicious caregiver accepting then failing a visit | Arrival codes, GPS, no-show tracking, deposit or pay-deduction policy |
| 13 | A caregiver recording the patient's family | Social policy, caregiver agreement, care brief minimisation, incident reporting |
| 14 | Price or schedule manipulation via the API | Server-authoritative pricing, role checks, audit |
| 15 | Ransomware or destructive action | Immutable backups, tested restores, append-only audit, no production data in dev |

Mitigations 1–3 and 6–7 are the ones a real breach would actually involve. Spend your security
budget there, not on theoretical risks.

## 3. Authentication

### Methods

| Method | Applies to | Implementation |
|---|---|---|
| Phone OTP | All roles | 6 digits, 10-minute expiry, 5 attempts, max 5 sends per hour |
| Password | All roles | Argon2id, min 10 chars, breached-password check |
| Refresh token | All roles | Opaque, 30 days, single-use, rotation with reuse detection |
| Biometric | Caregiver app | Local gate only. **Never** replaces server-side authorisation |

### Password storage

Argon2id, `m=64MB, t=3, p=4` (raise memory if your production hardware allows). Salt per user,
16 bytes. Never log, never include in an API response, never send over SMS. Breach check against a
known-password corpus at set and change time.

### OTP security

- Code is `sha256(code + server_pepper)`; the pepper lives in KMS, not in the database
- 6 digits, 10-minute expiry, 5 attempts, then the challenge is dead
- Resend every 45 s, max 5 per hour per number, 20 per IP per hour
- **Do not reveal whether a phone number exists.** Identical response and timing either way
- **Do not put the OTP in the response body.** It goes only by SMS
- Compare in constant time
- Rate-limit by IP, device, and phone number, and enforce a per-subnet cap to stop a distributed
  SMS-cost attack

The last item is a real money risk. Without a per-IP cap, a botnet can spend your SMS balance in an
afternoon. Set a hard daily SMS spend limit with an alert.

### Token lifecycle

- Access token: JWT, RS256, 15 minutes. `sub`, `role`, `sid`, `jti`, `iat`, `exp`. **No PHI in the
  payload** — a JWT is decoded by anyone holding it and often lands in logs
- Refresh token: 30 days, hashed with sha256 at rest, single-use with rotation
- **Reuse detection**: presenting a rotated token revokes the entire family and returns
  `401 TOKEN_REUSE_DETECTED`
- Logout revokes the session; logout-all revokes every session
- Session revocation takes effect on the next request. Suspending a caregiver therefore stops their
  access within one request, not at next login
- Re-authentication required to change a password, email, phone, consent, or bank details
- Session storage in the mobile app: secure storage (Keychain / Android Keystore), never plain
  preferences

### 2FA for admin

Mandatory for `ADMIN`, `FINANCE`, `SUPER_ADMIN`, and `CLINICAL_SUPERVISOR`. TOTP app or SMS. This
is the account that can export every customer's data. Store a recovery code set, print them, and keep
them in your company's secure records.

### Device fingerprinting

Record `device_id`, model, OS version, and app version. Show familiar devices on the account
settings screen and alert on a new one. Do not use a fingerprint to silently deny access — users
change phones.

## 4. Authorisation

See [02-roles-and-permissions](02-roles-and-permissions.md) for the full matrix. Implementation
requirements:

1. Server-side on every request. Client-side checks are user experience, not control.
2. Scope in the query, not after the fetch. `where id = $1 and caregiver_id = $2`, never
   `fetch by id` then `if`.
3. 403 for a role violation, 404 for an out-of-scope resource — so the API never confirms that a
   record exists to someone who should not know.
4. Guards in the service layer, called by every handler touching patient or clinical data. Two
   engineers will add endpoints; the guard must be automatic.
5. Deny by default. A new endpoint with no explicit grant is inaccessible.
6. Database RLS as a second independent layer ([06](06-data-model.md) § 9). Application guards and
   RLS must both fail for a cross-patient read to succeed.
7. **Log every clinical read, not just writes.** The read is the event that gets noticed after a
   breach, and it is the only way to answer "who has seen this patient's chart".

### Caregiver scoping, precisely

A caregiver may read an appointment only when:

```sql
select 1 from ops.appointments
 where id = $1
   and (caregiver_id = $2                              -- assigned now
        or exists (select 1 from clinical.visit_records
                    where appointment_id = ops.appointments.id
                      and caregiver_id = $2))          -- their own authored record
```

Everything else — the patient record, the household, other caregivers, pricing — is invisible. This
must hold at the query level, not by omitting fields from a response, because a field you omit from
JSON is still sitting in the database and one bug away from leaking.

## 5. Encryption

| Layer | Mechanism |
|---|---|
| In transit | TLS 1.2+ everywhere, TLS 1.3 preferred, HSTS on the API and admin |
| Mobile transport | Certificate pinning for the API host. Pin the intermediate as well as the leaf, or a rotation bricks the app |
| Database volume | Provider-managed encryption at rest, KMS-backed |
| Field level (clinical) | AES-256-GCM, per-row random nonce, KMS envelope key, `*_enc_version` for rotation |
| Backups | Encrypted with a separate key from the primary, stored in a separate security domain |
| Object storage | Server-side encryption, private buckets, no public ACL, signed URLs expiring in 300 s |
| Caregiver device cache | Platform keystore-backed encryption. Purge on logout and after 7 days of inactivity |
| Admin session storage | HttpOnly, Secure, SameSite=Strict cookies. **Never** localStorage for a token in a dashboard |

See [06-data-model](06-data-model.md) § 11 for the envelope pattern. Key requirements:

- Encryption happens in the **application layer**, not in SQL. Encrypting in the database requires
  shipping the key to the database, which collapses the boundary you are trying to build.
- Master key in KMS only. Never in source, never in a container image, never in a `.env` committed
  to a repository.
- Rotation: `*_enc_version` per row, background re-encryption job, tested restoration of the old
  key path before retiring it.
- Key rotation must not require downtime, and a half-migrated database must still be readable.

## 6. Communications security

### Messages are not a clinical channel

The chat thread exists for logistics: access codes, timing, "the nurse is on the way". It must not
carry clinical content, for three reasons: chat is retained indefinitely and is hard to delete
correctly; chat is searchable and exportable by anyone who gets database access; and a caregiver's
clinical judgement made in chat has none of the structure of a visit record.

Implementation:

1. A persistent one-line notice in the composer, per [04](04-caregiver-app-spec.md) G15
2. Message bodies encrypted at rest, like other clinical text
3. A keyword heuristic flagging likely clinical content for dispatcher review, without blocking the
   message. It routes to a human rather than censoring a caregiver mid-shift
4. Retention shorter than clinical records (24 months per
   [06](06-data-model.md) § 13)

**Decision point for you, not for engineering:** whether the platform should *refuse* clinical
messages, or flag them. Flagging respects clinical judgement and privacy in a worker's hands. Write
the policy, brief the caregivers, get legal input. Building the flag mechanism either way is
sensible; whether it blocks is a policy choice.

### Call disclosure

The customer's phone number is visible to the caregiver only from 12 hours before a visit until
visit completion. Outside that window the caregiver sees a masked number and an action that routes
through dispatch. This reduces both the privacy exposure and the personal-contact exposure.

## 7. Consent

### Consent types, recorded separately

From `auth.consents`: `TERMS`, `PRIVACY`, `HEALTH_DATA_PROCESSING`, `MARKETING`, `PHOTO_SHARING`,
`CAREGIVER_RESPONSE`.

Requirements:

- `HEALTH_DATA_PROCESSING` is a **separate, specific checkbox** with its own plain-language copy. It
  must never be bundled into "I agree to the terms". Bundling is the pattern regulators object to,
  and it is not defensible.
- Store the **version** of the document shown, the timestamp, the IP, and the device.
- Consent is revocable at any time in Profile → Privacy. Revoking health-data consent stops new
  bookings and new data collection, and does **not** retroactively delete existing clinical records,
  because statutory retention applies. Say that plainly in the revocation confirmation.
- Consent re-prompt when the document version changes materially, not on every minor edit.
- Photo and wound-photo consent is separate and specific. `clinical.attachments.consent_basis`
  records the basis per attachment.

### Age and authority

A customer asserts they are authorised to arrange care for the patient — a required checkbox on the
booking step. If the customer is not the patient, record their relationship to the patient
explicitly, and consider a light verification for the first visit. There is no legally clean
mechanism in-app for this; it is a business-process decision with legal input. See
[16](16-open-questions.md).

## 8. Data subject rights and retention

### Rights

| Right | Implementation |
|---|---|
| Access | Customer can request a copy of their data. Delivered by a human within 30 days. Not a self-service export |
| Correction | Customer edits their own profile, patients, addresses. Clinical records are corrected by amendment, not edit |
| Deletion | Closure request. Anonymise personal identifiers; retain clinical and financial records per statutory obligation |
| Portability | Machine-readable export in JSON or CSV, produced by a human on request |
| Objection | Stop marketing and non-essential processing immediately |
| Consent withdrawal | Per type, as above |

### The honest deletion position

A care provider's retention obligations usually exceed a customer's deletion request. Your platform
will therefore anonymise rather than erase. This must be stated clearly and truthfully in the
closure notice:

> Your personal account details, name, contact information, and location data will be permanently
> removed. Clinical visit records are retained by [Company Name] as required by law, in anonymised
> form, and are no longer linked to you. Financial records are retained as required by tax law.

Saying "we delete everything" when you retain clinical records is a lie that surfaces as a
compliance finding. Saying the above is defensible and reassures the customer.

### Retention

| Data | Retention | Basis |
|---|---|---|
| Patient names, clinical records, vitals | Statutory clinical period — **confirm the actual figure** | Clinical record-keeping law |
| Caregiver licence documents | Employment plus statutory period | Regulatory |
| Financial records | Statutory tax period | Tax law |
| GPS location pings | 90 days | Minimisation; not needed for billing |
| Audit log | Statutory / compliance period | Accountability |
| Sessions | 90 days after expiry | Security |
| OTP challenges | 24 hours | Minimisation |
| Notifications | 12 months | Service |
| Messages | 24 months | Minimisation |
| Analytics | No PHI, ever | — |

A nightly retention job applies these, drops expired partitions, and writes a `RETENTION_JOB`
audit entry with counts and an actor of `SYSTEM`. Retention is an automated control, not a
convention.

## 9. Audit logging

### What is logged

| Event | Detail |
|---|---|
| Authentication | Login, logout, failed login, lockout, OTP verified, token reuse detected, device registered, session revoked |
| Authorisation | Every clinical read, with `patient_id`. Every access denial |
| PHI access | Field-level: who read which patient record, when, from where, and why |
| Care lifecycle | Every status transition, with actor and timestamp |
| Assignment | Offered, accepted, declined with reason, revoked, reassigned |
| Clinical | Visit record created, amended with reason, vitals recorded, amendment diffs |
| Incident | Created, acknowledged, resolved, escalated |
| Financial | Invoice issued, voided, disputed, payment claimed, confirmed, reversed, price changed |
| Administration | Caregiver approved, rejected, suspended; customer suspended; settings changed; export run |
| Data rights | Access request, deletion request, consent granted, withdrawn, revoked |
| Security | Screenshot detected, bulk access anomaly, unusual export volume |

### Properties

1. **Append-only.** `UPDATE` and `DELETE` revoked from the application database role
2. **Hash-chained** per partition: `sha256(prev_hash || canonical_row)`. A nightly job verifies the
   chain and alerts on mismatch. Tampering breaks it, and the break is detectable
3. **Immutable storage** for a nightly copy to a write-once bucket. If the database is
   compromised, the attacker cannot rewrite history
4. **Clock discipline.** NTP on every host. An audit log with wrong timestamps is worse than
   useless, because it destroys your ability to reconstruct a sequence
5. **No PHI in `diff`.** Field names and change direction only. See [06](06-data-model.md) § 10
6. **The log viewer is itself audited.** Reading the log is an action

### Anomaly detection

Alert on patterns that do not appear in normal operation:

- A caregiver reading records outside their assigned patients
- A staff member reading more records than the operational norm for their role in an hour
- Any export of clinical data
- Access attempts against records with no operational justification
- Repeated 403s from one account, suggesting probing
- A read pattern that matches a staff member's normal work exactly at a suspicious hour

The `clinical.access` view over `audit.log`, filtered by `patient_id`, is the tool a Clinical
Supervisor uses when a customer asks who has seen their relative's chart. Build that view
before you need it.

## 10. Device and platform security

### Mobile

| Control | Implementation |
|---|---|
| Local storage | `flutter_secure_storage` for tokens. Clinical caches encrypted with a keystore-backed key |
| App switcher | Blur the screen in the recents snapshot. Never show patient names |
| Screenshots | `FLAG_SECURE` on Android for clinical screens. On iOS, detect capture and respond per your policy |
| Root/jailbreak | Detect and warn. Optionally restrict clinical detail on a compromised device. Do not silently brick a caregiver's only phone |
| Biometric lock | Optional for customers, encouraged for caregivers |
| Idle timeout | Caregiver 30 minutes, customer 12 hours |
| Remote wipe | Suspended caregiver: server sends a purge instruction; the app clears cached patient data |
| Biometric and PIN fallback | Never store the PIN |
| Root detection caveat | Weak on Android. Treat as a signal, not a control |

**Screenshot deterrence is honest about its limits.** `FLAG_SECURE` blocks screenshots and screen
recording on Android. iOS offers no true equivalent — you can detect capture after the fact. State
this limitation in your privacy policy rather than claiming protection you do not have. It is a
deterrent against a curious bystander, not a control against a determined attacker with a camera.

### Web dashboard

- HttpOnly, Secure, SameSite=Strict session cookies
- CSP with no `unsafe-inline`. If a charting library demands it, use nonces
- CSRF tokens on state-changing requests
- `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `Referrer-Policy: no-referrer`
- 8-hour idle and 30-day absolute session limits
- Mandatory 2FA for privileged roles
- No PHI in the URL, including the clinical-record pages. A clinical record URL is a
  browser-history, proxy-log, and Referer-header leak
- Idle warning at 5 minutes, with an explicit continue rather than an implicit session extension

## 11. Secure development lifecycle

### Pipeline gates

| Stage | Gate |
|---|---|
| Dependencies | `npm audit`, `pip-audit`, licence check. High or critical fails the build |
| Static analysis | TypeScript strict, ESLint, Dart analyzer, secrets detection (gitleaks) |
| SAST | Semgrep rules for the OWASP top 10 plus language-specific rules |
| DAST | OWASP ZAP against the running app in a nightly job |
| Container | Image scan, no root user, pinned base image by digest |
| IaC | Terraform plan in CI, CloudFormation guardrails, drift detection |
| Mobile | Flutter analyse, dependency scan, binary size and cold-start budgets |
| API contract | Contract tests fail the build on an unversioned breaking change |
| PHI leak test | Asserts that no PHI key reaches a log line, an analytics event, an error-tracker context, or a notification payload |
| Authz tests | Every endpoint has a positive and a negative permission test. **A negative test is mandatory** — without it, an endpoint with no check passes the suite |
| IDOR tests | Attempt to read another household's and another caregiver's records; expect 404 |

### Environment discipline

- No production data in any non-production environment. Ever. Seed with generated synthetic data,
  including synthetic patients whose records must never resemble a real one
- Separate cloud accounts or projects per environment
- Production access by time-limited, approved, logged elevation. No standing production access
- Secrets in a secrets manager, injected at runtime. No `.env` files in a repository
- Branch protection, required reviews, signed commits
- Separate service accounts per service
- Quarterly access review: who has which role, is it still justified, revoke what is not

### Secure SDLC, in the roadmap

Security is scheduled work, not a final phase. Budget it per phase in
[15-roadmap-and-budget](15-roadmap-and-budget.md). A phase that ships without its security gates
does not ship.

## 12. Third-party and vendor risk

Every processor of your customers' health data is a risk you inherit.

| Vendor | Data | Requirement |
|---|---|---|
| Cloud provider | PHI | Signed data-processing terms, encryption, no training on your data |
| SMS provider | Phone numbers | Do not send PHI in SMS. [09](09-notifications.md) § 1 |
| Push provider | Device tokens | No PHI in payloads |
| Maps provider | Addresses, caregiver location | Addresses are location-sensitive. Verify retention and training policies. Consider a self-hosted or on-device mapping option for clinical addresses |
| Analytics | **None** | No PHI, ever. Self-hosted or privacy-first only, or nothing |
| Error tracking | **None** | Scrubbed contexts only |
| Support tooling | Ticket contents | Staff training, or a BAA-equivalent agreement |
| Payment provider | Names, amounts | Phase 2; verify merchant data retention |

**Maps deserve specific attention.** A commercial maps SDK receives customer addresses and caregiver
locations. That is a stream of identifiable location data about elderly and ill people. Before
launch, verify what the provider retains and for how long, and whether on-device or self-hosted
mapping is viable for the customer-facing address picker. If you cannot resolve it, use a static map
tile or an offline address picker with sub-city and woreda selection only, and skip the map pin.

## 13. Operational security

- Least privilege for staff. Everyone has exactly the role they need
- 2FA enforced for privileged roles
- Monthly access review
- Onboarding and offboarding checklists in [02](02-roles-and-permissions.md) § 7, executed
- Background checks on caregivers where legally required
- Caregiver confidentiality obligations written into the contract, and signed
- Staff training on data protection before access, with a signed record. The first incident in most
  small businesses is a mistake by a well-meaning employee who was never told
- A written breach-response plan with named roles: who decides, who notifies, who talks to
  customers, who talks to regulators, within what deadlines. Confirm the deadlines with a lawyer
- A tested backup restoration. An untested backup is a hope, not a control
- Annual penetration test by an independent party before handling real patient data, and after any
  significant architectural change

## 14. Security verification before launch

Every line must be ticked, with evidence, before you let a real caregiver use this on a real
patient. A tick without evidence is a wish.

- [ ] All endpoints have positive **and negative** permission tests
- [ ] IDOR testing complete: cross-household and cross-caregiver reads return 404
- [ ] Clinical schema access verified through both the application layer and RLS
- [ ] PHI-leak test green against logs, analytics, error tracking, and notification payloads
- [ ] No PHI in any URL, query parameter, or referrer
- [ ] Encryption verified at the field level by inspecting raw table data, not by reading code
- [ ] Key rotation tested end to end, including restoration from backup with the previous key
- [ ] Backup restoration rehearsed and timed
- [ ] Audit log append-only enforced, and the hash chain verified
- [ ] Clinical read logging complete and queryable by `patient_id`
- [ ] Certificate pinning active in both apps
- [ ] Token rotation and reuse detection verified
- [ ] Admin 2FA enforced
- [ ] Rate limits verified, including the SMS spend cap
- [ ] Screenshot handling verified on both platforms
- [ ] Anonymisation verified on account closure
- [ ] Retention job executed and verified against a test dataset
- [ ] Vendor data-processing terms signed
- [ ] Maps provider data handling reviewed and accepted in writing
- [ ] Breach-response plan written and rehearsed once
- [ ] Penetration test passed, findings triaged
- [ ] Privacy policy and terms published, versioned, and consented to
- [ ] Staff and caregiver training completed and recorded
- [ ] Emergency contact numbers verified and current
- [ ] Launched with a flag: `STRICT_CLINICAL_ACCESS` on, so any gap fails closed rather than open

That last one matters. Ship the first release with clinical access failing closed. A caregiver who
cannot see a record for an hour costs you an hour. A record exposed to the wrong person costs you
the business.