-- 002: catalog, clinical, ops, fin, reviews
-- Implements the core clinical, operational, and financial schemas per docs/06-data-model.md.
-- Forward-only migration.

create schema if not exists clinical;
create schema if not exists ops;
create schema if not exists fin;

-- ---------------------------------------------------------------------------
-- 1. catalog.services & pricing
-- ---------------------------------------------------------------------------

create type catalog.service_code as enum (
  'NURSING', 'ELDERLY', 'POST_HOSPITAL', 'WOUND_CARE', 'MEDICATION',
  'PERSONAL_CARE', 'FEEDING', 'VITALS', 'PHYSIOTHERAPY', 'OTHER'
);

create type catalog.billing_unit as enum ('PER_VISIT', 'PER_HOUR', 'PER_DAY', 'PER_SESSION');

create table catalog.services (
  id                       uuid primary key default gen_random_uuid(),
  code                     catalog.service_code not null unique,
  name_en                  text not null,
  name_am                  text not null,
  description_en           text not null,
  description_am           text not null,
  includes_en              text[] not null default '{}',
  excludes_en              text[] not null default '{}',
  requires_licence         boolean not null default false,
  required_qualification   text,
  default_duration_minutes int not null default 60,
  min_duration_minutes     int not null default 60,
  max_duration_minutes     int not null default 480,
  billing_unit             catalog.billing_unit not null default 'PER_VISIT',
  care_checklist           jsonb not null default '[]'::jsonb,
  supplies_template        jsonb not null default '[]'::jsonb,
  is_active                boolean not null default true,
  requires_review          boolean not null default false,
  sort_order               int not null default 0,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create table catalog.service_prices (
  id               uuid primary key default gen_random_uuid(),
  service_id       uuid not null references catalog.services(id),
  billing_unit     catalog.billing_unit not null,
  amount_santim    bigint not null check (amount_santim >= 0),
  min_units        int,
  band_minutes     int,
  band_max_minutes int,
  effective_from   timestamptz not null default now(),
  effective_to     timestamptz,
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now()
);
create unique index price_current_uniq
  on catalog.service_prices (service_id, band_minutes)
  where effective_to is null;

create type catalog.surcharge_kind as enum
  ('NIGHT', 'WEEKEND', 'HOLIDAY', 'URGENT', 'TRANSPORT', 'ADDITIONAL_HOUR', 'CANCELLATION');

create table catalog.surcharges (
  id                uuid primary key default gen_random_uuid(),
  kind              catalog.surcharge_kind not null,
  sub_city_id       uuid references catalog.sub_cities(id),
  amount_santim     bigint not null,
  percent_bp        int,
  label_en          text not null,
  label_am          text not null,
  explanation_en    text not null,
  explanation_am    text not null,
  applies_from_hour int,
  applies_to_hour   int,
  applies_to_days   int[],
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Seed services with Addis Ababa localization (1 ETB = 100 santim)
insert into catalog.services (id, code, name_en, name_am, description_en, description_am, requires_licence, required_qualification, default_duration_minutes, min_duration_minutes, max_duration_minutes, billing_unit, requires_review, sort_order) values
  ('22222222-2222-4222-8222-222222222201', 'NURSING', 'Nursing Care', 'የነርሲንግ ክብካቤ', 'Professional in-home clinical nursing, wound assessment, and specialized treatment.', 'በባለሙያ ነርስ የሚሰጥ የህክምና እና የክብካቤ አገልግሎት በቤትዎ።', true, 'Registered Nurse (BSc/Diploma)', 120, 60, 480, 'PER_HOUR', false, 1),
  ('22222222-2222-4222-8222-222222222202', 'ELDERLY', 'Elderly Care', 'የአረጋውያን ክብካቤ', 'Compassionate daily living assistance, hygiene, mobility, and companionship for seniors.', 'ለአረጋውያን የሚሰጥ የዕለት ተዕለት እንቅስቃሴ እና የንጽህና ድጋፍ ክብካቤ።', false, 'Trained Caregiver', 240, 120, 720, 'PER_HOUR', false, 2),
  ('22222222-2222-4222-8222-222222222203', 'POST_HOSPITAL', 'Post-Hospital Care', 'ከሆስፒታል መልስ ክብካቤ', 'Structured recovery support after discharge, surgical monitoring, and rehabilitation.', 'ከሆስፒታል ህክምና በኋላ በቤት ውስጥ የሚሰጥ የክትትልና የማገገሚያ ድጋፍ።', true, 'Registered Nurse', 240, 120, 720, 'PER_HOUR', false, 3),
  ('22222222-2222-4222-8222-222222222204', 'WOUND_CARE', 'Wound Care & Dressing', 'የቁስል እጥበትና ማሰር', 'Aseptic wound cleansing, sterile dressing change, and healing progress monitoring.', 'የጸዳ የቁስል እጥበት፣ ማሰር እና የህመም ክትትል አገልግሎት።', true, 'Registered Nurse', 60, 30, 120, 'PER_VISIT', false, 4),
  ('22222222-2222-4222-8222-222222222205', 'MEDICATION', 'Medication Support', 'የመድሃኒት ክትትል', 'Safe medication scheduling, administration assistance, and compliance tracking.', 'የመድሃኒት ሰዓት ክትትል እና የማስተዳደር ድጋፍ።', true, 'Registered Nurse', 60, 30, 120, 'PER_VISIT', false, 5),
  ('22222222-2222-4222-8222-222222222206', 'PERSONAL_CARE', 'Personal Care', 'የግል ንጽህና ክብካቤ', 'Assistance with bathing, dressing, grooming, bed-turning, and oral hygiene.', 'የገላ መታጠብ፣ ልብስ መልበስ እና የግል ንጽህና መጠበቅ ድጋፍ።', false, 'Trained Caregiver', 120, 60, 240, 'PER_HOUR', false, 6),
  ('22222222-2222-4222-8222-222222222207', 'FEEDING', 'Feeding Assistance', 'የምግብ ድጋፍ', 'Nutritional support, assisted feeding, and dietary intake monitoring.', 'የተመጣጠነ ምግብ የመመገብ ድጋፍ እና ክትትል።', false, 'Trained Caregiver', 60, 30, 120, 'PER_VISIT', false, 7),
  ('22222222-2222-4222-8222-222222222208', 'VITALS', 'Vital-Sign Monitoring', 'የጤና ሁኔታ/ምልክቶች ክትትል', 'Accurate measurement of blood pressure, blood glucose, temperature, pulse, and oxygen saturation.', 'የደም ግፊት፣ ስኳር፣ ሙቀት፣ የልብ ምት እና የኦክስጅን መጠን ልኬት።', true, 'Registered Nurse', 60, 30, 120, 'PER_VISIT', false, 8),
  ('22222222-2222-4222-8222-222222222209', 'PHYSIOTHERAPY', 'Physiotherapy', 'የፊዚዮቴራፒ አገልግሎት', 'Tailored physical rehabilitation, mobility exercises, and pain management in your home.', 'የእንቅስቃሴ ማገገሚያ፣ የአካል ብቃት እንቅስቃሴ እና ህመም ማስታገሻ ቴራፒ።', true, 'Licensed Physiotherapist', 60, 45, 120, 'PER_SESSION', false, 9),
  ('22222222-2222-4222-8222-222222222210', 'OTHER', 'Specialized Care Request', 'ሌሎች ልዩ ፍላጎቶች', 'Custom home care request reviewed directly by our clinical coordination team.', 'በክሊኒካል ቡድናችን ታይቶ የሚወሰን ልዩ የቤት ውስጥ ክብካቤ ፍላጎት።', false, 'Clinical Coordinator Review', 120, 60, 480, 'PER_VISIT', true, 10);

-- Baseline prices (e.g. 500 ETB = 50,000 santim)
insert into catalog.service_prices (service_id, billing_unit, amount_santim, effective_from)
select id, billing_unit, 50000, now() from catalog.services;

-- ---------------------------------------------------------------------------
-- 2. clinical.patients & medications
-- ---------------------------------------------------------------------------

create type clinical.gender as enum ('MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED');
create type clinical.mobility as enum
  ('INDEPENDENT', 'NEEDS_ASSISTANCE', 'WALKING_AID', 'WHEELCHAIR', 'BEDBOUND', 'OTHER');

create table clinical.patients (
  id                       uuid primary key default gen_random_uuid(),
  household_user_id        uuid not null references auth.users(id),
  full_name                text not null,
  full_name_enc            bytea,
  full_name_enc_nonce      bytea,
  name_search              text not null,
  date_of_birth            date,
  age_years                int,
  gender                   clinical.gender default 'UNSPECIFIED',
  mobility                 clinical.mobility,
  care_needs_enc           bytea,
  care_needs_enc_nonce     bytea,
  allergies                text[] not null default '{}',
  special_requirements_enc bytea,
  special_requirements_enc_nonce bytea,
  physician_name           text,
  physician_phone          text,
  is_active                boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted_at               timestamptz
);
create index patients_household_idx on clinical.patients (household_user_id) where deleted_at is null;

create type clinical.medication_route as enum
  ('ORAL', 'TOPICAL', 'INHALED', 'SUBCUTANEOUS', 'INTRAMUSCULAR', 'RECTAL', 'EYE', 'EAR', 'OTHER');

create table clinical.patient_medications (
  id                      uuid primary key default gen_random_uuid(),
  patient_id              uuid not null references clinical.patients(id) on delete cascade,
  name                    text not null,
  name_enc                bytea,
  name_enc_nonce          bytea,
  dose                    text,
  route                   clinical.medication_route,
  frequency               text,
  requires_administration boolean not null default false,
  prescriber_name         text,
  started_on              date,
  ended_on                date,
  is_active               boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Wire foreign key from core.emergency_contacts to clinical.patients
alter table core.emergency_contacts
  add constraint emergency_contacts_patient_fk
  foreign key (patient_id) references clinical.patients(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 3. ops.caregiver profiles & clearances
-- ---------------------------------------------------------------------------

create table ops.caregiver_profiles (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  approval_status     text not null default 'DRAFT'
    check (approval_status in ('DRAFT', 'PENDING_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'SUSPENDED')),
  professional_title  text not null,
  qualification_level text,
  field_of_study      text,
  institution         text,
  licence_number      text,
  licence_authority   text,
  licence_issued_on   date,
  licence_expires_on  date,
  licence_verified_at timestamptz,
  licence_verified_by uuid references auth.users(id),
  years_experience    int,
  languages           text[] not null default '{}',
  specialisations     text[] not null default '{}',
  home_sub_city_id    uuid references catalog.sub_cities(id),
  home_woreda         text,
  rating_avg          numeric(3, 2),
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
  updated_at          timestamptz not null default now()
);

create table ops.caregiver_services (
  caregiver_id uuid not null references auth.users(id) on delete cascade,
  service_id   uuid not null references catalog.services(id),
  cleared_by   uuid references auth.users(id),
  cleared_at   timestamptz not null default now(),
  primary key (caregiver_id, service_id)
);

create table ops.caregiver_settings (
  caregiver_id           uuid primary key references auth.users(id) on delete cascade,
  notification_radius_km int not null default 10,
  max_visits_per_day     int not null default 3,
  pay_model              text not null default 'PER_HOUR' check (pay_model in ('PER_VISIT', 'PER_HOUR', 'PER_SHIFT')),
  hourly_rate_santim     bigint,
  shift_rate_santim      bigint,
  updated_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. ops.requests & appointments
-- ---------------------------------------------------------------------------

create type ops.request_status as enum (
  'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFO', 'APPROVED', 'ASSIGNED',
  'CONFIRMED', 'EN_ROUTE', 'IN_PROGRESS', 'COMPLETED', 'UNABLE_TO_FULFILL', 'CANCELLED', 'CLOSED'
);

create type ops.urgency as enum ('ROUTINE', 'URGENT_24H', 'URGENT_TODAY');
create type ops.recurrence_freq as enum ('NONE', 'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');

create table ops.requests (
  id                         uuid primary key default gen_random_uuid(),
  reference                  text not null unique,
  customer_user_id           uuid not null references auth.users(id),
  patient_id                 uuid not null references clinical.patients(id),
  primary_service_id         uuid not null references catalog.services(id),
  additional_services        uuid[] not null default '{}',
  status                     ops.request_status not null default 'SUBMITTED',
  urgency                    ops.urgency not null default 'ROUTINE',
  notes                      text,
  care_needs_enc             bytea,
  special_requirements_enc   bytea,
  address_id                 uuid references core.addresses(id),
  address_snapshot           jsonb not null,
  emergency_contact_snapshot jsonb,
  preferred_date             date,
  preferred_time             time,
  duration_minutes           int not null check (duration_minutes between 30 and 1440),
  recurrence_freq            ops.recurrence_freq not null default 'NONE',
  recurrence_interval        int not null default 1,
  recurrence_days            int[],
  recurrence_count           int,
  recurrence_until           date,
  total_visits_planned       int,
  review_note                text,
  decline_reason             text,
  reviewed_by                uuid references auth.users(id),
  reviewed_at                timestamptz,
  source                     text not null default 'APP' check (source in ('APP', 'PHONE', 'WALK_IN', 'ADMIN')),
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  submitted_at               timestamptz default now(),
  cancelled_at               timestamptz,
  cancel_reason              text,
  cancelled_by_role          auth.user_role
);
create index requests_queue_idx on ops.requests (status, created_at)
  where status in ('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFO', 'APPROVED');
create index requests_customer_idx on ops.requests (customer_user_id, created_at desc);

create type ops.appointment_status as enum (
  'PENDING', 'OFFERED', 'ACCEPTED', 'EN_ROUTE', 'IN_PROGRESS', 'COMPLETED',
  'CANCELLED', 'DECLINED', 'NO_SHOW', 'UNABLE_TO_FULFILL', 'EXPIRED'
);

create table ops.appointments (
  id                         uuid primary key default gen_random_uuid(),
  request_id                 uuid not null references ops.requests(id) on delete cascade,
  occurrence_index           int not null default 1,
  caregiver_id               uuid references auth.users(id),
  service_id                 uuid not null references catalog.services(id),
  status                     ops.appointment_status not null default 'PENDING',
  scheduled_start            timestamptz not null,
  scheduled_end              timestamptz not null,
  duration_minutes           int not null,
  timezone                   text not null default 'Africa/Addis_Ababa',
  address_id                 uuid references core.addresses(id),
  address_snapshot           jsonb not null,
  latitude                   numeric(9, 6),
  longitude                  numeric(9, 6),
  price_santim               bigint not null default 0,
  price_breakdown            jsonb not null default '{}'::jsonb,
  caregiver_pay_santim       bigint,
  arrival_at                 timestamptz,
  arrival_lat                numeric(9, 6),
  arrival_lng                numeric(9, 6),
  departure_at               timestamptz,
  departure_lat              numeric(9, 6),
  departure_lng              numeric(9, 6),
  customer_confirmed_arrival boolean,
  cancel_reason              text,
  cancelled_by_role          auth.user_role,
  client_record_id           text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  unique (request_id, occurrence_index)
);
create index appointments_schedule_idx on ops.appointments (scheduled_start, status);
create index appointments_caregiver_idx on ops.appointments (caregiver_id, scheduled_start desc);
create index appointments_unassigned_idx on ops.appointments (scheduled_start)
  where caregiver_id is null and status in ('PENDING', 'OFFERED');

create type ops.assignment_status as enum (
  'OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'REVOKED', 'REASSIGNED', 'AUTO_CANCELLED'
);
create type ops.decline_reason as enum (
  'TOO_FAR', 'NOT_AVAILABLE', 'NOT_QUALIFIED', 'PERSONAL', 'PATIENT_CONFLICT', 'OTHER'
);

create table ops.assignments (
  id                      uuid primary key default gen_random_uuid(),
  appointment_id          uuid not null references ops.appointments(id) on delete cascade,
  caregiver_id            uuid not null references auth.users(id),
  status                  ops.assignment_status not null default 'OFFERED',
  offered_at              timestamptz not null default now(),
  expires_at              timestamptz not null,
  responded_at            timestamptz,
  decline_reason          ops.decline_reason,
  decline_note            text,
  assigned_by             uuid references auth.users(id),
  travel_minutes_estimate int,
  accepted_at             timestamptz,
  revoked_at              timestamptz,
  revoke_reason           text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index assignments_appointment_idx on ops.assignments (appointment_id, offered_at desc);
create index assignments_pending_idx on ops.assignments (caregiver_id, expires_at)
  where status = 'OFFERED';

-- ---------------------------------------------------------------------------
-- 5. clinical.visit_records & vitals
-- ---------------------------------------------------------------------------

create type clinical.visit_outcome as enum (
  'COMPLETED', 'COMPLETED_PARTIAL', 'CANCELLED_BY_PATIENT', 'NO_SHOW', 'DECLINED_CAREGIVER',
  'SAFETY_ABORTED', 'REFERRED'
);

create table clinical.visit_records (
  id                  uuid primary key default gen_random_uuid(),
  appointment_id      uuid not null unique references ops.appointments(id),
  patient_id          uuid not null references clinical.patients(id),
  caregiver_id        uuid not null references auth.users(id),
  service_id          uuid not null references catalog.services(id),
  outcome             clinical.visit_outcome not null default 'COMPLETED',
  started_at          timestamptz,
  ended_at            timestamptz,
  client_record_id    text unique,
  care_checklist      jsonb not null default '[]'::jsonb,
  observations        text,
  supplies_used       jsonb not null default '[]'::jsonb,
  follow_up_required  boolean not null default false,
  follow_up_notes     text,
  finalised_at        timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index visit_records_patient_idx on clinical.visit_records (patient_id, created_at desc);
create index visit_records_caregiver_idx on clinical.visit_records (caregiver_id, created_at desc);

create table clinical.vitals (
  id                  bigserial primary key,
  visit_record_id     uuid not null references clinical.visit_records(id) on delete cascade,
  recorded_at         timestamptz not null default now(),
  bp_systolic         smallint check (bp_systolic between 40 and 300),
  bp_diastolic        smallint check (bp_diastolic between 20 and 200),
  heart_rate          smallint check (heart_rate between 20 and 250),
  temperature_c       numeric(4, 1) check (temperature_c between 30 and 45),
  respiratory_rate    smallint check (respiratory_rate between 4 and 80),
  oxygen_sat_pct      smallint check (oxygen_sat_pct between 50 and 100),
  blood_glucose_mg_dl smallint check (blood_glucose_mg_dl between 20 and 800),
  weight_kg           numeric(5, 2) check (weight_kg between 0.5 and 400),
  notes               text,
  unique (visit_record_id, recorded_at)
);

-- ---------------------------------------------------------------------------
-- 6. ops.reviews
-- ---------------------------------------------------------------------------

create table ops.reviews (
  id                     uuid primary key default gen_random_uuid(),
  appointment_id         uuid not null unique references ops.appointments(id),
  customer_user_id       uuid not null references auth.users(id),
  caregiver_id           uuid not null references auth.users(id),
  rating_overall         smallint not null check (rating_overall between 1 and 5),
  rating_professionalism smallint not null check (rating_professionalism between 1 and 5),
  rating_punctuality     smallint not null check (rating_punctuality between 1 and 5),
  rating_quality         smallint not null check (rating_quality between 1 and 5),
  comment                text check (comment is null or length(comment) <= 1000),
  is_public              boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index reviews_caregiver_idx on ops.reviews (caregiver_id, rating_overall);

-- ---------------------------------------------------------------------------
-- 7. fin.invoices & payments
-- ---------------------------------------------------------------------------

create type fin.invoice_status as enum (
  'DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID', 'DISPUTED', 'REFUNDED'
);
create type fin.payment_method as enum (
  'CASH', 'BANK_TRANSFER', 'TELEBIRR', 'CBE_BIRR', 'CARD', 'CHEQUE', 'OTHER'
);
create type fin.payment_status as enum (
  'CLAIMED', 'PENDING_CONFIRMATION', 'CONFIRMED', 'FAILED', 'REVERSED'
);
create type fin.payment_provider as enum ('MANUAL', 'TELEBIRR', 'CBE_BIRR', 'PAYPAL', 'STUBELESS');

create table fin.invoices (
  id               uuid primary key default gen_random_uuid(),
  invoice_number   text not null unique,
  customer_user_id uuid not null references auth.users(id),
  request_id       uuid references ops.requests(id),
  status           fin.invoice_status not null default 'ISSUED',
  currency         text not null default 'ETB',
  subtotal_santim  bigint not null,
  surcharge_santim bigint not null default 0,
  discount_santim  bigint not null default 0,
  tax_santim       bigint not null default 0,
  total_santim     bigint not null,
  paid_santim      bigint not null default 0,
  issued_at        timestamptz not null default now(),
  due_at           timestamptz not null,
  paid_at          timestamptz,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table fin.payments (
  id                 uuid primary key default gen_random_uuid(),
  invoice_id         uuid references fin.invoices(id),
  customer_user_id   uuid not null references auth.users(id),
  amount_santim      bigint not null check (amount_santim > 0),
  method             fin.payment_method not null,
  provider           fin.payment_provider not null default 'MANUAL',
  status             fin.payment_status not null default 'CLAIMED',
  provider_reference text,
  customer_reference text,
  receipt_object_key text,
  recorded_by        uuid references auth.users(id),
  confirmed_by       uuid references auth.users(id),
  confirmed_at       timestamptz,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index payments_customer_idx on fin.payments (customer_user_id, status);
