-- 003: seed data for production & admin operations
-- Seeds default admin, clinical supervisor, dispatcher, vetted caregivers, sample care requests, and invoices.

-- 1. Seed Users (Password: Admin@Addis2026!)
insert into auth.users (
  id, role, status, phone, phone_e164, phone_verified_at, email, email_verified_at,
  password_hash, full_name, preferred_language, is_available
) values
  -- Administrators & Supervisors
  ('11111111-1111-4111-8111-111111111101', 'ADMIN', 'ACTIVE', '0911000001', '+251911000001', now(), 'admin@homecare.et', now(), 'scrypt$16384$8$1$c2d279fc53ff821611fe055f388a46a7$wLfwzI2AZD0Intn7OHjv7falsOPJUmier1dbaiUvN2Q=', 'Dr. Meron Tadesse (Admin)', 'en', null),
  ('11111111-1111-4111-8111-111111111102', 'CLINICAL_SUPERVISOR', 'ACTIVE', '0911000002', '+251911000002', now(), 'clinical@homecare.et', now(), 'scrypt$16384$8$1$c2d279fc53ff821611fe055f388a46a7$wLfwzI2AZD0Intn7OHjv7falsOPJUmier1dbaiUvN2Q=', 'Sister Bethlehem Haile (Supervisor)', 'en', null),
  ('11111111-1111-4111-8111-111111111103', 'DISPATCHER', 'ACTIVE', '0911000003', '+251911000003', now(), 'dispatch@homecare.et', now(), 'scrypt$16384$8$1$c2d279fc53ff821611fe055f388a46a7$wLfwzI2AZD0Intn7OHjv7falsOPJUmier1dbaiUvN2Q=', 'Yonas Alemu (Dispatch Coordinator)', 'en', null),

  -- Vetted Caregivers / Nurses
  ('11111111-1111-4111-8111-111111111111', 'CAREGIVER', 'ACTIVE', '0911111111', '+251911111111', now(), 'almaz.nurse@homecare.et', now(), 'scrypt$16384$8$1$c2d279fc53ff821611fe055f388a46a7$wLfwzI2AZD0Intn7OHjv7falsOPJUmier1dbaiUvN2Q=', 'Sister Almaz Hailu (RN)', 'am', true),
  ('11111111-1111-4111-8111-111111111112', 'CAREGIVER', 'ACTIVE', '0911222222', '+251911222222', now(), 'dawit.nurse@homecare.et', now(), 'scrypt$16384$8$1$c2d279fc53ff821611fe055f388a46a7$wLfwzI2AZD0Intn7OHjv7falsOPJUmier1dbaiUvN2Q=', 'Dawit Kebede (Nurse)', 'en', true),
  ('11111111-1111-4111-8111-111111111113', 'CAREGIVER', 'ACTIVE', '0911333333', '+251911333333', now(), 'hanan.pt@homecare.et', now(), 'scrypt$16384$8$1$c2d279fc53ff821611fe055f388a46a7$wLfwzI2AZD0Intn7OHjv7falsOPJUmier1dbaiUvN2Q=', 'Hanan Mohammed (Physiotherapist)', 'am', true),
  ('11111111-1111-4111-8111-111111111114', 'CAREGIVER', 'ACTIVE', '0911444444', '+251911444444', now(), 'genet.cg@homecare.et', now(), 'scrypt$16384$8$1$c2d279fc53ff821611fe055f388a46a7$wLfwzI2AZD0Intn7OHjv7falsOPJUmier1dbaiUvN2Q=', 'Genet Assefa (Senior Caregiver)', 'am', true),

  -- Customers
  ('11111111-1111-4111-8111-111111111121', 'CUSTOMER', 'ACTIVE', '0911555555', '+251911555555', now(), 'abebe.customer@gmail.com', now(), 'scrypt$16384$8$1$c2d279fc53ff821611fe055f388a46a7$wLfwzI2AZD0Intn7OHjv7falsOPJUmier1dbaiUvN2Q=', 'Abebe Bikila', 'en', null),
  ('11111111-1111-4111-8111-111111111122', 'CUSTOMER', 'ACTIVE', '0911666666', '+251911666666', now(), 'sara.bekele@gmail.com', now(), 'scrypt$16384$8$1$c2d279fc53ff821611fe055f388a46a7$wLfwzI2AZD0Intn7OHjv7falsOPJUmier1dbaiUvN2Q=', 'Sara Bekele', 'am', null)
on conflict (id) do nothing;

-- 2. Seed Caregiver Profiles
insert into ops.caregiver_profiles (
  user_id, approval_status, professional_title, qualification_level, institution,
  licence_number, licence_authority, years_experience, languages, specialisations
) values
  ('11111111-1111-4111-8111-111111111111', 'APPROVED', 'Registered Nurse', 'BSc Nursing', 'Addis Ababa University, Tikur Anbessa', 'ET-NUR-2021-9482', 'Ethiopian Health Professionals Council', 6, '{"Amharic", "English"}', '{"Nursing Care", "Wound Care", "Vitals"}'),
  ('11111111-1111-4111-8111-111111111112', 'APPROVED', 'Clinical Nurse', 'Diploma Nursing', 'St. Paul Millennium Medical College', 'ET-NUR-2019-3321', 'Ethiopian Health Professionals Council', 5, '{"Amharic", "Oromiffa", "English"}', '{"Post-Hospital Care", "Elderly Care"}'),
  ('11111111-1111-4111-8111-111111111113', 'APPROVED', 'Physiotherapist', 'BSc Physiotherapy', 'Gondar University', 'ET-PHY-2022-1084', 'Ethiopian Physiotherapy Association', 4, '{"Amharic", "English"}', '{"Physiotherapy", "Rehabilitation"}'),
  ('11111111-1111-4111-8111-111111111114', 'APPROVED', 'Certified Caregiver', 'Geriatric & Palliative Care Certificate', 'Red Cross Training Institute Addis', 'ET-CG-2023-5590', 'Ethiopian Red Cross Society', 3, '{"Amharic"}', '{"Personal Care", "Feeding Assistance"}')
on conflict (user_id) do update set
  approval_status = excluded.approval_status,
  professional_title = excluded.professional_title,
  licence_number = excluded.licence_number;

-- 3. Seed Patients
insert into clinical.patients (
  id, household_user_id, full_name, name_search, date_of_birth, age_years, gender, mobility, allergies
) values
  ('33333333-3333-4333-8333-333333333301', '11111111-1111-4111-8111-111111111121', 'Kebede Michael', 'kebede michael', '1952-05-14', 74, 'MALE', 'NEEDS_ASSISTANCE', '{"Penicillin"}'),
  ('33333333-3333-4333-8333-333333333302', '11111111-1111-4111-8111-111111111122', 'W/ro Roman Bekele', 'roman bekele', '1958-09-20', 68, 'FEMALE', 'WALKING_AID', '{}')
on conflict (id) do nothing;

-- 4. Seed Addresses
insert into core.addresses (
  id, owner_user_id, label, sub_city_id, woreda, kebele, house_number, landmark, is_default
) select
  '44444444-4444-4444-8444-444444444401', '11111111-1111-4111-8111-111111111121', 'Bole Residence',
  s.id, '03', '12', 'House 412/A', 'Behind Atlas Hotel, near Edna Mall', true
from catalog.sub_cities s where s.code = 'AA-04' or s.name_en = 'Bole' limit 1
on conflict (id) do nothing;

insert into core.addresses (
  id, owner_user_id, label, sub_city_id, woreda, kebele, house_number, landmark, is_default
) select
  '44444444-4444-4444-8444-444444444402', '11111111-1111-4111-8111-111111111122', 'Yeka Home',
  s.id, '07', '04', 'House 89', 'Megenagna, near Marathon Building', true
from catalog.sub_cities s where s.code = 'AA-10' or s.name_en = 'Yeka' limit 1
on conflict (id) do nothing;

-- 5. Seed Care Requests & Appointments
insert into ops.requests (
  id, reference, customer_user_id, patient_id, primary_service_id, status,
  address_snapshot, preferred_date, preferred_time, duration_minutes, notes
) select
  '55555555-5555-4555-8555-555555555501', 'REQ-2026-948101',
  '11111111-1111-4111-8111-111111111121', '33333333-3333-4333-8333-333333333301',
  '22222222-2222-4222-8222-222222222204', 'SUBMITTED',
  '{"sub_city": "Bole", "house": "House 412/A", "landmark": "Behind Atlas Hotel"}'::jsonb,
  current_date, '10:00:00', 60, 'Left knee diabetic ulcer dressing change. Requires sterile technique.'
on conflict (id) do nothing;

insert into ops.requests (
  id, reference, customer_user_id, patient_id, primary_service_id, status,
  address_snapshot, preferred_date, preferred_time, duration_minutes, notes
) select
  '55555555-5555-4555-8555-555555555502', 'REQ-2026-948102',
  '11111111-1111-4111-8111-111111111122', '33333333-3333-4333-8333-333333333302',
  '22222222-2222-4222-8222-222222222203', 'ASSIGNED',
  '{"sub_city": "Yeka", "house": "House 89", "landmark": "Megenagna Marathon"}'::jsonb,
  current_date, '14:00:00', 120, 'Post hip arthroplasty rehabilitation and vitals check.'
on conflict (id) do nothing;

-- 6. Seed Appointments
insert into ops.appointments (
  id, request_id, service_id, status, scheduled_start, scheduled_end, duration_minutes,
  caregiver_id, address_snapshot
) values
  ('66666666-6666-4666-8666-666666666601', '55555555-5555-4555-8555-555555555501',
   '22222222-2222-4222-8222-222222222204', 'PENDING', now() + interval '2 hours', now() + interval '3 hours', 60,
   null, '{"sub_city": "Bole", "house": "House 412/A", "landmark": "Behind Atlas Hotel"}'::jsonb),
  ('66666666-6666-4666-8666-666666666602', '55555555-5555-4555-8555-555555555502',
   '22222222-2222-4222-8222-222222222203', 'ACCEPTED', now() + interval '4 hours', now() + interval '6 hours', 120,
   '11111111-1111-4111-8111-111111111111', '{"sub_city": "Yeka", "house": "House 89", "landmark": "Megenagna Marathon"}'::jsonb)
on conflict (id) do nothing;

-- 7. Seed Invoices & Payments for Telebirr / CBE reconciliation
insert into fin.invoices (
  id, invoice_number, request_id, customer_user_id, status, currency,
  subtotal_santim, total_santim, due_at
) values
  ('77777777-7777-4777-8777-777777777701', 'INV-2026-001', '55555555-5555-4555-8555-555555555501',
   '11111111-1111-4111-8111-111111111121', 'ISSUED', 'ETB', 50000, 50000, now() + interval '24 hours'),
  ('77777777-7777-4777-8777-777777777702', 'INV-2026-002', '55555555-5555-4555-8555-555555555502',
   '11111111-1111-4111-8111-111111111122', 'ISSUED', 'ETB', 100000, 100000, now() + interval '24 hours')
on conflict (id) do nothing;

insert into fin.payments (
  id, invoice_id, customer_user_id, amount_santim, method, provider,
  status, provider_reference
) values
  ('88888888-8888-4888-8888-888888888801', '77777777-7777-4777-8777-777777777702',
   '11111111-1111-4111-8111-111111111122', 100000, 'TELEBIRR', 'TELEBIRR',
   'CLAIMED', 'TB-2026-98124501')
on conflict (id) do nothing;

-- 8. Seed Completed Visit Reviews
insert into ops.reviews (
  id, appointment_id, customer_user_id, caregiver_id, rating_overall,
  rating_punctuality, rating_professionalism, rating_quality,
  comment, is_public
) values
  ('99999999-9999-4999-8999-999999999901', '66666666-6666-4666-8666-666666666602',
   '11111111-1111-4111-8111-111111111122', '11111111-1111-4111-8111-111111111111',
   5, 5, 5, 5,
   'Sister Almaz provided exceptional, gentle care for my mother. Highly recommend!', true)
on conflict (id) do nothing;
