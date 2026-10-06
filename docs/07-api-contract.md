# 07 — API Contract

REST over HTTPS, JSON, `/api/v1`. Shared request and response validation in
`packages/contracts` using zod, so the mobile app and admin dashboard validate against the same
definitions the server enforces.

## 0. Conventions

| Concern | Rule |
|---|---|
| Base URL | `https://api.{domain}/api/v1` |
| Auth | `Authorization: Bearer {access_token}` |
| Access token | JWT, RS256, 15 minutes, `sub`, `role`, `sid` |
| Refresh token | Opaque, 30 days, rotated on every use, single-use with reuse detection |
| Content type | `application/json` except multipart uploads and file downloads |
| Date/time | ISO 8601, UTC on the wire. `2026-10-05T09:00:00Z` |
| Date only | `2026-10-05` |
| Duration | Integer minutes |
| Money | Integer santim in a field named `*_santim`. Money as a string is acceptable for very large values only |
| Pagination | Cursor-based: `?limit=50&cursor={opaque}`. Response carries `next_cursor` |
| Sorting | `?sort=-created_at` |
| Filtering | Explicit query parameters per field. No free-form filter language in v1 |
| Idempotency | `Idempotency-Key` header on `POST` create and on offline sync |
| Optimistic concurrency | `If-Match: {etag}` on visit record amendments |
| Request id | `X-Request-Id` returned on every response; echoes an inbound value |
| Rate limiting | Per user and per IP. See the table below |
| Versioning | Path-based. Additive changes only within v1. Breaking changes need `/v2` |
| Locale | `Accept-Language: en` or `am`. Falls back to `en` |
| Timezone | Always Africa/Addis_Ababa for display; never send an offset the client must interpret |

**No clinical value ever appears in a URL, query string, or `Referer` header.** See
[06-data-model](06-data-model.md) § 10. Clinical fields are request-body only.

### Rate limits

| Endpoint group | Limit |
|---|---|
| `POST /auth/otp/request` | 5 per phone per hour, 20 per IP per hour |
| `POST /auth/login` | 10 per account per 15 min |
| Registration | 5 per IP per day |
| Other customer endpoints | 120 per minute per user |
| Caregiver assignment and offer endpoints | 60 per minute per user |
| Caregiver location pings | 1 per 30 s per active visit; burst of 3 |
| Upload | 10 MB per file, 20 files per hour |
| Admin read | 600 per minute |
| Admin export | 5 per hour, asynchronous |

### Error format

```json
{
  "error": {
    "code": "APPOINTMENT_ALREADY_ASSIGNED",
    "message": "This visit has already been assigned to another caregiver.",
    "message_am": "ይህን ጉዞ በአለመቀነጣበት ወዲያው ለሌላ የአገልግሎት ሰጪ ተመድቧል።",
    "fields": {
      "caregiver_id": "This caregiver is not available in that time window."
    },
    "request_id": "01HQ8Z..."
  }
}
```

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Field-level failures |
| `UNAUTHENTICATED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Authenticated, insufficient permission |
| `NOT_FOUND` | 404 | Does not exist, or out of scope for this actor |
| `CONFLICT` | 409 | State conflict; includes current state in `meta` |
| `INVALID_STATE_TRANSITION` | 409 | Status machine violation, with allowed transitions |
| `RATE_LIMITED` | 429 | Includes `Retry-After` |
| `LICENSE_EXPIRED` | 403 | Caregiver licence expired |
| `PHI_ACCESS_DENIED` | 403 | Access control denied a clinical read |
| `PAYLOAD_TOO_LARGE` | 413 | Upload too large |
| `INTERNAL_ERROR` | 500 | Never leaks a stack trace; `request_id` is the handle for support |

Errors are always returned in the requested locale, with `en` as the fallback field.

### Envelope

Collections:

```json
{
  "data": [ ... ],
  "page": { "next_cursor": "eyJpZCI6...", "has_more": true, "limit": 50 }
}
```

Single resources return the object directly, with no wrapper.

## 1. Authentication

### `POST /auth/otp/request`
```json
{ "phone_e164": "+251911234567", "purpose": "LOGIN" }
```
→ `200`
```json
{ "challenge_id": "uuid", "expires_at": "2026-10-05T09:10:00Z", "resend_after_seconds": 45 }
```
Never reveals whether the phone is registered.

### `POST /auth/otp/verify`
```json
{ "challenge_id": "uuid", "code": "123456" }
```
→ `200`
```json
{
  "access_token": "eyJ...",
  "refresh_token": "opaque",
  "expires_in": 900,
  "user": { "id": "uuid", "role": "CUSTOMER", "status": "ACTIVE", "full_name": "Abebe Bekele" },
  "is_new_user": true
}
```
If the phone is unregistered and `purpose` was `LOGIN`, return `200` with a registration token
scoped to `REGISTER` only, not a full session. Avoids the enumeration problem in
[03-customer-app-spec](03-customer-app-spec.md) § C3.

### `POST /auth/register/customer`
Consumes a `REGISTER` token.

```json
{
  "register_token": "opaque",
  "full_name": "Abebe Bekele",
  "email": "abebe@example.com",
  "password": "a-real-long-passphrase",
  "preferred_language": "am",
  "address": {
    "label": "Home",
    "sub_city_id": "uuid",
    "woreda": "03",
    "kebele": "11",
    "house_number": "Bldg 4, Apt 202",
    "landmark": "Across from St. Joseph Cathedral",
    "latitude": 9.0192,
    "longitude": 38.7525,
    "access_notes": "Blue gate, please remove shoes"
  },
  "emergency_contact": { "full_name": "Sara Bekele", "phone_e164": "+251911112233", "relationship": "Daughter" },
  "consents": [
    { "type": "TERMS", "version": "1.0", "granted": true },
    { "type": "PRIVACY", "version": "1.0", "granted": true },
    { "type": "HEALTH_DATA_PROCESSING", "version": "1.0", "granted": true }
  ]
}
```
→ `201` with a session and the user object.
Missing or ungranted required consent → `422`.

### `POST /auth/register/caregiver`
Same token flow, plus the professional fields from [04](04-caregiver-app-spec.md) G1 Step 2.
Returns `approval_status: "PENDING_REVIEW"`. A session is issued, but every caregiver endpoint
except the status, profile, and document endpoints returns `403 ACCOUNT_PENDING` until approved.

### `POST /auth/login`
```json
{ "phone_e164": "+251911234567", "password": "..." }
```
→ `200` session. On unknown phone or wrong password, identical `401 UNAUTHENTICATED`.

### `POST /auth/refresh`
```json
{ "refresh_token": "opaque" }
```
→ `200` new pair. Presenting a rotated token revokes the entire family and returns
`401 TOKEN_REUSE_DETECTED`.

### `POST /auth/logout`
Revokes the current session.

### `POST /auth/logout-all`
Revokes every session for the user. Used by Admin on caregiver suspension.

### `GET /auth/me`
Current user, permissions, effective settings.

### `PATCH /auth/me`
`full_name`, `email`, `preferred_language`. Phone change requires OTP re-verification.

### `POST /auth/password/change`
```json
{ "current_password": "...", "new_password": "..." }
```

### `POST /auth/password/forgot`
Triggers the reset OTP flow.

### `POST /auth/devices`
```json
{ "platform": "android", "fcm_token": "...", "device_model": "...", "app_version": "1.0.0" }
```

### `GET /auth/sessions`
`DELETE /auth/sessions/{id}` revokes one. Shown in the caregiver app and admin Security page.

## 2. Reference data (public)

### `GET /services`
```json
{ "data": [ {
  "id": "uuid", "code": "WOUND_CARE",
  "name": { "en": "Wound care", "am": "የቁስል ጥበቃ" },
  "description": { "en": "...", "am": "..." },
  "includes": [ { "en": "...", "am": "..." } ],
  "excludes": [ { "en": "...", "am": "..." } ],
  "requires_licence": true,
  "default_duration_minutes": 120,
  "duration_range": { "min": 60, "max": 240 },
  "price_from_santim": 80000,
  "currency": "ETB"
} ] }
```
Cached client-side. `ETag` supported; returns `304` when unchanged.

### `GET /sub-cities`
`[{ id, code, name: {en, am}, woredas: [{ id, name: {en, am} }] }]`

### `GET /pricing/quote`
Public estimator so a price can be shown before an account exists.

Query: `service_code`, `duration_minutes`, `scheduled_start`, `sub_city_id`
→ line items and total, matching the shape of `GET /requests/{id}/quote`.

### `GET /config/public`
```json
{
  "company_name": "[Company Name] Home Care",
  "support_phone": "+251...",
  "urgent_care_phone": "+251...",
  "emergency_phone": "+251...",
  "emergency_disclaimer": { "en": "...", "am": "..." },
  "office_hours": { "en": "8:00 - 18:00, seven days", "am": "..." },
  "same_day_cutoff": "09:00",
  "min_lead_time_minutes": 240,
  "booking_horizon_days": 90
}
```
Cached 1 h. Used for the emergency screen pre-login, and offline.

## 3. Customer: patients and addresses

### `GET /patients`, `POST /patients`, `PATCH /patients/{id}`, `DELETE /patients/{id}`
```json
{
  "id": "uuid",
  "full_name": "Almaz Bekele",
  "date_of_birth": "1948-03-11",
  "age_years": 78,
  "gender": "FEMALE",
  "mobility": "NEEDS_ASSISTANCE",
  "care_needs": "Assistance with bathing, medication reminders",
  "allergies": "Penicillin",
  "special_requirements": "Amharic speaker, prefers female caregiver",
  "physician_name": "Dr. Tesfaye",
  "physician_phone": "+251...",
  "medications": [
    { "id": "uuid", "name": "Amlodipine 5mg", "dose": "5mg",
      "route": "ORAL", "frequency": "Once daily, morning",
      "requires_administration": false, "is_active": true }
  ],
  "is_active": true,
  "created_at": "2026-08-01T10:00:00Z"
}
```

`DELETE` is a soft delete. Existing appointments are unaffected. Response:
`{ "deleted": true, "note": "Clinical records are retained under statutory retention policy." }`

### `GET/POST/PATCH/DELETE /addresses`
As [06-data-model](06-data-model.md) § 2.

### `GET/POST/PATCH/DELETE /emergency-contacts`
Scoped to the household, or `?patient_id={id}` for a patient-specific contact.

## 4. Customer: requests

### `POST /requests`
Headers: `Idempotency-Key` required. Body:

```json
{
  "patient_id": "uuid",
  "primary_service_code": "WOUND_CARE",
  "additional_service_codes": ["VITALS"],
  "care_needs": "Left-leg wound post surgery, dressing change due",
  "special_requirements": "Ring the bell twice; dog in the yard is friendly",
  "address_id": "uuid",
  "address_override": null,
  "preferred_date": "2026-10-20",
  "preferred_time": "09:00",
  "duration_minutes": 120,
  "urgency": "ROUTINE",
  "recurrence": null,
  "emergency_contact": { "full_name": "Sara Bekele", "phone_e164": "+251911112233", "relationship": "Daughter" },
  "authorised_by_requester": true
}
```

Recurring:

```json
"recurrence": {
  "freq": "WEEKLY",
  "interval": 1,
  "days_of_week": [1, 4],
  "count": 8,
  "until": null
}
```

→ `201`
```json
{
  "id": "uuid",
  "reference": "REQ-2026-000123",
  "status": "SUBMITTED",
  "urgency": "ROUTINE",
  "created_at": "2026-10-05T09:00:00Z",
  "estimate": { "subtotal_santim": 160000, "surcharge_santim": 20000,
                "total_santim": 180000, "currency": "ETB", "is_estimate": true,
                "lines": [ { "code": "SERVICE", "label": { "en": "Wound care", "am": "..." },
                            "amount_santim": 160000, "is_estimate": true,
                            "explanation": { "en": "2 hours at ETB 800.00", "am": "..." } } ] },
  "appointments": [ { "id": "uuid", "occurrence_index": 1,
                      "scheduled_start": "2026-10-20T09:00:00Z",
                      "scheduled_end": "2026-10-20T11:00:00Z", "status": "PENDING" } ]
}
```

Recurring creates the whole series immediately. `total_visits_planned` is capped (30) and the cap
is enforced server-side; a `422` if exceeded, with a message explaining it.

### `GET /requests`
Query: `status` (repeatable), `service_code`, `patient_id`, `from`, `to`, `q`, `limit`, `cursor`,
`sort`. Returns request summaries with appointment counts and current caregiver.

### `GET /requests/{id}`
```json
{
  "id": "uuid", "reference": "REQ-2026-000123",
  "status": "CONFIRMED",
  "status_history": [
    { "status": "SUBMITTED", "at": "2026-10-05T09:00:00Z" },
    { "status": "UNDER_REVIEW", "at": "2026-10-05T09:31:00Z", "actor_role": "DISPATCHER" },
    { "status": "ASSIGNED", "at": "2026-10-05T11:02:00Z" },
    { "status": "CONFIRMED", "at": "2026-10-05T11:05:00Z", "actor": "customer" }
  ],
  "patient": { "id": "uuid", "full_name": "Almaz Bekele", "mobility": "NEEDS_ASSISTANCE" },
  "services": [ { "code": "WOUND_CARE", "name": { "en": "Wound care", "am": "..." }, "duration_minutes": 120 } ],
  "appointments": [ { "id": "uuid", "occurrence_index": 1,
    "scheduled_start": "2026-10-20T09:00:00Z", "scheduled_end": "2026-10-20T11:00:00Z",
    "status": "CONFIRMED",
    "caregiver": { "id": "uuid", "name": "Marta T.", "photo_url": "signed-url",
                   "qualification": "Registered Nurse", "years_experience": 7,
                   "languages": ["am","en"], "verified_at": "2026-08-01T09:00:00Z",
                   "is_same_as_last": true },
    "address": { "sub_city": { "en": "Bole", "am": "ቦሌ" }, "woreda": "03", "kebele": "11",
                 "house_number": "Bldg 4, Apt 202",
                 "landmark": { "en": "Across from St. Joseph Cathedral", "am": "..." },
                 "latitude": 9.0192, "longitude": 38.7525,
                 "access_notes": { "en": "Blue gate, remove shoes", "am": "..." } },
    "arrival_code": null
  } ],
  "info_request": null,
  "decline": null,
  "quote": { "...": "see GET /requests/{id}/quote" },
  "invoice": { "id": "uuid", "invoice_number": "INV-2026-000045", "status": "ISSUED",
               "total_santim": 180000, "paid_santim": 0, "balance_santim": 180000 },
  "review": null,
  "can": { "cancel": false, "confirm": false, "reschedule": true, "review": false, "message": true }
}
```

**Clinical fields are redacted in this response.** `care_needs` appears because the customer
entered it. Caregiver `observations` never appear. See
[02-roles-and-permissions](02-roles-and-permissions.md) § 3.1.

`can` lets the client render exactly the right actions without duplicating the state machine.

### `POST /requests/{id}/cancel`
```json
{ "reason": "Patient is feeling better" }
```
Allowed only where [08-workflows](08-workflows.md) permits. Returns `409` with `code:
INVALID_STATE_TRANSITION` and the allowed list when not.

### `POST /requests/{id}/confirm-info`
```json
{ "info_response": "Wound is on the left calf. Doctor Tessema's clinic, phone 0911...",
  "emergency_contact": { "...": "..." } }
```

### `POST /requests/{id}/confirm`
Customer accepts the assigned caregiver.

### `POST /requests/{id}/reschedule-request`
```json
{ "preferred_dates": ["2026-10-21","2026-10-22"], "note": "Hospital appointment on the 20th" }
```
Creates a dispatcher task. It does **not** move the appointment, because the caregiver may already
have plans. Surface it as a request, clearly.

### `GET /requests/{id}/quote`
```json
{
  "request_id": "uuid",
  "currency": "ETB",
  "is_final": false,
  "lines": [ { "code": "SERVICE", "label": { "en": "Wound care (2h)", "am": "..." },
               "amount_santim": 160000, "explanation": { "en": "ETB 800.00 per hour x 2", "am": "..." } },
             { "code": "SURCHARGE", "surcharge_kind": "TRANSPORT",
               "label": { "en": "Transport", "am": "..." }, "amount_santim": 20000,
               "explanation": { "en": "Fixed transport charge for Bole sub-city", "am": "..." } } ],
  "totals": { "subtotal_santim": 160000, "surcharge_santim": 20000, "discount_santim": 0,
              "tax_santim": 0, "total_santim": 180000 },
  "payment_instructions": { "account_name": "...", "bank_name": "...", "account_number": "...",
                            "telebirr": "...", "reference": "REQ-2026-000123" }
}
```

### `GET /appointments/{id}`
A lighter request-scoped view for the visit detail screen. `caregiver` included once assigned.

### `POST /appointments/{id}/confirm-arrival`
```json
{ "arrival_code": "4821" }
```
Validates the code the caregiver displays in G8. Sets
`customer_confirmed_arrival`. Optional; a mismatch is recorded, not blocked.

### `POST /appointments/{id}/cancel`
Per-visit cancellation within a recurring series. Rules per
[08-workflows](08-workflows.md) § 3.

### `GET /appointments/{id}/visit-summary`
Post-visit, customer-visible only. **Deliberately a summary, not the clinical record.**

```json
{
  "appointment_id": "uuid",
  "outcome": "COMPLETED",
  "started_at": "2026-10-20T09:04:00Z", "ended_at": "2026-10-20T11:10:00Z",
  "services_delivered": [
    { "label": { "en": "Wound dressed and cleaned", "am": "..." }, "status": "DONE" },
    { "label": { "en": "Vitals recorded", "am": "..." }, "status": "DONE" },
    { "label": { "en": "Replacement dressing applied", "am": "..." }, "status": "DONE" }
  ],
  "supplies_summary": "Dressing pack x1, saline 500ml x2",
  "follow_up": { "required": true,
                 "recommendation": { "en": "Change dressing again in 2 days. Watch for redness.", "am": "..." },
                 "suggested_next_visit": "2026-10-22" },
  "signature_present": true,
  "vitals": [ { "type": "BLOOD_PRESSURE", "recorded_at": "2026-10-20T09:20:00Z",
                "value": { "systolic": 130, "diastolic": 85 }, "is_out_of_range": false } ],
  "clinical_notes_withheld": true
}
```

`clinical_notes_withheld: true` is a deliberate, visible signal. The customer deserves to know
detailed clinical notes exist and are not shown, rather than silently receiving a gap.

## 5. Customer: billing and reviews

### `GET /invoices`
Query: `status`, `from`, `to`, `unpaid_only`, `limit`, `cursor`.

### `GET /invoices/{id}`
Header, line items, payments applied, balance, audit trail.

### `POST /invoices/{id}/payment-claim`
```json
{ "amount_santim": 180000, "method": "TELEBIRR",
  "customer_reference": "FT24020ABC123", "paid_at": "2026-10-20T14:00:00Z",
  "receipt_object_key": "receipts/uuid/2026-10.jpg", "notes": "Sent from Telebirr" }
```
→ `201`
```json
{ "id": "uuid", "status": "PENDING_CONFIRMATION", "message": "Your payment is being verified.",
  "expected_confirmation_hours": 24 }
```
Status is always `PENDING_CONFIRMATION`, never `CONFIRMED`. Only Finance confirms.

### `POST /invoices/{id}/dispute`
```json
{ "reason": "Billed for 4 hours but caregiver attended 2", "detail": "..." }
```

### `GET /payments`
### `POST /appointments/{id}/reviews`
```json
{ "rating_overall": 5, "rating_professionalism": 5, "rating_punctuality": 4,
  "rating_quality": 5, "comment": "Marta was wonderful with my mother.",
  "share_with_company": true }
```
→ `201`. Valid only on a `COMPLETED` appointment belonging to the customer. One review per
appointment. `PATCH` permitted for 7 days; after that `409`.

### `GET /reviews/me`

## 6. Customer: notifications and threads

### `GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all`
### `GET /threads`
One per request.
### `GET /threads/{id}/messages`
Query: `limit`, `before` cursor. Body decrypted server-side, redacted only if flagged.
### `POST /threads/{id}/messages`
```json
{ "body": "Please bring extra gauze", "client_message_id": "uuid",
  "language": "en" }
```
`client_message_id` gives offline retry idempotency.

## 7. Caregiver

### `GET /caregiver/profile`, `PATCH /caregiver/profile`
### `POST /caregiver/documents` — multipart, resumable
### `GET /caregiver/documents`
### `DELETE /caregiver/documents/{id}` — only while `PENDING`
### `GET /caregiver/services` — services requested, with granted status
### `GET /caregiver/offers`
```json
{ "data": [ {
  "assignment_id": "uuid", "appointment_id": "uuid",
  "status": "OFFERED", "offered_at": "2026-10-05T09:00:00Z", "expires_at": "2026-10-05T13:00:00Z",
  "service": { "code": "WOUND_CARE", "name": { "en": "Wound care", "am": "..." } },
  "patient": { "first_name": "Almaz", "age_band": "75-84", "gender": "FEMALE",
               "primary_care_need": "Post-operative wound dressing" },
  "requires_licence": true, "cleared_for_service": true,
  "scheduled_start": "2026-10-06T09:00:00Z", "scheduled_end": "2026-10-06T11:00:00Z",
  "sub_city": { "en": "Bole", "am": "ቦሌ" },
  "distance_km": 3.2, "travel_minutes_estimate": 18,
  "caregiver_pay_santim": 50000, "currency": "ETB",
  "flags": [ { "code": "ALLERGY_FLAG", "severity": "WARN",
               "text": { "en": "Penicillin allergy", "am": "..." } } ]
} ], "page": { "next_cursor": null, "has_more": false } }
```

The address is deliberately absent. It is released on acceptance.

### `POST /caregiver/offers/{appointment_id}/accept`
→ `200` with the full appointment detail including the address. Transition
`OFFERED → ACCEPTED`, notify the customer, generate the first reminder.

### `POST /caregiver/offers/{appointment_id}/decline`
```json
{ "reason": "TOO_FAR", "note": "Traffic from here is 90 minutes" }
```
Rejecting a clinical assignment for a non-clinical reason is recorded; "not qualified" also
raises a flag for the Clinical Supervisor.

### `GET /caregiver/schedule`
Query: `from`, `to`, `view=day|week|agenda`. Returns appointments and offers in the window.

### `GET /caregiver/appointments/{id}`
Full care brief. Fields the caregiver must not see are absent, not null:
`emergency_contact` appears only inside the permitted window; `patient.medications` appear only
for the assigned caregiver; unrelated patient data never appears.

### `POST /caregiver/appointments/{id}/en-route`
```json
{ "latitude": 9.0301, "longitude": 38.7400, "accuracy_m": 12, "battery_pct": 78 }
```
Sets `EN_ROUTE`, starts live location sharing, notifies the customer.

### `POST /caregiver/appointments/{id}/arrive`
```json
{ "latitude": 9.0192, "longitude": 38.7525, "accuracy_m": 8, "battery_pct": 74,
  "arrival_code": "4821", "access_checklist": { "pets_secured": true,
  "clear_path": true, "private_room": true, "id_checked": false } }
```
→ `200`
```json
{ "appointment_id": "uuid", "status": "IN_PROGRESS", "arrival_at": "2026-10-06T09:04:00Z",
  "arrival_code_valid": true, "patient_display_name": "Almaz",
  "safety_banner": { "allergies": "Penicillin", "precautions": "Use latex-free gloves" },
  "expected_end": "2026-10-06T11:00:00Z" }
```
Guard: refuse (or accept but flag) if the location is more than 2 km from the resolved address,
configurable. A caregiver genuinely at the wrong address is a real failure mode, and the flag is
cheaper to resolve than the complaint.

### `POST /caregiver/appointments/{id}/location`
```json
{ "latitude": 9.0193, "longitude": 38.7526, "accuracy_m": 6, "battery_pct": 71 }
```
Every 30 s while `IN_PROGRESS`. Rate-limited. Stored to a partitioned table.

### `POST /caregiver/appointments/{id}/complete`
Offline-capable, idempotent.

```json
{
  "client_record_id": "uuid-from-device",
  "outcome": "COMPLETED",
  "started_at": "2026-10-06T09:05:00Z",
  "ended_at": "2026-10-06T11:08:00Z",
  "latitude": 9.0192, "longitude": 38.7525,
  "care_checklist": [
    { "item_key": "wound_cleaned", "status": "DONE" },
    { "item_key": "dressing_changed", "status": "DONE" },
    { "item_key": "pressure_relief", "status": "NOT_APPLICABLE" }
  ],
  "vitals": [
    { "recorded_at": "2026-10-06T09:20:00Z", "bp_systolic": 130, "bp_diastolic": 85,
      "heart_rate": 78, "temperature_c": 36.8, "oxygen_sat_pct": 97, "is_out_of_range": false }
  ],
  "observations": "Wound clean, no signs of infection. Slight redness at edges.",
  "supplies_used": [ { "supply_id": "uuid", "quantity": 2 } ],
  "follow_up_required": true,
  "follow_up_recommendation": "Redress in 2 days",
  "signature": { "object_key": "sig/uuid.json", "signed_by": "Sara Bekele (daughter)" },
  "attachments": [ { "kind": "WOUND_PHOTO", "object_key": "wounds/uuid/1.jpg", "consent_basis": "CUSTOMER_AUTHORISED" } ]
}
```

→ `201`
```json
{ "visit_record_id": "uuid", "status": "COMPLETED",
  "amendable_until": "2026-10-07T11:08:00Z", "synced_at": "2026-10-06T13:14:02Z",
  "invoice_id": null, "invoice_status": "PENDING_REVIEW" }
```

Replaying the same `client_record_id` returns the same record with `200` and
`duplicate: true`. Never create a second record.

### `POST /caregiver/appointments/{id}/draft`
Save a partial visit record mid-visit. Separate endpoint so a partial save never looks complete.

### `GET /caregiver/patients/{id}/history`
Only records where `caregiver_id` matches the caller.

### `GET/POST/PATCH /caregiver/availability`
Weekly template and exceptions.

### `GET /caregiver/earnings`
Query: `period=this_month`, `from`, `to`. Returns totals and per-visit rows. Never exposes
customer billing.

### `POST /caregiver/incidents`
```json
{ "appointment_id": "uuid", "category": "FALL", "severity": "MEDIUM",
  "description": "Patient fell while I was in the kitchen", "actions_taken": "Checked for injury, none. Called family.",
  "witnessed_by": "None", "latitude": 9.0192, "longitude": 38.7525,
  "client_report_id": "uuid", "attachments": [ { "kind": "INCIDENT_PHOTO", "object_key": "..." } ] }
```
`severity: CRITICAL` triggers immediate escalation per
[09-notifications](09-notifications.md), before the HTTP response is returned.

### `GET /caregiver/ratings`

## 8. Admin: operations

### `GET /admin/dashboard/summary`
Query: `range=today|week|month|custom`, `from`, `to`.

```json
{
  "operations": {
    "needs_attention": 7, "unassigned_requests": 3, "unassigned_over_2h": 1,
    "appointments_today": 24, "confirmed": 19, "unassigned": 3, "in_progress": 2,
    "visits_today": { "total": 24, "completed": 6, "in_progress": 2, "not_started": 16 },
    "fill_rate": 0.83, "on_time_rate": 0.88,
    "caregivers_available_now": 7, "caregivers_total_approved": 11,
    "coverage_by_sub_city": [ { "sub_city_id": "uuid", "name": { "en": "Bole" },
                                "demand": 5, "capacity_hours": 22 } ],
    "documentation_compliance": 1.0,
    "records_missing_after_6h": 0
  },
  "finance": {
    "revenue_santim": 4820000, "outstanding_santim": 1230000,
    "invoices_issued": 31, "payments_received_santim": 3590000,
    "refunds_santim": 0, "caregiver_payables_santim": 2140000,
    "revenue_per_visit_hour_santim": 62000
  },
  "quality": {
    "avg_rating": 4.6, "reviews_pending_moderation": 2,
    "open_incidents": 1, "critical_incidents": 0, "follow_up_open": 5,
    "no_shows_this_period": 1
  },
  "activity": [
    { "at": "2026-10-05T09:12:00Z", "actor_role": "DISPATCHER",
      "event": "REQUEST_ASSIGNED", "request_reference": "REQ-2026-000123",
      "subject": "REQ-2026-000123", "clinical_subject": false }
  ]
}
```

`clinical_subject: false` is the customer's name only. True means a patient name, and only
Clinical Supervisor and Super Admin receive those rows.

### `GET /admin/requests`
Query: `status` (repeatable), `assignment_state=unassigned|pending_offer|assigned`,
`urgency` (repeatable), `service_code`, `sub_city_id`, `from`, `to`, `q`,
`overdue_minutes`, `sort` (default `-urgency_priority,created_at`),
`limit`, `cursor`.

`urgency_priority` is a computed column: urgent requests and unassigned older than 2 h sort
first. Persist it or compute it in a partial index — do not sort in application memory.

### `GET /admin/requests/{id}`
Everything from the customer view, plus: internal notes, review history, assignment history with
decline reasons, all appointments, invoices, and the audit trail.

### `POST /admin/requests/{id}/review`
`{ "action": "START_REVIEW" }` → `UNDER_REVIEW`.

### `POST /admin/requests/{id}/request-info`
```json
{ "info_request": "Please confirm the doctor's name and the exact wound location.",
  "care_needs": null }
```
The customer's answer arrives via `POST /requests/{id}/confirm-info` and re-enters the queue.

### `POST /admin/requests/{id}/approve`
Creates `appointments` for the series if they do not exist, and moves to `APPROVED`.

### `POST /admin/requests/{id}/unassign`
`{ "reason": "Caregiver unavailable" }`

### `POST /admin/requests/{id}/unable-to-fulfill`
```json
{ "reason": "No licensed physiotherapist available in this sub-city this week",
  "internal_note": "...", "alternatives": [ { "type": "OTHER_SERVICE", "service_code": "NURSING",
    "label": { "en": "Nursing care instead", "am": "..." } },
    { "type": "OTHER_DATE", "preferred_dates": ["2026-10-20","2026-10-21"] },
    { "type": "CONTACT_OFFICE", "label": { "en": "Speak to our team", "am": "..." } } ] }
```
Sets the request's own `status` to `UNABLE_TO_FULFILL` **and** cancels all its appointments.
Set them together in one transaction; a request stuck `APPROVED` with cancelled appointments is a
state the customer will see and be confused by.

### `GET /admin/assignments/available`
The eligibility engine.

Query: `appointment_id`, `exclude_caregiver_ids` (repeatable), `sort=distance|rating|load|soonest`
→ each eligible caregiver with the reasons it is eligible, plus excluded caregivers with the
specific exclusion reason.

```json
{ "eligible": [ { "caregiver_id": "uuid", "name": "Marta T.",
    "cleared_service": true, "qualification_match": true,
    "available_in_window": true, "sub_city_match": true, "distance_km": 3.2,
    "travel_minutes": 18, "current_load_today": 2, "rating_avg": 4.8,
    "completion_rate": 0.98, "on_time_rate": 0.94, "is_preferred_by_customer": true,
    "recent_decline_count": 0 } ],
  "excluded": [ { "caregiver_id": "uuid", "name": "Hana K.",
    "reasons": [ { "code": "NOT_AVAILABLE", "detail": "No availability on 2026-10-20" },
                 { "code": "OUT_OF_RADIUS", "detail": "18 km from the address, radius is 10 km" } ] } ] }
```

Returning exclusions with reasons is not a nicety. It is how a dispatcher learns that the
eligibility rules are wrong, and it prevents the same caregiver being offered something they will
decline.

### `POST /admin/appointments/{id}/assign`
```json
{ "mode": "OFFER", "caregiver_ids": ["uuid1","uuid2"], "expires_in_minutes": 240,
  "expires_in_minutes_same_day": 90, "note": "Wound care experience preferred",
  "travel_minutes_estimate": 18 }
```
`mode` is `OFFER` (notify, awaiting accept) or `DIRECT` (assign without asking).

`mode: OFFER` with several ids offers to all of them in parallel and assigns to the first
accepting. Losing the race must be handled atomically — use a conditional update
`where status = 'OFFERED'` and check the row count, otherwise two caregivers can both accept the
same 14:00 visit.

Also `mode: AUTO_ASSIGN`, which takes the top eligible caregiver by the chosen sort and assigns
directly. Include it only if a dispatcher will actually use it; an unused auto-assign feature is a
liability.

### `POST /admin/appointments/{id}/reassign`
`{ "mode": "OFFER", "caregiver_ids": [...], "reason": "Caregiver reported illness", "notify_customer": true }`

### `POST /admin/appointments/{id}/reschedule`
`{ "scheduled_start": "...", "scheduled_end": "...", "reason": "Hospital appointment",
  "notify": true, "release_caregiver": false }`

### `POST /admin/appointments/{id}/cancel`
`{ "reason": "...", "notify_customer": true, "cancellation_fee_santim": 0 }`

### `POST /admin/appointments/{id}/no-show`
`{ "side": "CAREGIVER|CUSTOMER", "note": "..." }`. Affects the caregiver's no-show metric, so
Dispatchers should not be able to set it for customers without a reason recorded. Restrict to
Admin, or require `reason` when `side` is `CUSTOMER`.

### `GET /admin/schedule`
Query: `from`, `to`, `view=day|week`, `sub_city_id`, `caregiver_id`, `status` (repeatable).

### `GET /admin/active-visits`
Active visits with last known location, staleness, and elapsed time.

### `GET /admin/coverage`
Demand and capacity by sub-city and time band.

### `GET /admin/declines`
Aggregated decline reasons by caregiver, service, and time period.

## 9. Admin: people

### `GET /admin/customers`
### `GET /admin/customers/{id}`
Tabs as in [05](05-admin-dashboard-spec.md) § A6. Clinical fields present only for
`CLINICAL_SUPERVISOR` and `SUPER_ADMIN`; amounts only for `FINANCE` and `SUPER_ADMIN`.
```json
{ "id": "uuid", "name": "Abebe Bekele", "phone_e164": "+251911234567",
  "sub_city": { "en": "Bole" }, "joined_at": "...", "status": "ACTIVE",
  "patients": [ ... ], "appointments_summary": { "total": 12, "completed": 10 },
  "billing": { "lifetime_value_santim": 2450000, "outstanding_santim": 0 },
  "clinical": { "included": false, "reason": "Requires CLINICAL_SUPERVISOR" },
  "consents": [ { "type": "HEALTH_DATA_PROCESSING", "version": "1.0",
                  "granted_at": "...", "current": true } ],
  "actions": { "can_suspend": true, "can_see_clinical": false, "can_see_billing": false } }
```
`actions` and `clinical.included` are present for every role. A client must not have to guess
whether a field is missing because of permission or because it does not exist.

### `POST /admin/customers/{id}/suspend`
`{ "reason": "...", "revoke_sessions": false, "notify": true }`
Refuses while visits are `EN_ROUTE` or `IN_PROGRESS` unless `force: true`, which requires an
Admin.

### `GET /admin/caregivers`, `GET /admin/caregivers/{id}`
### `POST /admin/caregivers/{id}/approve`
```json
{ "clear_services": ["uuid1","uuid2"], "note": "Licence verified against the authority",
  "notify": true }
```
Server-side refusals, each with a distinct error code:
- `LICENCE_EXPIRED` — licence_expires_on < today
- `LICENCE_NOT_VERIFIED` — no verifier recorded
- `DOCUMENTS_MISSING` — required document types absent or rejected
- `PROFILE_INCOMPLETE`
- `ALREADY_APPROVED`

Approving runs in one transaction with `ops.caregiver_services` inserts, session checks, and the
`USERS` status update.

### `POST /admin/caregivers/{id}/reject`, `/request-changes`, `/suspend`, `/reinstate`
### `POST /admin/caregivers/{id}/sessions/revoke`
### `GET/PUT /admin/caregivers/{id}/availability`
### `GET /admin/caregivers/{id}/performance`
### `POST /admin/caregivers` — invite
```json
{ "full_name": "...", "phone_e164": "+251...", "professional_title": "Registered Nurse",
  "clear_services": [], "send_invitation": true }
```
Creates a user with no password and an `INVITED` status; registration continues on the caregiver
flow.

## 10. Admin: catalogue, finance, quality, system

### `GET/POST/PATCH /admin/services`
```json
{ "code": "WOUND_CARE", "name": { "en": "Wound care", "am": "የቁስል ጥበቃ" },
  "description": { "en": "...", "am": "..." },
  "includes": [ { "en": "...", "am": "..." } ],
  "excludes": [ { "en": "...", "am": "..." } ],
  "requires_licence": true, "required_qualification": "REGISTERED_NURSE",
  "default_duration_minutes": 120, "duration_range": { "min": 60, "max": 240 },
  "billing_unit": "PER_HOUR",
  "care_checklist": [ { "key": "wound_cleaned", "label": { "en": "...", "am": "..." },
                        "requires_note": false } ],
  "supplies_template": [ { "supply_id": "uuid", "default_quantity": 1 } ],
  "is_active": true, "sort_order": 4 }
```
`code` is immutable after creation. Deactivating keeps existing appointments valid.

### `GET/POST /admin/services/{id}/prices`
Price changes insert a row with a new `effective_from` and set `effective_to` on the previous one.
`POST /admin/pricing/simulate` takes service, duration, start and sub-city, returns the computed
quote.

### `GET/POST/PATCH /admin/surcharges`
### `GET/POST/PATCH /admin/supplies`
### `GET/POST/PATCH /admin/sub-cities`, `/admin/woredas`
### `GET/POST/PATCH /admin/invoices`
### `POST /admin/invoices/{id}/issue`, `/void`, `/dispute`
### `POST /admin/payments`
```json
{ "invoice_id": "uuid", "amount_santim": 180000, "method": "BANK_TRANSFER",
  "customer_reference": "FT24020ABC123", "paid_at": "2026-10-20T14:00:00Z", "notes": "..." }
```
Finance only. Every write audited, including `invoice_id` present or absent (for a prepayment).

### `GET /admin/payment-claims`
Query: `status`, `older_than_days`, `limit`, `cursor`.

### `POST /admin/payment-claims/{id}/confirm` | `/reject`
`{ "note": "...", "payment_id": "uuid" }` on confirm. Reject requires a `reason`.

### `GET /admin/reports/{kind}`
`kind` one of `revenue`, `visits`, `fill_rate`, `on_time`, `caregiver_performance`,
`retention`, `documentation`, `payables`, `declines`, `capacity`. Query: `from`, `to`, plus
kind-specific parameters, `format=json|csv|pdf`. `csv` and `pdf` return `202` with a job id;
poll `GET /admin/reports/jobs/{job_id}`.

### `GET /admin/visits`, `GET /admin/visits/{id}`
### `POST /admin/visits/{id}/amend`
```json
{ "reason": "Temperature recorded in Fahrenheit, corrected to Celsius",
  "changes": [ { "field": "observations", "value": "..." },
               { "field": "vitals.temperature_c", "value": 37.2 } ] }
```
Requires `If-Match`. Refused after `locked_at` unless `SUPER_ADMIN` or `CLINICAL_SUPERVISOR`.
The `reason` is mandatory and both rows are kept.

### `GET /admin/incidents`, `/admin/incidents/{id}`
### `POST /admin/incidents/{id}/acknowledge`, `/resolve`, `/close`
### `GET /admin/follow-ups`
### `GET /admin/reviews`, `POST /admin/reviews/{id}/hide`, `/publish`, `/respond`
`{ "reason": "..." }` required to hide. Reviews are never deleted.

### `GET /admin/audit-logs`
Query: `actor_user_id`, `action` (repeatable), `entity_type`, `entity_id`, `patient_id`,
`from`, `to`, `limit`, `cursor`.
```json
{ "data": [ { "id": 12345, "occurred_at": "...", "actor": { "id": "uuid", "name": "..." },
    "actor_role": "DISPATCHER", "action": "READ", "entity_type": "clinical.visit_record",
    "entity_id": "uuid", "patient_id": "uuid", "ip": "10.0.1.5",
    "is_clinical_access": true, "diff": null, "request_id": "..." } ] }
```
`is_clinical_access` is the field that matters most in that table. It is what makes the log
useful for its real purpose: answering who has seen a given patient's chart.

### `GET/POST /admin/notifications/templates`
### `POST /admin/notifications/test` — renders a template against sample data for preview
### `POST /admin/broadcasts`
```json
{ "audience": { "role": "CUSTOMER", "sub_city_ids": ["uuid"], "service_codes": ["WOUND_CARE"],
                "has_active_request": false },
  "channels": ["PUSH","SMS"], "title": { "en": "...", "am": "..." },
  "body": { "en": "...", "am": "..." },
  "send_at": null, "requires_consent_check": true }
```
`consents.MARKETING` must be checked for marketing broadcasts. `body` is validated against the
PHI-key allowlist.

### `GET /admin/settings`, `PATCH /admin/settings`
Keyed settings groups: `general`, `booking`, `pricing`, `notifications`, `data_retention`,
`integrations`, `feature_flags`. Returns the current version. `PATCH` with `If-Match` on the
version.

### `GET /admin/staff`, `POST /admin/staff`, `PATCH /admin/staff/{id}/role`
### `DELETE /admin/staff/{id}` — soft, never removes the last `SUPER_ADMIN`

## 11. WebSocket

`wss://api.{domain}/ws?token={access_token}`. Reconnect with backoff. Every event is also
delivered by `GET` polling, so the socket is an optimisation and never a dependency.

```json
{ "type": "appointment.updated", "payload": { "appointment_id": "uuid", "status": "EN_ROUTE",
    "changed_at": "2026-10-06T09:01:00Z" } }
{ "type": "offer.created", "payload": { "assignment_id": "uuid", "expires_at": "..." } }
{ "type": "request.status", "payload": { "request_id": "uuid", "status": "ASSIGNED" } }
{ "type": "visit.location", "payload": { "appointment_id": "uuid", "latitude": 9.0193,
    "longitude": 38.7526, "recorded_at": "...", "age_seconds": 24 } }
{ "type": "admin.queue", "payload": { "unassigned_count": 4, "needs_attention": 8 } }
```

Channel authorisation mirrors the REST permissions. `admin.queue` goes only to dispatcher and
admin roles. Location events are filtered per subscription, and a caregiver can never subscribe to
another caregiver's channel. The server must not trust a channel name in the query string.

## 12. File upload

`POST /uploads` with `multipart/form-data`, then attach the returned key to the relevant resource.

```json
{ "purpose": "WOUND_PHOTO", "object_key": "clinical/visit/{id}/wound-1.jpg",
  "mime_type": "image/jpeg", "size_bytes": 482113, "sha256": "..." }
```

Constraints: JPEG, PNG, PDF only. 10 MB maximum. Images are re-encoded server-side, stripped of
EXIF including GPS, and stored under an opaque key in a private bucket with server-side encryption
and no public ACL. Never serve a public URL — return a short-lived signed URL from
`GET /files/{attachment_id}?expires=300`, whose access is audited.

EXIF stripping is not optional. A wound photo from a customer's phone carries the patient's home
GPS coordinates and a device identifier, which is a location disclosure the caregiver never agreed
to and you never intended.

## 13. Versioning and compatibility

Additive within v1: new optional fields, new endpoints, new enum values. Clients must ignore
unknown fields.

Breaking, requiring `/v2`: removing or renaming a field, changing a type, changing a status value
semantics, tightening validation on a field a client already sends.

Deprecation: mark deprecated in the OpenAPI description, log usage per client version, and notify
before removal. Version-gate FCM tokens by app version so an old build does not receive a payload it
cannot parse.

Publish an OpenAPI 3.1 document, generate the mobile and dashboard SDKs from it in CI, and fail the
build if a shared contract changes without a version bump. Contract drift is the most common cause
of a mobile release that crashes against a live API.