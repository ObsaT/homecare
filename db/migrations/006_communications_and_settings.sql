-- 006_communications_and_settings.sql
-- Adds ops.communications for real-time in-visit chat, emergency SOS alerts, and admin broadcasts,
-- plus core.system_settings for dynamic platform configuration (e.g., caregiver registration fee).

create table if not exists core.system_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into core.system_settings (key, value)
values ('caregiver_registration_fee_etb', '500')
on conflict (key) do nothing;

create table if not exists ops.communications (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid references ops.appointments(id) on delete cascade,
  request_id     uuid references ops.requests(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_name    text not null,
  sender_role    text not null,
  recipient_role text not null default 'ALL',
  message_type   text not null default 'CHAT',
  content        text not null,
  metadata       jsonb default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists idx_comms_appt on ops.communications (appointment_id);
create index if not exists idx_comms_req on ops.communications (request_id);
create index if not exists idx_comms_created on ops.communications (created_at desc);

-- Ensure all catalog services are active by default in production
update catalog.services set is_active = true where is_active = false;
