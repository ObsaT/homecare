# 02 — Roles & Permissions

## 1. Why this document exists

Most platform security failures are not bugs; they are ambiguous access rules that two
developers interpreted differently. This document is the authority. Implement from it and do not
let endpoint-level decisions drift from it.

## 2. The roles

Seven roles. Every user has exactly one role in v1.

| Role | Code | Who they are | Sign-up |
|---|---|---|---|
| Customer | `CUSTOMER` | The person paying for care | Self-register with phone OTP |
| Caregiver | `CAREGIVER` | Nurse or care worker | Self-register, then held pending approval |
| Dispatcher | `DISPATCHER` | Assigns caregivers, manages the request queue | Invite-only by Super Admin |
| Admin | `ADMIN` | Manages services, prices, caregivers, customers | Invite-only by Super Admin |
| Finance | `FINANCE` | Invoices, payments, revenue reports | Invite-only by Super Admin |
| Clinical Supervisor | `CLINICAL_SUPERVISOR` | Reviews care quality and clinical records | Invite-only by Super Admin |
| Super Admin | `SUPER_ADMIN` | Owns the platform. Full access | Seeded; cannot be deleted |

**Clinical Supervisor is not optional.** In a business that performs clinical care, someone
with clinical authority must own visit quality. If that is you in v1, use this role. The role
gates access to clinical records and review workflows; do not fold it into `ADMIN`.

## 3. Permission matrix

`CRUD` means full create/read/update/delete, including soft delete. `O` means own records only.

### 3.1 Customer (`CUSTOMER`)

| Resource | Read | Create | Update | Delete | Scope |
|---|---|---|---|---|---|
| Own profile | Yes | At registration | Yes | Account-closure only | Own |
| Addresses | Yes | Yes | Yes | Yes | Own |
| Emergency contacts | Yes | Yes | Yes | Yes | Own |
| Patients | Yes | Yes | Yes | Yes, with soft-delete | Own household |
| Services | Yes | No | No | No | All active |
| Prices | Yes (effective price) | No | No | No | Public |
| Requests | Yes | Yes | Yes, before assignment only | Yes, before assignment only | Own |
| Appointments | Yes | No | Yes, request reschedule | Yes, before assignment | Own |
| Caregiver public profile | Yes | No | No | No | Assigned + completed only |
| Caregiver full record | **No** | No | No | No | — |
| Messages | Yes | Yes | Own messages only | Own messages only | Own threads |
| Visit record (summary) | Yes | No | No | No | Own request, clinical fields redacted |
| Vitals recorded | Yes | No | No | No | Own request |
| Care notes (free text) | **No** | No | No | No | Clinical Supervisor only — see §3.7 |
| Invoices | Yes | No | No | No | Own |
| Payments | Yes | No | No | No | Own |
| Reviews | Yes | Yes, after completed visit | Yes, until 7 days after | Yes, until 7 days after | Own |
| Notifications | Yes | No | Read-state only | Yes | Own |

**The "care notes" row is the important one.** The customer can see the *summary* of what was
done — that the visit happened, which services were delivered, what the caregiver recommended
— but not the caregiver's clinical free-text notes. Reasons: the notes may contain clinical
judgement the caregiver did not intend as a customer communication, and it keeps the record
safe from the customer editing their own file. If the customer needs detail, they ask, and you
have a process. See [11-security](11-security.md) § 6.

### 3.2 Caregiver (`CAREGIVER`)

| Resource | Read | Create | Update | Delete | Scope |
|---|---|---|---|---|---|
| Own profile | Yes | Onboarding | Yes | No | Own |
| Qualification / licence | Yes | Upload | Yes | No | Own |
| Own documents | Yes | Upload | Yes | No | Own |
| Approval status | Yes | No | No | No | Own |
| Availability | Yes | Yes | Yes | Yes | Own |
| Services they are cleared for | Yes | No | No | No | Assigned by Admin |
| Offers (pending assignments) | Yes | No | Accept/decline | No | Offered to them |
| Assigned appointments | Yes | No | Limited — see §3.5 | No | Assigned only |
| Assigned patients | Yes, care-brief fields only | No | No | No | Currently assigned |
| Patient clinical records | Yes, current episode | Yes (visit record) | Own visit record | No | Assigned episode only |
| Other patients' records | **No** | No | No | No | — |
| Messages | Yes | Yes | Own messages only | Own messages only | Assigned threads |
| Visits completed | Yes | Yes | Yes, 24 h window | No | Own |
| Earnings | Yes | No | No | No | Own |
| Dashboard / reports | No | No | No | No | — |
| Customer contact details | Yes, phone + address, only while assigned | No | No | No | Assigned only |

**No patient browsing.** A caregiver cannot search the patient database. A caregiver sees
patients they are currently assigned to, and loses visibility when the assignment ends — except
for completed visit history they authored. This is a core access rule, not a UI preference:
enforce it in the data access layer, not by hiding screens.

### 3.3 Dispatcher (`DISPATCHER`)

| Resource | Permissions |
|---|---|
| Request queue | Full CRUD on requests; review, request-info, decline-with-reason |
| Assignment | List eligible caregivers, assign, reassign, cancel assignment |
| Appointments | Full CRUD; reschedule; mark no-show |
| Customers | Read all; read patients; **no** clinical free-text notes |
| Caregivers | Read profiles, qualifications, availability, contact; **cannot** approve, cannot edit qualifications |
| Services / prices | Read only |
| Active visits | Read all, including live locations |
| Messages | Read all threads; reply as the business; cannot edit a customer's message |
| Clinical notes | **No** |
| Payments / invoices | Read totals only; no write |
| Reports | Operations only: request volume, fill rate, coverage |
| Audit log | No access |

### 3.4 Admin (`ADMIN`)

Everything Dispatcher can do, plus:

| Resource | Permissions |
|---|---|
| Caregivers | Approve / reject / suspend; verify qualifications; set cleared services; edit availability |
| Customers | Suspend / reactivate |
| Services | Full CRUD, including activation toggles |
| Prices | Full CRUD, with effective dating |
| Care packages | Full CRUD |
| Sub-cities / woredas | Read; manage via Super Admin |
| Reports | Revenue, visits, caregiver performance |
| Clinical notes | **No** — Admin does not get clinical access by default |
| Payments | No write by default; can record a payment with an explicit reason, logged |
| Audit log | Read only |

### 3.5 Caregiver write permissions on appointments

Caregivers cannot edit the schedule. Specific rights:

- Accept or decline an offer
- Mark arrival (start visit)
- Mark completion
- Record their own visit notes and supplies used
- Request a reschedule (creates a **request to the dispatcher**, not a self-serve change)
- Add a patient to `allowed_phone_numbers` for the next 2 hours, so the family can reach them

They cannot: change the date, change the address, change the price, cancel the booking, or
see another caregiver's appointments.

### 3.6 Finance (`FINANCE`)

| Resource | Permissions |
|---|---|
| Invoices | Full CRUD, issue, void, record payment, reverse payment |
| Payments | Full CRUD, confirm, reverse (with reason, always audited) |
| Quotes / pricing | Read only |
| Customers | Read billing profile, invoices, payments; **no** clinical data |
| Caregivers | Read pay rate and earnings totals; **no** clinical notes |
| Reports | Full financial: revenue, outstanding, refunds, caregiver payables |
| Services | Read only |
| Everything else | No access |

Finance must not be able to read care notes, and Dispatchers must not be able to see revenue
detail beyond collected totals. Least privilege is only real if it holds against your own staff.

### 3.7 Clinical Supervisor (`CLINICAL_SUPERVISOR`)

| Resource | Permissions |
|---|---|
| Visit clinical records | **Full read**, across all visits |
| Visit records | Correct a record via amendment, never by silent edit — see §5 |
| Care plans | Create and revise |
| Caregiver clinical feedback | Read; flag a caregiver for retraining |
| Vitals | Read all; flag out-of-range readings for callback |
| Follow-up flags | Read; close the loop |
| Customers / patients | Read; read all clinical records |
| Requests | Read; may approve clinically-sensitive requests |
| Clinical audit | Read all clinical access logs |
| Payments / pricing | No access |
| Services | Read; may flag a service as clinically restricted |

### 3.8 Super Admin (`SUPER_ADMIN`)

Full access to everything, including clinical records, audit logs, and role assignment.

Two protections even for Super Admin:
1. Clinical record reads are **logged** individually, same as everyone else. Super Admin
   visibility is auditable.
2. Super Admin cannot delete another Super Admin, cannot delete their own account, and cannot
   disable the audit log. There must always be one active Super Admin.

## 4. Permission implementation requirements

Non-negotiable implementation rules:

1. **Server-side only.** Every API endpoint checks role and scope before touching data. No
   permission may live only in the UI. Hiding a button is a courtesy to the user, not a control.
2. **Scope checks are part of the query.** Fetching `/appointments/:id` runs a query filtered by
   `caregiver_id = session.caregiver_id` for caregivers. It must be impossible to fetch an
   appointment you are not assigned to and receive a 200.
3. **403, not 404, for role violations; 404 for out-of-scope records.** For a caregiver probing
   another caregiver's appointment, return 404 so the API does not confirm the record exists.
   For a logged-in customer calling an admin endpoint, return 403.
4. **Object-level checks in the service layer, not the controller.** Two engineers will add
   endpoints; the check must be automatic. Implement an `assertCanReadVisit(actor, visit)` style
   guard called by every handler that touches clinical or patient data.
5. **Separate read paths for clinical and business data.** Clinical queries live in a dedicated
   module with its own database role that lacks write access to business tables. See
   [06-data-model](06-data-model.md) § 9.
6. **Audit every clinical read.** Not just writes. Someone reading a patient chart is the event
   that gets noticed after a breach. Log `actor`, `resource`, `action`, `ip`, `device`, `at`.
7. **Deny by default.** A new endpoint with no permission entry is inaccessible. New permissions
   must be explicitly granted in the permission table and reviewed.

## 5. Record amendment policy

Clinical records are append-only. A completed visit record is never edited or deleted.

- A **correction** is a new `visit_note_amendment` row referencing the original, with a
  mandatory reason. Both rows remain visible. The original is marked `superseded`, not removed.
- The caregiver who authored the record has a 24-hour window to fix a typo or wrong selection.
  After 24 hours, only a Clinical Supervisor can amend.
- Deletion requests from a customer are handled as a soft delete plus a scheduled hard delete at
  the end of the statutory retention window, per [11-security](11-security.md) § 8.
- Every amendment is in the audit log with before/after diffs.

## 6. Role summary matrix

Quick reference for navigation menus.

| Capability | Cust | CG | Disp | Admin | Fin | CS | SA |
|---|---|---|---|---|---|---|---|
| Book care | ● | | | | | | |
| Manage own household | ● | | | | | | |
| Accept/decline assignment | | ● | | | | | |
| Start/complete visit | | ● | | | | | |
| See patient clinical notes | | ○ | | | | ● | ● |
| See own patient care brief | | ● | | | | | |
| Manage request queue | | | ● | ● | | ● | ● |
| Assign caregivers | | | ● | ● | | ● | ● |
| Approve caregivers | | | | ● | | | ● |
| Manage services & prices | | | | ● | ○ | | ● |
| Record payments | | | | ○ | ● | | ● |
| Revenue reports | | | ○ | ● | ● | | ● |
| Caregiver payables | | | | ● | ● | | ● |
| Manage staff accounts | | | | | | | ● |
| Read audit log | | | | ● | ● | ● | ● |

● full  ○ read-only  blank = no access

## 7. Onboarding and de-provisioning checklist

Operations, not engineering, but it must be specified because the app depends on it.

**Before a caregiver sees any assignment:**
- [ ] Government ID uploaded and verified by Admin
- [ ] Professional licence uploaded, number recorded, expiry recorded
- [ ] Licence verified against the issuing authority (manual check, recorded in the app)
- [ ] Cleared services assigned explicitly
- [ ] Weekly availability set
- [ ] Status changed to `APPROVED`
- [ ] Contract signed, copies stored
- [ ] Police clearance / medical fitness, per legal requirement — see [16](16-open-questions.md)

**When a caregiver leaves or is suspended:**
- [ ] Status set to `SUSPENDED` — immediately revokes app access and live-location sharing
- [ ] All future assignments reassigned before the account is frozen
- [ ] Earned but unpaid visits settled
- [ ] Access to historical patient records revoked, except their own authored visit records
- [ ] Device tokens invalidated; active sessions revoked (see [11](11-security.md) § 4)
- [ ] App login blocks with a clear reason, not a generic error

**When a customer requests account closure:**
- [ ] In-progress visits handled or cancelled
- [ ] Outstanding balance settled
- [ ] Clinical records retained per the statutory retention period; account anonymised
- [ ] Marketing and push consent revoked
- [ ] Device tokens invalidated