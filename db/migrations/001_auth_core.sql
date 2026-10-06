-- 001: auth + core + catalog (identity, sessions, consents, addresses, reference data)
-- Mirrors docs/06-data-model.md §§ 1-3 for the pieces the auth loop and registration touch.
-- Forward-only: never edit after it ships; add 002_... instead.

create schema if not exists auth;
create schema if not exists core;
create schema if not exists catalog;

-- ---------------------------------------------------------------------------
-- auth.users — one identity record per human. No clinical data in this table.
-- ---------------------------------------------------------------------------

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
  password_hash      text,
  full_name          text not null,
  full_name_enc      bytea,
  photo_object_key   text,
  preferred_language text not null default 'en' check (preferred_language in ('en','am')),
  is_available       boolean,
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

-- ---------------------------------------------------------------------------
-- auth.sessions — refresh-token rotation with reuse detection.
-- ---------------------------------------------------------------------------

create table auth.sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  refresh_hash   text not null unique,
  family_id      uuid not null,
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

-- ---------------------------------------------------------------------------
-- auth.otp_challenges — durable challenge records. The API's active OTP store is
-- still in-memory for this milestone; the hashes land here once it is migrated.
-- ---------------------------------------------------------------------------

create type auth.otp_purpose as enum ('REGISTER','LOGIN','VERIFY_PHONE','RESET_PASSWORD','ARRIVAL_CODE');

create table auth.otp_challenges (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  phone_e164   text not null,
  purpose      auth.otp_purpose not null,
  code_hash    text not null,
  attempts     int not null default 0,
  max_attempts int not null default 5,
  issued_at    timestamptz not null default now(),
  expires_at   timestamptz not null,
  consumed_at  timestamptz,
  ip           inet
);
create index otp_lookup on auth.otp_challenges (phone_e164, purpose, consumed_at);

-- ---------------------------------------------------------------------------
-- auth.consents — health-data consent kept separate from general terms.
-- ---------------------------------------------------------------------------

create type auth.consent_type as enum
  ('TERMS','PRIVACY','HEALTH_DATA_PROCESSING','MARKETING','PHOTO_SHARING','CAREGIVER_RESPONSE');

create table auth.consents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  consent_type auth.consent_type not null,
  version      text not null,
  granted      boolean not null,
  granted_at   timestamptz,
  revoked_at   timestamptz,
  ip           inet,
  device_id    text,
  constraint consents_unique_grant unique (user_id, consent_type, version)
);
create index consents_user_idx on auth.consents (user_id, revoked_at);

-- ---------------------------------------------------------------------------
-- catalog.sub_cities / catalog.woredas — reference tables, never hardcoded.
-- ---------------------------------------------------------------------------

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

-- Addis Ababa's eleven sub-cities. Stable ids so seed data can reference them across environments.
insert into catalog.sub_cities (id, code, name_en, name_am, sort_order) values
  ('11111111-1111-4111-8111-111111111101','AA-01','Addis Ketema','አዲስ ከተማ',1),
  ('11111111-1111-4111-8111-111111111102','AA-02','Akaki Kality','አቃቂ ቃሊቲ',2),
  ('11111111-1111-4111-8111-111111111103','AA-03','Arada','አራዳ',3),
  ('11111111-1111-4111-8111-111111111104','AA-04','Bole','ቦሌ',4),
  ('11111111-1111-4111-8111-111111111105','AA-05','Gullele','ጉለሌ',5),
  ('11111111-1111-4111-8111-111111111106','AA-06','Kirkos','ቂርቆስ',6),
  ('11111111-1111-4111-8111-111111111107','AA-07','Kolfe Keranio','ኮልፌ ቀራንዮ',7),
  ('11111111-1111-4111-8111-111111111108','AA-08','Lideta','ልደታ',8),
  ('11111111-1111-4111-8111-111111111109','AA-09','Nifas Silk-Lafto','ንፋስ ስልክ ላፍቶ',9),
  ('11111111-1111-4111-8111-111111111110','AA-10','Yeka','የካ',10),
  ('11111111-1111-4111-8111-111111111111','AA-11','Lemi Kura','ለሚ ኩራ',11);

-- ---------------------------------------------------------------------------
-- core.addresses — delivery/safety-critical address, referenced by registration.
-- ---------------------------------------------------------------------------

create type core.geo_precision as enum ('PIN','CENTROID','NONE');

create table core.addresses (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  label         text not null,
  sub_city_id   uuid not null references catalog.sub_cities(id),
  woreda        text not null,
  kebele        text not null,
  house_number  text not null,
  landmark      text not null,
  phone         text,
  latitude      numeric(9,6),
  longitude     numeric(9,6),
  geo_precision core.geo_precision not null default 'NONE',
  access_notes_enc bytea,
  access_notes_enc_nonce bytea,
  is_default    boolean not null default false,
  is_deleted    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index addresses_owner_idx on core.addresses (owner_user_id) where not is_deleted;

-- ---------------------------------------------------------------------------
-- core.emergency_contacts
-- ---------------------------------------------------------------------------

create table core.emergency_contacts (
  id          uuid primary key default gen_random_uuid(),
  -- FK to clinical.patients is added by the clinical migration (002+); the column is kept here so
  -- the one-owner check below can be enforced column-shape-complete from day one.
  patient_id  uuid,
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