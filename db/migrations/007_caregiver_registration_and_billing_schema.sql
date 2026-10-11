-- 007_caregiver_registration_and_billing_schema.sql
-- Adds caregiver registration fee columns, fin.system_settings, and payment_type to fin.payments
-- so cloud databases have 100% parity with local schema.

alter table ops.caregiver_profiles
  add column if not exists registration_fee_paid boolean default true,
  add column if not exists registration_payment_id uuid;

alter table fin.payments
  add column if not exists payment_type text default 'SERVICE_INVOICE';

create table if not exists fin.system_settings (
  setting_key   text primary key,
  setting_value jsonb not null,
  updated_at    timestamptz not null default now()
);

insert into fin.system_settings (setting_key, setting_value)
values (
  'caregiver_registration_fee',
  '{"fee_etb": 500, "currency": "ETB", "fee_santim": 50000, "description": "Standard Caregiver Clinical Onboarding & Telebirr Verification Fee"}'::jsonb
)
on conflict (setting_key) do nothing;
