# 06 — Data Model

PostgreSQL 16. Logical schemas for isolation: `auth`, `core`, `catalog`, `ops`, `clinical`,
`fin`, `audit`, `notif`. This separation is not decoration — it enforces the access rules in
[11-security](11-security.md) at the database level, so a compromised API module cannot read the
clinical schema.

## 0. Conventions

| Rule | Detail |
|---|---|
| Primary keys | `uuid` v4, generated with `gen_random_uuid()` |
| Timestamps | `timestamptz`, stored UTC. Render Africa/Addis_Ababa |
| Dates (birthday, working date) | `date`, no timezone |
| Money | `bigint` in **santim** (ETB cents). Never float, never numeric for arithmetic in app code |
| Enums | PostgreSQL `enum` types, namespaced, changed only by create-migration-and-add |
| Soft delete | `deleted_at timestamptz` where retention applies. Never hard-delete clinical or financial rows |
| Encryption marker | `bytea` for ciphertext, `*_enc_version smallint`, `*_enc_nonce bytea`. See § 11 |
| Names | `snake_case` tables and columns, `PascalCase` constraints |
| PII in JSON | Avoid. Explicit columns, so permissions and encryption can be applied per field |
| Audit columns | `created_at`, `updated_at`, `created_by`, `updated_by` on every mutable table |
| Row-level security | Enabled on `clinical` and `fin` schemas. See § 9 |
| Migrations | Forward-only, numbered, applied in a transaction, never edited after release |
| No PHI in logs | See § 10 |

### Ethiopic text
Ethiopic script requires UTF8 end-to-end and a font that renders it. Store UTF8 (Postgres default).
Search on `pg_trgm` works. Do not use Ethiopic numerals in identifiers or sort keys — normalise to
Latin for sorting and search, keep the original in the text column.

---

## 1. `auth` schema

### `users`
One identity record per human. Role determines the shape of the rest of their profile.

```sql
create schema auth;

create type auth.user_role as enum (
  'CUSTOMER','CAREGIVER','DISPATCHER','ADMIN','FINANCE',
  'CLINICAL_SUPERVISOR','SUPER_ADMIN'
);
create type auth.account_status as enum
  ('PENDING_VERIFICATION','ACTIVE','SUSPENDED','DEACTIVATED','CLOSED');

create table auth.users (
  id                 uuid primary key default gen_random_uuid(),
  role               auth.user_role not null,
  status             auth.account_status not null default 'PENDING_VERIFICATION',
  phone              text not null unique,
  phone_e164         text not null unique,
  phone_verified_at  timestamptz,
  email              text,
  email_verified_at  timestamptz,
  password_hash      text,                 -- argon2id. null = OTP-only account
  full_name          text not null,
  full_name_enc      bytea,                -- encrypted copy; see § 11
  photo_object_key   text,                 -- private object storage key, never a public URL
  preferred_language text not null default 'en' check (preferred_language in ('en','am')),
  is_available       boolean,              -- caregivers: live availability toggle
  failed_login_count int not null default 0,
  locked_until       timestamptz,
  last_login_at      timestamptz,
  last_login_ip      inet,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  constraint users_email_format check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
create index users_role_status_idx on auth.users (role, status) where deleted_at is null;
create index users_phone_idx on auth.users (phone_e164);
create index users_name_trgm on auth.users using gin (full_name gin_trgm_ops);
```

`users` holds no clinical data. That separation is what lets Customer-facing code query it freely.

### `auth.sessions`
Refresh-token rotation with reuse detection.

```sql
create table auth.sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  refresh_hash   text not null unique,     -- sha256 of the token; never store the token
  family_id      uuid not null,            -- rotation family; reuse of an old token kills the family
  device_id      text,
  device_name    text,
  platform       text,
  user_agent     text,
  ip             inet,
  issued_at      timestamptz not null default now(),
  expires_at     timestamptz not null,
  rotated_at     timestamptz,
  revoked_at     timestamptz,
  revoked_reason text
);
create index sessions_user_idx on auth.sessions (user_id, revoked_at);
create index sessions_family_idx on auth.sessions (family_id);
```

### `auth.otp_challenges`
```sql
create type auth.otp_purpose as enum ('REGISTER','LOGIN','VERIFY_PHONE','RESET_PASSWORD','ARRIVAL_CODE');

create table auth.otp_challenges (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  phone_e164  text not null,
  purpose     auth.otp_purpose not null,
  code_hash   text not null,                -- sha256 + server pepper
  attempts    int not null default 0,
  max_attempts int not null default 5,
  issued_at   timestamptz not null default now(),
  expires_at  timestamptz not null,          -- 10 minutes
  consumed_at timestamptz,
  ip          inet
);
create index otp_lookup on auth.otp_challenges (phone_e164, purpose, consumed_at);
```

Never store an OTP in plaintext. Purge rows older than 24 h in a scheduled job.

### `auth.device_tokens`
```sql
create table auth.device_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  platform    text not null check (platform in ('android','ios','web')),
  fcm_token   text unique,
  apns_token  text,
  app_version text,
  os_version  text,
  device_model text,
  last_seen_at timestamptz not null default now(),
  revoked_at  timestamptz
);
```

### `auth.consents`
Separate health-data consent from general terms. See [11-security](11-security.md) § 7.

```sql
create type auth.consent_type as enum
  ('TERMS','PRIVACY','HEALTH_DATA_PROCESSING','MARKETING','PHOTO_SHARING','CAREGIVER_RESPONSE');

create table auth.consents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  consent_type auth.consent_type not null,
  version      text not null,               -- document version shown at grant time
  granted      boolean not null,
  granted_at   timestamptz,
  revoked_at   timestamptz,
  ip           inet,
  device_id    text,
  unique (user_id, consent_type, version)
);
```

---

## 2. `core` schema

### `core.addresses`
```sql
create schema core;

create type core.geo_precision as enum ('PIN','CENTROID','NONE');

create table core.addresses (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  label         text not null,
  sub_city_id   uuid not null,              -- FK to catalog.sub_cities
  woreda        text not null,
  kebele        text not null,
  house_number  text not null,
  landmark      text not null,
  phone         text,
  latitude      numeric(9,6),
  longitude     numeric(9,6),
  geo_precision core.geo_precision not null default 'NONE',
  access_notes_enc bytea,                   -- gate codes, dogs, lift notes
  access_notes_enc_nonce bytea,
  is_default    boolean not null default false,
  is_deleted    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index addresses_owner_idx on core.addresses (owner_user_id) where not is_deleted;
```

### `core.patients`
```sql
create schema if not exists clinical;   -- patients carry health data

create type clinical.gender as enum ('MALE','FEMALE','OTHER','UNSPECIFIED');
create type clinical.mobility as enum
  ('INDEPENDENT','NEEDS_ASSISTANCE','WALKING_AID','WHEELCHAIR','BEDBOUND','OTHER');

create table clinical.patients (
  id                uuid primary key default gen_random_uuid(),
  household_user_id uuid not null references auth.users(id),
  full_name_enc     bytea not null,          -- encrypted
  full_name_enc_nonce bytea not null,
  name_search       text not null,           -- latin-normalised, trigram-indexed, for search only
  date_of_birth     date,
  age_years         int,                     -- set when DOB unknown
  gender            clinical.gender default 'UNSPECIFIED',
  mobility          clinical.mobility,
  care_needs_enc    bytea,
  care_needs_enc_nonce bytea,
  allergies_enc     bytea,
  allergies_enc_nonce bytea,
  special_requirements_enc bytea,
  special_requirements_enc_nonce bytea,
  physician_name    text,
  physician_phone   text,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index patients_household_idx on clinical.patients (household_user_id) where deleted_at is null;
create index patients_name_trgm on clinical.patients using gin (name_search gin_trgm_ops);
```

`name_search` is a **non-reversible normal form** used only for staff search. It is a separate,
lower-fidelity field precisely so that the searchable index does not leak the encrypted name, and
access to it is audited.

### `clinical.patient_medications`
```sql
create type clinical.medication_route as enum
  ('ORAL','TOPICAL','INHALED','SUBCUTANEOUS','INTRAMUSCULAR','RECTAL','EYE','EAR','OTHER');

create table clinical.patient_medications (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references clinical.patients(id),
  name_enc         bytea not null,
  name_enc_nonce   bytea not null,
  dose_enc         bytea,
  dose_enc_nonce   bytea,
  route            clinical.medication_route,
  frequency        text,
  requires_administration boolean not null default false,
  prescriber_name  text,
  started_on       date,
  ended_on         date,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
```

### `core.emergency_contacts`
```sql
create table core.emergency_contacts (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid references clinical.patients(id) on delete cascade,
  customer_user_id uuid references auth.users(id) on delete cascade,
  full_name   text not null,
  phone       text not null,
  relationship text,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint ec_one_owner check (
    (patient_id is not null)::int + (customer_user_id is not null)::int = 1
  )
);
```

---

## 3. `catalog` schema

### `catalog.sub_cities` / `catalog.woredas`
Reference tables, not enums. Addis restructures sub-cities; do not hardcode.

```sql
create schema catalog;

create table catalog.sub_cities (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name_en    text not null,
  name_am    text not null,
  is_active  boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table catalog.woredas (
  id          uuid primary key default gen_random_uuid(),
  sub_city_id uuid not null references catalog.sub_cities(id),
  code        text,
  name_en     text not null,
  name_am     text not null,
  is_active   boolean not null default true,
  unique (sub_city_id, name_en)
);
```

### `catalog.services`
```sql
create type catalog.service_code as enum
  ('NURSING','ELDERLY','POST_HOSPITAL','WOUND_CARE','MEDICATION',
   'PERSONAL_CARE','FEEDING','VITALS','PHYSIOTHERAPY','OTHER');

create type catalog.billing_unit as enum ('PER_VISIT','PER_HOUR','PER_DAY','PER_SESSION');

create table catalog.services (
  id                uuid primary key default gen_random_uuid(),
  code              catalog.service_code not null unique,
  name_en           text not null,
  name_am           text not null,
  description_en    text not null,
  description_am    text not null,
  includes_en       text[],                  -- checklist shown to customers
  excludes_en       text[],                  -- equally important, legally protective
  requires_licence  boolean not null default false,
  required_qualification text,               -- which caregiver title may deliver it
  default_duration_minutes int not null default 60,
  min_duration_minutes   int not null default 60,
  max_duration_minutes   int not null default 480,
  billing_unit      catalog.billing_unit not null default 'PER_VISIT',
  care_checklist    jsonb not null default '[]'::jsonb,  -- drives caregiver G9/G10
  supplies_template jsonb not null default '[]'::jsonb,
  is_active         boolean not null default true,
  requires_review   boolean not null default false,     -- OTHER always reviewed by a human
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
```

### `catalog.service_prices`
Effective-dated. Price changes insert a new row so historic invoices keep their price.

```sql
create table catalog.service_prices (
  id             uuid primary key default gen_random_uuid(),
  service_id     uuid not null references catalog.services(id),
  billing_unit   catalog.billing_unit not null,
  amount_santim  bigint not null check (amount_santim >= 0),
  min_units      int,                       -- e.g. minimum 2 hours when PER_HOUR
  band_minutes   int,                       -- duration band boundaries
  band_max_minutes int,
  effective_from timestamptz not null,
  effective_to   timestamptz,               -- null = current
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now()
);
create unique index price_current_uniq
  on catalog.service_prices (service_id, band_minutes)
  where effective_to is null;
```

### `catalog.surcharges`
```sql
create type catalog.surcharge_kind as enum
  ('NIGHT','WEEKEND','HOLIDAY','URGENT','TRANSPORT','ADDITIONAL_HOUR','CANCELLATION');

create table catalog.surcharges (
  id                uuid primary key default gen_random_uuid(),
  kind              catalog.surcharge_kind not null,
  sub_city_id       uuid references catalog.sub_cities(id),  -- TRANSPORT only
  amount_santim     bigint not null,
  percent_bp        int,                    -- basis points; alternative to a flat amount
  label_en          text not null,
  label_am          text not null,
  explanation_en    text not null,          -- shown to the customer on the quote
  explanation_am    text not null,
  applies_from_hour int,
  applies_to_hour   int,
  applies_to_days   int[],                  -- 0=Sunday per Postgres convention
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
```

### `catalog.supplies`
Needed so caregiver-supply logging becomes inventory and costing, not a text field.

```sql
create table catalog.supplies (
  id           uuid primary key default gen_random_uuid(),
  sku          text not null unique,
  name_en      text not null,
  name_am      text not null,
  unit_en      text not null,
  unit_cost_santim bigint not null default 0,
  stock_quantity int,
  low_stock_threshold int,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
```

---

## 4. `ops` schema

### `ops.requests`
A customer's intent. Recurring bookings create one request and many appointments.

```sql
create schema ops;

create type ops.request_status as enum
  ('DRAFT','SUBMITTED','UNDER_REVIEW','NEEDS_INFO','APPROVED','ASSIGNED','CONFIRMED',
   'EN_ROUTE','IN_PROGRESS','COMPLETED','UNABLE_TO_FULFILL','CANCELLED','CLOSED');

create type ops.urgency as enum ('ROUTINE','URGENT_24H','URGENT_TODAY');

create type ops.recurrence_freq as enum
  ('NONE','DAILY','WEEKLY','BIWEEKLY','MONTHLY');

create table ops.requests (
  id                  uuid primary key default gen_random_uuid(),
  reference           text not null unique,   -- human-readable e.g. REQ-2026-000123
  customer_user_id    uuid not null references auth.users(id),
  patient_id          uuid not null references clinical.patients(id),
  primary_service_id  uuid not null references catalog.services(id),
  additional_services uuid[] not null default '{}',
  status              ops.request_status not null default 'DRAFT',
  urgency             ops.urgency not null default 'ROUTINE',
  care_needs_enc      bytea,
  special_requirements_enc bytea,
  address_id          uuid references core.addresses(id),
  address_snapshot    jsonb not null,         -- frozen copy; see note below
  emergency_contact_snapshot jsonb,
  preferred_date      date,
  preferred_time      time,
  duration_minutes    int not null check (duration_minutes between 30 and 1440),
  recurrence_freq     ops.recurrence_freq not null default 'NONE',
  recurrence_interval int not null default 1,
  recurrence_days     int[],                  -- 0=Sunday
  recurrence_count    int,                    -- total visits for a counted series
  recurrence_until    date,
  total_visits_planned int,
  review_note         text,
  info_request_enc    bytea,                  -- what we asked the customer
  info_response_enc   bytea,
  decline_reason_enc  bytea,
  decline_recovery    jsonb,                  -- alternatives offered on UNABLE_TO_FULFILL
  reviewed_by         uuid references auth.users(id),
  reviewed_at         timestamptz,
  admin_notes_enc     bytea,
  source              text not null default 'APP' check (source in ('APP','PHONE','WALK_IN','ADMIN')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  submitted_at        timestamptz,
  cancelled_at        timestamptz,
  cancel_reason       text,
  cancelled_by_role   auth.user_role,
  constraint recurrence_sane check (
    (recurrence_freq = 'NONE') or (recurrence_count is not null or recurrence_until is not null)
  )
);
create index requests_queue_idx on ops.requests (status, created_at) where status in
  ('SUBMITTED','UNDER_REVIEW','NEEDS_INFO','APPROVED');
create index requests_customer_idx on ops.requests (customer_user_id, created_at desc);
create index requests_patient_idx on ops.requests (patient_id, created_at desc);
```

**Why `address_snapshot`:** the address at booking time is the clinical and legal record. If the
customer moves, the visit must still show where the caregiver was sent. The same applies to the
emergency contact. Snapshots are written once and never updated; `address_id` remains for the
customer's convenience.

### `ops.appointments`
One concrete visit. Recurring generates N rows.

```sql
create type ops.appointment_status as enum
  ('PENDING','OFFERED','ACCEPTED','EN_ROUTE','IN_PROGRESS','COMPLETED',
   'CANCELLED','DECLINED','NO_SHOW','UNABLE_TO_FULFILL','EXPIRED');

create table ops.appointments (
  id                  uuid primary key default gen_random_uuid(),
  request_id          uuid not null references ops.requests(id),
  occurrence_index    int not null,           -- 1..N within a recurring series
  caregiver_id        uuid references auth.users(id),
  service_id          uuid not null references catalog.services(id),
  status              ops.appointment_status not null default 'PENDING',
  scheduled_start     timestamptz not null,
  scheduled_end       timestamptz not null,
  duration_minutes    int not null,
  timezone            text not null default 'Africa/Addis_Ababa',
  address_id          uuid references core.addresses(id),
  address_snapshot    jsonb not null,
  access_notes_enc    bytea,
  latitude            numeric(9,6),          -- resolved from snapshot for maps
  longitude           numeric(9,6),
  price_santim        bigint not null default 0,
  price_breakdown     jsonb not null default '{}'::jsonb,
  caregiver_pay_santim bigint,
  arrival_at          timestamptz,
  arrival_lat         numeric(9,6),
  arrival_lng         numeric(9,6),
  arrival_code        text,                   -- optional 4-digit check-in
  departure_at        timestamptz,
  departure_lat       numeric(9,6),
  departure_lng       numeric(9,6),
  customer_confirmed_arrival boolean,
  reschedule_requested_at timestamptz,
  cancel_reason       text,
  cancelled_by_role   auth.user_role,
  client_record_id    text,                   -- idempotency for offline visit completion
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (request_id, occurrence_index)
);
create index appointments_schedule_idx on ops.appointments (scheduled_start, status);
create index appointments_caregiver_idx on ops.appointments (caregiver_id, scheduled_start desc);
create index appointments_unassigned_idx on ops.appointments (scheduled_start)
  where caregiver_id is null and status in ('PENDING','OFFERED');
create index appointments_client_record on ops.appointments (client_record_id) where client_record_id is not null;
```

The partial index on unassigned appointments is what keeps the dispatcher's queue fast at volume.

### `ops.assignments`
Offer history with decline reasons. Reassignment needs an audit trail, not an overwrite.

```sql
create type ops.assignment_status as enum
  ('OFFERED','ACCEPTED','DECLINED','EXPIRED','REVOKED','REASSIGNED','AUTO_CANCELLED');
create type ops.decline_reason as enum
  ('TOO_FAR','NOT_AVAILABLE','NOT_QUALIFIED','PERSONAL','PATIENT_CONFLICT','OTHER');

create table ops.assignments (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references ops.appointments(id) on delete cascade,
  caregiver_id   uuid not null references auth.users(id),
  status         ops.assignment_status not null default 'OFFERED',
  offered_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  responded_at   timestamptz,
  decline_reason ops.decline_reason,
  decline_note_enc bytea,
  decline_note_enc_nonce bytea,
  assigned_by    uuid references auth.users(id),
  travel_minutes_estimate int,
  accepted_at    timestamptz,
  revoked_at     timestamptz,
  revoke_reason  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index assignments_appointment_idx on ops.assignments (appointment_id, offered_at desc);
create index assignments_pending_idx on ops.assignments (caregiver_id, expires_at)
  where status = 'OFFERED';
```

### `ops.availability`
```sql
create table ops.availability_templates (
  id             uuid primary key default gen_random_uuid(),
  caregiver_id   uuid not null references auth.users(id) on delete cascade,
  weekday        int not null check (weekday between 0 and 6),
  start_time     time not null,
  end_time       time not null,
  effective_from date not null default current_date,
  effective_to   date,
  created_at     timestamptz not null default now(),
  constraint window_ordered check (start_time < end_time)
);

create table ops.availability_exceptions (
  id           uuid primary key default gen_random_uuid(),
  caregiver_id uuid not null references auth.users(id) on delete cascade,
  exception_date date not null,
  kind         text not null check (kind in ('UNAVAILABLE','CUSTOM','TIME_OFF')),
  start_time   time,
  end_time     time,
  reason       text,
  status       text not null default 'REQUESTED' check (status in ('REQUESTED','APPROVED','DECLINED')),
  decided_by   uuid references auth.users(id),
  decided_at   timestamptz,
  created_at   timestamptz not null default now(),
  unique (caregiver_id, exception_date, start_time)
);

create table ops.caregiver_settings (
  caregiver_id      uuid primary key references auth.users(id) on delete cascade,
  notification_radius_km int not null default 10,
  max_visits_per_day int not null default 3,
  pay_model         text not null default 'PER_HOUR' check (pay_model in ('PER_VISIT','PER_HOUR','PER_SHIFT')),
  hourly_rate_santim bigint,
  shift_rate_santim bigint,
  updated_at        timestamptz not null default now()
);
```

### `ops.caregiver_profiles`
```sql
create table ops.caregiver_profiles (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  approval_status     text not null default 'DRAFT'
    check (approval_status in ('DRAFT','PENDING_REVIEW','CHANGES_REQUESTED','APPROVED','REJECTED','SUSPENDED')),
  professional_title  text not null,
  qualification_level text,
  field_of_study      text,
  institution         text,
  licence_number_enc  bytea,
  licence_number_enc_nonce bytea,
  licence_authority   text,
  licence_issued_on   date,
  licence_expires_on  date not null,
  licence_verified_at timestamptz,
  licence_verified_by uuid references auth.users(id),
  years_experience    int,
  languages           text[] not null default '{}',
  specialisations     text[] not null default '{}',
  home_sub_city_id    uuid references catalog.sub_cities(id),
  home_woreda         text,
  bank_account_enc    bytea,
  bank_account_enc_nonce bytea,
  rating_avg          numeric(3,2),
  rating_count        int not null default 0,
  total_visits        int not null default 0,
  completed_visits    int not null default 0,
  cancelled_visits    int not null default 0,
  rejection_reason    text,
  submitted_at        timestamptz,
  approved_at         timestamptz,
  approved_by         uuid references auth.users(id),
  suspended_at        timestamptz,
  suspension_reason   text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint licence_not_expired_check check (licence_expires_on >= current_date - 30)
);
```

The `licence_not_expired_check` is a backstop against accidental approval with an expired
licence. The real enforcement is in application code, because a database constraint evaluated at
write time will happily accept a row that expires tomorrow.

### `ops.caregiver_services`
Explicit clearance. Never self-asserted by the caregiver — see [04](04-caregiver-app-spec.md) G1.

```sql
create table ops.caregiver_services (
  caregiver_id uuid not null references auth.users(id) on delete cascade,
  service_id   uuid not null references catalog.services(id),
  cleared_by   uuid references auth.users(id),
  cleared_at   timestamptz not null default now(),
  primary key (caregiver_id, service_id)
);
```

### `ops.caregiver_documents`
```sql
create type ops.document_kind as enum
  ('GOVERNMENT_ID','PROFESSIONAL_LICENCE','HEALTH_CERTIFICATE','POLICE_CLEARANCE',
   'TRAINING_CERTIFICATE','VACCINATION_RECORD','OTHER');
create type ops.document_status as enum ('PENDING','VERIFIED','REJECTED','EXPIRED');

create table ops.caregiver_documents (
  id           uuid primary key default gen_random_uuid(),
  caregiver_id uuid not null references auth.users(id) on delete cascade,
  kind         ops.document_kind not null,
  object_key   text not null,               -- private storage; never a public URL
  side         text default 'FRONT' check (side in ('FRONT','BACK')),
  file_sha256  text not null,               -- dedupe and tamper detection
  mime_type    text not null,
  size_bytes   int not null,
  status       ops.document_status not null default 'PENDING',
  reviewed_by  uuid references auth.users(id),
  reviewed_at  timestamptz,
  rejection_reason text,
  expires_on   date,
  created_at   timestamptz not null default now()
);
```

### `ops.patient_caregiver_assignments`
Standing assignment, distinct from a single booking.

```sql
create table ops.patient_caregiver_assignments (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references clinical.patients(id),
  caregiver_id uuid not null references auth.users(id),
  start_date   date not null,
  end_date     date,
  is_primary   boolean not null default false,
  assigned_by  uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  end_reason   text
);
```

### `ops.visit_location_pings`
Written by the caregiver app during an active visit, readable by Dispatcher/Admin and the
customer household only.

```sql
create table ops.visit_location_pings (
  id             bigserial primary key,
  appointment_id uuid not null references ops.appointments(id) on delete cascade,
  recorded_at    timestamptz not null,
  latitude       numeric(9,6) not null,
  longitude      numeric(9,6) not null,
  accuracy_m     numeric(7,2),
  battery_pct    int
) partition by range (recorded_at);
create index on ops.visit_location_pings (appointment_id, recorded_at desc);
```

Range-partitioned by month with automatic retention job dropping partitions older than the policy
window. This is the only high-volume table in the system; everything else is small.

---

## 5. `clinical` schema

The most protected part of the database.

```sql
create schema clinical;
alter schema clinical set search_path = clinical, public;

create type clinical.visit_outcome as enum
  ('COMPLETED','COMPLETED_PARTIAL','CANCELLED_BY_PATIENT','NO_SHOW','DECLINED_CAREGIVER',
   'SAFETY_ABORTED','REFERRED');

create table clinical.care_plans (
  id             uuid primary key default gen_random_uuid(),
  patient_id     uuid not null references clinical.patients(id),
  goal_enc       bytea,                     -- encrypted
  goal_enc_nonce bytea,
  instructions_enc bytea,
  instructions_enc_nonce bytea,
  authored_by    uuid references auth.users(id),
  authorised_by  uuid references auth.users(id),  -- clinical supervisor sign-off
  effective_from timestamptz not null default now(),
  effective_to   timestamptz,
  created_at     timestamptz not null default now()
);
```

### `clinical.visit_records`
One per completed appointment. Append-only after the 24-hour amendment window.

```sql
create table clinical.visit_records (
  id                  uuid primary key default gen_random_uuid(),
  appointment_id      uuid not null unique references ops.appointments(id),
  patient_id          uuid not null references clinical.patients(id),
  caregiver_id        uuid not null references auth.users(id),
  service_id          uuid not null references catalog.services(id),
  outcome             clinical.visit_outcome not null,
  started_at          timestamptz,
  ended_at            timestamptz,
  client_record_id    text unique,           -- offline idempotency
  care_checklist      jsonb not null default '[]'::jsonb,  -- encrypted at app level, see § 11
  observations_enc    bytea,
  observations_enc_nonce bytea,
  supplies_used       jsonb not null default '[]'::jsonb,
  follow_up_required  boolean not null default false,
  follow_up_enc       bytea,
  follow_up_enc_nonce bytea,
  signature_object_key text,
  signature_signed_by  text,
  signature_signed_at timestamptz,
  finalised_at        timestamptz not null default now(),
  locked_at           timestamptz,           -- set at finalised_at + 24h
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index visit_records_patient_idx on clinical.visit_records (patient_id, created_at desc);
create index visit_records_caregiver_idx on clinical.visit_records (caregiver_id, created_at desc);
```

### `clinical.vitals`
Structured numerics, separately encrypted from free text so they can be range-queried without
decrypting, while still being unreadable in a raw dump.

```sql
create table clinical.vitals (
  id             bigserial primary key,
  visit_record_id uuid not null references clinical.visit_records(id) on delete cascade,
  recorded_at    timestamptz not null,
  bp_systolic    smallint check (bp_systolic between 40 and 300),
  bp_diastolic   smallint check (bp_diastolic between 20 and 200),
  heart_rate     smallint check (heart_rate between 20 and 250),
  temperature_c  numeric(4,1) check (temperature_c between 30 and 45),
  respiratory_rate smallint check (respiratory_rate between 4 and 80),
  oxygen_sat_pct smallint check (oxygen_sat_pct between 50 and 100),
  blood_glucose_mg_dl smallint check (blood_glucose_mg_dl between 20 and 800),
  weight_kg      numeric(5,2) check (weight_kg between 0.5 and 400),
  is_out_of_range boolean not null default false,
  flagged_for_follow_up boolean not null default false,
  noted_enc      bytea,
  noted_enc_nonce bytea,
  unique (visit_record_id, recorded_at)
);
```

Range checks on every clinical numeric. A blood pressure of 900/400 means a data-entry error, and
the database is the last place that should accept it.

### `clinical.visit_amendments`
```sql
create table clinical.visit_amendments (
  id              uuid primary key default gen_random_uuid(),
  visit_record_id uuid not null references clinical.visit_records(id),
  amended_by      uuid not null references auth.users(id),
  amendment_reason text not null,            -- mandatory
  diff            jsonb not null,            -- before/after per field
  authorised_by   uuid references auth.users(id),   -- required outside the 24h window
  created_at      timestamptz not null default now()
);
```

### `clinical.incidents`
```sql
create type clinical.incident_severity as enum ('LOW','MEDIUM','HIGH','CRITICAL');
create type clinical.incident_status as enum
  ('OPEN','ACKNOWLEDGED','INVESTIGATING','RESOLVED','CLOSED');
create type clinical.incident_category as enum
  ('PATIENT_DETERIORATION','FALL','MEDICATION_ERROR','INJURY','PROPERTY_DAMAGE',
   'NO_ACCESS','SAFETY_CONCERN','ABUSE_SUSPECTED','VEHICLE_INCIDENT','OTHER');

create table clinical.incidents (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid references ops.appointments(id),
  visit_record_id uuid references clinical.visit_records(id),
  patient_id     uuid references clinical.patients(id),
  caregiver_id   uuid not null references auth.users(id),
  category       clinical.incident_category not null,
  severity       clinical.incident_severity not null,
  status         clinical.incident_status not null default 'OPEN',
  description_enc bytea,
  description_enc_nonce bytea,
  actions_taken_enc bytea,
  actions_taken_enc_nonce bytea,
  witnessed_by   text,
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id),
  resolution_enc bytea,
  resolved_at    timestamptz,
  customer_notified_at timestamptz,
  corrective_action text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index incidents_open_idx on clinical.incidents (severity, created_at desc)
  where status in ('OPEN','ACKNOWLEDGED','INVESTIGATING');
```

### `clinical.attachments`
Encrypted objects in private storage, referenced by key only.

```sql
create type clinical.attachment_kind as enum
  ('WOUND_PHOTO','VISIT_SIGNATURE','DOCUMENT','INCIDENT_PHOTO','RECEIPT');
create type clinical.consent_basis as enum
  ('EXPLICIT_PATIENT','CUSTOMER_AUTHORISED','CLINICAL_NECESSITY','NOT_REQUIRED');

create table clinical.attachments (
  id             uuid primary key default gen_random_uuid(),
  visit_record_id uuid references clinical.visit_records(id) on delete cascade,
  incident_id    uuid references clinical.incidents(id) on delete cascade,
  invoice_id     uuid,
  kind           clinical.attachment_kind not null,
  object_key     text not null,
  mime_type      text not null,
  size_bytes     int not null,
  sha256         text not null,
  encryption_key_id text,
  consent_basis  clinical.consent_basis not null default 'NOT_REQUIRED',
  uploaded_by    uuid references auth.users(id),
  created_at     timestamptz not null default now()
);
```

Wound photos without a recorded consent basis should never be retained. This column is how you
answer that question later.

---

## 6. `fin` schema

```sql
create schema fin;

create type fin.invoice_status as enum
  ('DRAFT','ISSUED','PARTIALLY_PAID','PAID','OVERDUE','VOID','DISPUTED','REFUNDED');
create type fin.payment_method as enum
  ('CASH','BANK_TRANSFER','TELEBIRR','CBE_BIRR','CARD','CHEQUE','OTHER');
create type fin.payment_status as enum
  ('CLAIMED','PENDING_CONFIRMATION','CONFIRMED','FAILED','REVERSED');
create type fin.payment_provider as enum ('MANUAL','TELEBIRR','CBE_BIRR','PAYPAL','STUBELESS');

create table fin.invoices (
  id                uuid primary key default gen_random_uuid(),
  invoice_number    text not null unique,     -- INV-2026-000045
  customer_user_id  uuid not null references auth.users(id),
  request_id        uuid references ops.requests(id),
  status            fin.invoice_status not null default 'DRAFT',
  currency          text not null default 'ETB',
  subtotal_santim   bigint not null,
  surcharge_santim  bigint not null default 0,
  discount_santim   bigint not null default 0,
  tax_santim        bigint not null default 0,
  total_santim      bigint not null,
  paid_santim       bigint not null default 0,
  issued_at         timestamptz,
  due_at            timestamptz,
  paid_at           timestamptz,
  voided_at         timestamptz,
  void_reason       text,
  disputed_at       timestamptz,
  dispute_reason    text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index invoices_customer_idx on fin.invoices (customer_user_id, status);
create index invoices_outstanding_idx on fin.invoices (due_at) where status in ('ISSUED','PARTIALLY_PAID','OVERDUE','DISPUTED');
```

`provider` exists in `fin.payments` even though v1 records every payment manually. Naming the
seam now means the Telebirr integration in Phase 2 writes the same rows with a different
`provider` value and no schema change. See [10-payments](10-payments.md).

```sql
create table fin.invoice_lines (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references fin.invoices(id) on delete cascade,
  line_type    text not null check (line_type in ('SERVICE','SURCHARGE','DISCOUNT','TAX','ADJUSTMENT')),
  service_id   uuid references catalog.services(id),
  surcharge_kind catalog.surcharge_kind,
  description  text not null,
  quantity     numeric(8,2) not null default 1,
  unit_price_santim bigint not null,
  amount_santim bigint not null,
  metadata     jsonb not null default '{}'::jsonb
);

create table fin.payments (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid references fin.invoices(id),
  customer_user_id uuid not null references auth.users(id),
  amount_santim bigint not null check (amount_santim > 0),
  method       fin.payment_method not null,
  provider     fin.payment_provider not null default 'MANUAL',
  provider_reference text,
  customer_reference text,                  -- as stated by the customer in C16
  receipt_object_key text,
  status       fin.payment_status not null default 'PENDING_CONFIRMATION',
  claimed_at   timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id),
  reversed_at  timestamptz,
  reversed_by  uuid references auth.users(id),
  reversal_reason text,
  recorded_by  uuid references auth.users(id),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index payments_invoice_idx on fin.payments (invoice_id, status);
create index payments_unmatched_idx on fin.payments (status) where status = 'PENDING_CONFIRMATION';
```

### `fin.caregiver_payables`
```sql
create table fin.caregiver_payables (
  id             uuid primary key default gen_random_uuid(),
  caregiver_id   uuid not null references auth.users(id),
  appointment_id uuid not null references ops.appointments(id),
  amount_santim  bigint not null,
  period         date not null,             -- first day of the pay month
  payment_run_id uuid,
  status         text not null default 'PENDING'
    check (status in ('PENDING','APPROVED','PAID','CANCELLED','DISPUTED')),
  paid_at        timestamptz,
  paid_by        uuid references auth.users(id),
  notes          text,
  created_at     timestamptz not null default now(),
  unique (appointment_id)
);
create table fin.payment_runs (
  id         uuid primary key default gen_random_uuid(),
  period     date not null unique,
  total_santim bigint not null,
  caregiver_count int not null,
  status     text not null default 'DRAFT' check (status in ('DRAFT','APPROVED','PAID','CANCELLED')),
  approved_by uuid references auth.users(id),
  paid_at    timestamptz,
  created_at timestamptz not null default now()
);
```

---

## 7. `notif` schema

```sql
create schema notif;

create type notif.channel as enum ('PUSH','SMS','EMAIL','IN_APP');
create type notif.event_key as enum
  ('REQUEST_SUBMITTED','REQUEST_REVIEWING','REQUEST_NEEDS_INFO','REQUEST_APPROVED',
   'REQUEST_ASSIGNED','REQUEST_CONFIRMED','REQUEST_UNABLE_TO_FULFILL','REQUEST_CANCELLED',
   'APPOINTMENT_REMINDER_24H','APPOINTMENT_REMINDER_2H','OFFER_RECEIVED','OFFER_EXPIRING',
   'OFFER_ACCEPTED','OFFER_DECLINED','OFFER_EXPIRED','CAREGIVER_EN_ROUTE','CAREGIVER_ARRIVED',
   'VISIT_STARTED','VISIT_COMPLETED','VISIT_SYNC_PENDING','INVOICE_ISSUED','PAYMENT_DUE',
   'PAYMENT_RECEIVED','PAYMENT_CONFIRMED','PAYMENT_CLAIM_RECEIVED','FOLLOW_UP_REQUIRED',
   'REVIEW_REQUESTED','INCIDENT_CRITICAL','CAREGIVER_STATUS_CHANGED','APPOINTMENT_CANCELLED',
   'APPOINTMENT_RESCHEDULED','APPOINTMENT_NOT_STARTED','ASSIGNMENT_REASSIGNED','BROADCAST');

create table notif.templates (
  id          uuid primary key default gen_random_uuid(),
  event_key   notif.event_key not null,
  channel     notif.channel not null,
  locale      text not null check (locale in ('en','am')),
  subject     text,
  body        text not null,                 -- variables as {{name}}
  version     int not null default 1,
  is_active   boolean not null default true,
  reviewed_by uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (event_key, channel, locale, version)
);

create table notif.notifications (
  id           uuid primary key default gen_random_uuid(),
  event_key    notif.event_key not null,
  recipient_id uuid not null references auth.users(id),
  appointment_id uuid references ops.appointments(id),
  request_id   uuid references ops.requests(id),
  channels     notif.channel[] not null default '{IN_APP}',
  payload      jsonb not null default '{}'::jsonb,
  -- PHI-free guard: payload is asserted free of clinical keys at write time (§ 10)
  status       text not null default 'PENDING' check (status in ('PENDING','SENT','DELIVERED','FAILED','SUPPRESSED')),
  attempts     int not null default 0,
  last_error   text,
  read_at      timestamptz,
  created_at   timestamptz not null default now(),
  sent_at      timestamptz,
  delivered_at timestamptz
);
create index notifications_recipient_idx on notif.notifications (recipient_id, created_at desc);
create index notifications_pending_idx on notif.notifications (created_at) where status = 'PENDING';

create table notif.preferences (
  user_id       uuid not null references auth.users(id) on delete cascade,
  event_key     notif.event_key not null,
  push_enabled  boolean not null default true,
  sms_enabled   boolean not null default true,
  email_enabled boolean not null default false,
  quiet_hours_start time,
  quiet_hours_end   time,
  primary key (user_id, event_key)
);

create table notif.messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null,
  sender_id   uuid not null references auth.users(id),
  body_enc    bytea not null,
  body_enc_nonce bytea not null,
  language    text not null default 'en',
  flagged_for_review boolean not null default false,
  flag_reason text,
  reviewed_by uuid references auth.users(id),
  client_message_id text,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (sender_id, client_message_id)
);
create index messages_thread_idx on notif.messages (thread_id, created_at);

create table notif.threads (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid references ops.requests(id),
  appointment_id uuid references ops.appointments(id),
  subject      text,
  created_at   timestamptz not null default now(),
  last_message_at timestamptz
);
```

Messages are encrypted too. Even non-clinical chat can leak health information, because customers
type whatever is in front of them.

---

## 8. `audit` schema

```sql
create schema audit;

create type audit.action as enum
  ('CREATE','READ','UPDATE','DELETE','LOGIN','LOGOUT','LOGIN_FAILED','OTP_VERIFY',
   'EXPORT','PRINT','STATUS_CHANGE','ASSIGN','UNASSIGN','ACCEPT','DECLINE','AMEND',
   'APPROVE','REJECT','SUSPEND','PAYMENT','INVOICE','BROADCAST','DATA_EXPORT','DATA_DELETE');

create table audit.log (
  id             bigserial primary key,
  occurred_at    timestamptz not null default now(),
  actor_user_id  uuid,
  actor_role     auth.user_role,
  action         audit.action not null,
  entity_type    text not null,
  entity_id      uuid,
  patient_id     uuid,                       -- makes PHI access queryable
  request_id     uuid,
  ip             inet,
  user_agent     text,
  device_id      text,
  request_id_hdr text,                       -- HTTP correlation id
  diff           jsonb,                      -- redacted before write, see § 10
  metadata       jsonb not null default '{}'::jsonb
) partition by range (occurred_at);

create index on audit.log (occurred_at desc);
create index on audit.log (actor_user_id, occurred_at desc);
create index on audit.log (entity_type, entity_id, occurred_at desc);
create index on audit.log (patient_id, occurred_at desc) where patient_id is not null;
```

Append-only enforced by revoking `UPDATE` and `DELETE` from the application database role, and by
a nightly hash-chain job: `sha256(prev_hash || row)` stored per partition. A tampered row breaks
the chain. This is what makes the audit log defensible in a dispute.

---

## 9. Access control and database roles

Roles, from least privilege:

| DB role | Grants |
|---|---|
| `app_customer` | `auth.users` (own row only, via RLS), `catalog` (select), `core.addresses` (own), `ops.requests` (own), `ops.appointments` (own) |
| `app_caregiver` | own profile, assigned appointments, own visit records, no `clinical.patients` beyond assigned |
| `app_dispatch` | `ops`, `catalog`, `core` read; `clinical.patients` read; **no** `clinical` free-text columns |
| `app_clinical` | full `clinical`; `ops` read; **no** `fin` |
| `app_finance` | full `fin`; `ops` and `catalog` read; **no** `clinical` |
| `app_admin` | `ops`, `catalog`, `core`, `auth`; **no** `clinical`, **no** `fin` write |
| `app_migrator` | DDL only, never used at runtime |

Row-level security on the tables carrying patient data:

```sql
alter table clinical.patients enable row level security;
alter table clinical.visit_records enable row level security;
alter table ops.appointments enable row level security;
```

The API connects as a role per surface and sets `app.user_id` and `app.user_role` per transaction
via `SET LOCAL`. Policies then filter by those. Two independent layers — application guards from
[02](02-roles-and-permissions.md) § 4 and database RLS — must both fail for a cross-patient read
to succeed. That is the point of defence in depth, and it is what makes this document credible
to a reviewer.

---

## 10. PHI handling rules in the data layer

Enforce in code and in tests, not by convention:

1. **No PHI in application logs.** A global interceptor redacts known-sensitive keys
   (`care_needs`, `observations`, `access_notes`, `full_name`, `medication`, `allergy`,
   `emergency_contact`, `body`, `landmark`) before anything reaches the log transport. Log
   identifiers, not contents.
2. **No PHI in analytics or error tracking.** Sentry-style services get a scrubbed context. Use
   opaque ids. Build a test that fails CI if a PHI key appears in a captured log line.
3. **No PHI in notification payloads.** `notif.notifications.payload` is validated at write time
   against an allowlist of keys. A payload containing a clinical key raises. This is a cheap
   automated check against accidentally putting "wound care for your mother at 14:00" in a push
   notification.
4. **No PHI in audit diffs.** Before writing `audit.log.diff`, redact clinical field values and
   keep only the field name and change direction. "observations changed" is auditable; the
   observation text is not in the audit log.
5. **No PHI in URLs, query parameters, or analytics events.** Clinical fields go in request bodies
   only. This is why nothing in [07-api-contract](07-api-contract.md) takes a clinical query param.
6. **No PHI in CSV exports** unless the requester's role explicitly includes clinical data. Export
   logs a `DATA_EXPORT` audit event with the row count.
7. **No clinical data in the caregiver's contact-sharing window** beyond the care brief needed to
   deliver the service.
8. **Encrypted at rest everywhere**, including database volumes, object storage, backups, and
   device caches.

## 11. Encryption implementation

Field-level encryption for clinical text. AES-256-GCM, per-row random nonce.

| Concern | Decision |
|---|---|
| Algorithm | AES-256-GCM (authenticated, so tampering is detectable) |
| Key storage | Cloud KMS or a secrets manager. **Never** in the database, never in source, never in a container image |
| Key rotation | `*_enc_version` column. Decrypt with the version in the column; re-encrypt to current on write. A background job migrates old rows |
| Nonce | 96-bit random per value, stored alongside the ciphertext |
| Auth tag | Stored in the ciphertext blob. Never truncated |
| What is encrypted | All `*_enc` columns: patient names, care needs, allergies, special requirements, access notes, medications, observations, follow-ups, message bodies, licence numbers, bank details |
| What is not | Structured non-identifying numerics needed for queries, timestamps, statuses, money, and the low-fidelity `name_search` |
| Key ID | Recorded per object where the key store supports versioning |

```sql
-- shape of an encrypted value
create or replace function common.begin_encryption() returns table
  (ciphertext bytea, nonce bytea, key_version smallint) as $$
  select
    pgp_sym_encrypt('', current_setting('app.field_key'), 'cipher-algo=aes256, cipher-mode=gcm')
    -- illustrative only; production uses a KMS envelope key and application-layer crypto
  $$;
```

The function above is a placeholder for the design discussion. The production requirement:
**encryption is performed in the application layer, not in SQL**, using a Node crypto module
against a KMS-provided data key. Database-side encryption of a column requires shipping the key
to the database, which weakens the boundary.

Envelope pattern:

```
KMS master key (never leaves KMS)
  └── per-tenant data key, wrapped, cached in process memory, evicted and re-fetched hourly
        └── AES-256-GCM encrypts *_enc columns
              └── nonce + ciphertext + auth tag stored in the row
```

## 12. Indexes and performance

Beyond the ones above:

```sql
create index requests_status_created on ops.requests (status, created_at desc);
create index appointments_day_status on ops.appointments (scheduled_start, status)
  where status not in ('CANCELLED','DECLINED','NO_SHOW');
create index notifications_recipient_unread on notif.notifications (recipient_id)
  where read_at is null;
create index visit_records_missing_log on ops.appointments (scheduled_start)
  where status = 'COMPLETED'
    and not exists (select 1 from clinical.visit_records vr where vr.appointment_id = appointments.id);
```

Target: the dispatcher queue under 50 ms at 50,000 appointments; the caregiver's today-screen
under 200 ms; the customer's request list under 300 ms. Partition both `audit.log` and
`ops.visit_location_pings` monthly.

## 13. Retention summary

Business data and clinical data have different retention lives. Full policy and legal review in
[11-security](11-security.md) § 8.

| Table | Retention | On expiry |
|---|---|---|
| `clinical.visit_records`, `clinical.vitals` | Statutory clinical period, per legal advice | Archive, then delete |
| `clinical.incidents` | Longer than visit records | Archive |
| `clinical.attachments` (wound photos) | Per consent and clinical policy | Hard delete |
| `ops.visit_location_pings` | 90 days | Drop partition |
| `audit.log` | Per legal and compliance advice, at minimum the platform life | Drop partition |
| `auth.sessions` | 90 days after expiry | Delete |
| `auth.otp_challenges` | 24 hours | Hard delete |
| `fin.invoices`, `fin.payments` | Statutory financial period | Archive |
| `ops.requests`, `ops.appointments` | Platform life | Archive |
| `notif.messages` | 24 months | Delete |
| `notif.notifications` | 12 months | Delete |
| Deactivated `auth.users` | Anonymise, keep the row for financial and clinical integrity | Anonymise |

Deleting a customer account must never orphan clinical records. A clinical record references a
patient, and a patient references a household. Anonymise, then retain. The user-facing promise is
"your data is deleted" and the internal truth is "personal identifiers are anonymised and clinical
records are retained under statutory obligation, which we explain in the closure notice." Both
statements must appear, or one of them is misleading.