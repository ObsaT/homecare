-- 005_caregiver_location_dispatch.sql
-- Adds location & coverage areas to caregiver profiles and settings for location-based dispatch filtering.

alter table ops.caregiver_profiles
  add column if not exists coverage_sub_city_ids uuid[] not null default '{}';

alter table ops.caregiver_settings
  add column if not exists service_area_notes text;

-- Update existing caregivers with operating locations across Addis Ababa
-- 1. Sister Almaz Hailu (RN) -> Base in Bole, covers Bole, Kirkos, Yeka
update ops.caregiver_profiles
set
  home_sub_city_id = '11111111-1111-4111-8111-111111111104',
  coverage_sub_city_ids = array[
    '11111111-1111-4111-8111-111111111104'::uuid, -- Bole
    '11111111-1111-4111-8111-111111111106'::uuid, -- Kirkos
    '11111111-1111-4111-8111-111111111110'::uuid  -- Yeka
  ]
where user_id = '11111111-1111-4111-8111-111111111111';

insert into ops.caregiver_settings (caregiver_id, notification_radius_km, max_visits_per_day, service_area_notes)
values ('11111111-1111-4111-8111-111111111111', 10, 4, 'Bole & East Addis Ababa coverage')
on conflict (caregiver_id) do update set
  notification_radius_km = 10,
  service_area_notes = 'Bole & East Addis Ababa coverage';

-- 2. Dawit Kebede (Nurse) -> Base in Yeka, covers Yeka, Bole, Lemi Kura
update ops.caregiver_profiles
set
  home_sub_city_id = '11111111-1111-4111-8111-111111111110',
  coverage_sub_city_ids = array[
    '11111111-1111-4111-8111-111111111110'::uuid, -- Yeka
    '11111111-1111-4111-8111-111111111104'::uuid, -- Bole
    '11111111-1111-4111-8111-111111111111'::uuid  -- Lemi Kura
  ]
where user_id = '11111111-1111-4111-8111-111111111112';

insert into ops.caregiver_settings (caregiver_id, notification_radius_km, max_visits_per_day, service_area_notes)
values ('11111111-1111-4111-8111-111111111112', 12, 3, 'Yeka, Megenagna, and Lemi Kura area')
on conflict (caregiver_id) do update set
  notification_radius_km = 12,
  service_area_notes = 'Yeka, Megenagna, and Lemi Kura area';

-- 3. Hanan Mohammed (Physiotherapist) -> Base in Kirkos, covers Kirkos, Lideta, Arada, Bole
update ops.caregiver_profiles
set
  home_sub_city_id = '11111111-1111-4111-8111-111111111106',
  coverage_sub_city_ids = array[
    '11111111-1111-4111-8111-111111111106'::uuid, -- Kirkos
    '11111111-1111-4111-8111-111111111108'::uuid, -- Lideta
    '11111111-1111-4111-8111-111111111103'::uuid, -- Arada
    '11111111-1111-4111-8111-111111111104'::uuid  -- Bole
  ]
where user_id = '11111111-1111-4111-8111-111111111113';

insert into ops.caregiver_settings (caregiver_id, notification_radius_km, max_visits_per_day, service_area_notes)
values ('11111111-1111-4111-8111-111111111113', 15, 3, 'Central Addis Ababa physical therapy visits')
on conflict (caregiver_id) do update set
  notification_radius_km = 15,
  service_area_notes = 'Central Addis Ababa physical therapy visits';

-- 4. Genet Assefa (Senior Caregiver) -> Base in Arada, covers Arada, Addis Ketema, Gullele
update ops.caregiver_profiles
set
  home_sub_city_id = '11111111-1111-4111-8111-111111111103',
  coverage_sub_city_ids = array[
    '11111111-1111-4111-8111-111111111103'::uuid, -- Arada
    '11111111-1111-4111-8111-111111111101'::uuid, -- Addis Ketema
    '11111111-1111-4111-8111-111111111105'::uuid  -- Gullele
  ]
where user_id = '11111111-1111-4111-8111-111111111114';

insert into ops.caregiver_settings (caregiver_id, notification_radius_km, max_visits_per_day, service_area_notes)
values ('11111111-1111-4111-8111-111111111114', 8, 4, 'North and Central Addis senior daily assistance')
on conflict (caregiver_id) do update set
  notification_radius_km = 8,
  service_area_notes = 'North and Central Addis senior daily assistance';
