-- 008_clean_slate_admin_only.sql
-- Removes all seeded test Caregivers, Customers, Patients, Requests, Appointments, Invoices, Payments, and Reviews.
-- Preserves ONLY Admin, Clinical Supervisor, and Dispatcher accounts, plus the Service Catalog & Sub-Cities.

delete from ops.communications;
delete from clinical.vitals;
delete from clinical.visit_records;
delete from ops.reviews;
delete from fin.payments;
delete from fin.invoices;
delete from ops.assignments;
delete from ops.appointments;
delete from ops.requests;
delete from clinical.patient_medications;
delete from clinical.patients;
delete from ops.caregiver_services;
delete from ops.caregiver_settings;
delete from ops.caregiver_profiles;
delete from core.emergency_contacts;
delete from core.addresses where owner_user_id in (select id from auth.users where role in ('CAREGIVER', 'CUSTOMER'));
delete from auth.sessions where user_id in (select id from auth.users where role in ('CAREGIVER', 'CUSTOMER'));
delete from auth.users where role in ('CAREGIVER', 'CUSTOMER');
