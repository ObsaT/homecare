import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { type INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { AppModule } from '../src/app.module'
import { configureApp } from '../src/configure-app'
import { PG_POOL } from '../src/db/db.module'
import { Pool } from 'pg'
import { TokenService } from '../src/auth/token.service'

describe('Home Care Full End-to-End Workflow', () => {
  let app: INestApplication
  let pool: Pool
  let tokens: TokenService

  let customerToken: string
  let caregiverToken: string
  let adminToken: string
  let customerId: string
  let caregiverId: string
  let adminId: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleRef.createNestApplication()
    configureApp(app)
    await app.init()

    pool = app.get(PG_POOL)
    tokens = app.get(TokenService)

    const custPhone = '+251911' + Math.floor(100000 + Math.random() * 900000)
    const cgPhone = '+251912' + Math.floor(100000 + Math.random() * 900000)
    const adminPhone = '+251913' + Math.floor(100000 + Math.random() * 900000)

    // Seed test users
    const custRes = await pool.query(
      `insert into auth.users (role, status, phone, phone_e164, full_name, preferred_language)
       values ('CUSTOMER', 'ACTIVE', $1, $1, 'Abebe Bikila', 'am')
       returning id`,
      [custPhone],
    )
    customerId = custRes.rows[0].id
    customerToken = tokens.issueAccessToken({ sub: customerId, sid: 'sid-cust', role: 'CUSTOMER', jti: 'jti-cust' })

    const cgRes = await pool.query(
      `insert into auth.users (role, status, phone, phone_e164, full_name, is_available, preferred_language)
       values ('CAREGIVER', 'ACTIVE', $1, $1, 'Sister Almaz', true, 'am')
       returning id`,
      [cgPhone],
    )
    caregiverId = cgRes.rows[0].id
    caregiverToken = tokens.issueAccessToken({ sub: caregiverId, sid: 'sid-cg', role: 'CAREGIVER', jti: 'jti-cg' })

    // Caregiver profile
    await pool.query(
      `insert into ops.caregiver_profiles (user_id, approval_status, professional_title, qualification_level)
       values ($1, 'APPROVED', 'Registered Nurse', 'BSc Nursing')
       on conflict (user_id) do nothing`,
      [caregiverId],
    )

    const adminRes = await pool.query(
      `insert into auth.users (role, status, phone, phone_e164, full_name, preferred_language)
       values ('ADMIN', 'ACTIVE', $1, $1, 'Admin Bethlehem', 'en')
       returning id`,
      [adminPhone],
    )
    adminId = adminRes.rows[0].id
    adminToken = tokens.issueAccessToken({ sub: adminId, sid: 'sid-admin', role: 'ADMIN', jti: 'jti-admin' })
  })

  afterAll(async () => {
    if (pool) {
      await pool.query(`delete from ops.reviews where customer_user_id = $1 or caregiver_id = $2`, [customerId, caregiverId])
      await pool.query(`delete from clinical.visit_records where caregiver_id = $1`, [caregiverId])
      await pool.query(`delete from ops.assignments where caregiver_id = $1`, [caregiverId])
      await pool.query(`delete from fin.invoices where customer_user_id = $1`, [customerId])
      await pool.query(`delete from ops.requests where customer_user_id = $1`, [customerId])
      await pool.query(`delete from clinical.patients where household_user_id = $1`, [customerId])
      await pool.query(`delete from core.addresses where owner_user_id = $1`, [customerId])
      await pool.query(`delete from ops.caregiver_profiles where user_id = $1`, [caregiverId])
      await pool.query(`delete from auth.users where id in ($1, $2, $3)`, [customerId, caregiverId, adminId])
    }
    if (app) {
      await app.close()
    }
  })

  it('1. Public catalog: retrieves services and sub-cities', async () => {
    const servicesRes = await request(app.getHttpServer()).get('/api/v1/services')
    expect(servicesRes.status).toBe(200)
    expect(Array.isArray(servicesRes.body.data)).toBe(true)
    expect(servicesRes.body.data.length).toBeGreaterThanOrEqual(9)

    const nursing = servicesRes.body.data.find((s: { code: string }) => s.code === 'NURSING')
    expect(nursing).toBeDefined()
    expect(nursing.name_am).toBe('የነርሲንግ ክብካቤ')

    const subCitiesRes = await request(app.getHttpServer()).get('/api/v1/sub-cities')
    expect(subCitiesRes.status).toBe(200)
    expect(subCitiesRes.body.data.length).toBe(11)
  })

  it('2. Full lifecycle: customer requests care, admin assigns nurse, nurse delivers & completes visit', async () => {
    // A. Sub-city ID for Bole
    const subCitiesRes = await request(app.getHttpServer()).get('/api/v1/sub-cities')
    const bole = subCitiesRes.body.data.find((sc: { name_en: string }) => sc.name_en === 'Bole')
    expect(bole).toBeDefined()

    // B. Customer books home care
    const bookingPayload = {
      service_code: 'WOUND_CARE',
      patient_name: 'Kebede Michael',
      patient_age: 72,
      patient_gender: 'MALE',
      sub_city_id: bole.id,
      address: 'Bole Atlas, near Edna Mall',
      landmark: 'Next to Atlas Hotel',
      latitude: 9.0105,
      longitude: 38.7891,
      emergency_contact_name: 'Aster Kebede',
      emergency_contact_phone: '+251911223344',
      scheduled_date: '2026-10-10',
      scheduled_time: '10:00',
      duration_minutes: 60,
      notes: 'Sterile dressing change required for left knee after surgery',
    }

    const bookingRes = await request(app.getHttpServer())
      .post('/api/v1/requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(bookingPayload)

    expect(bookingRes.status).toBe(201)
    const requestData = bookingRes.body.data
    expect(requestData.reference).toMatch(/^REQ-2026-\d{6}$/)
    expect(requestData.status).toBe('SUBMITTED')
    expect(requestData.appointment).toBeDefined()
    const appointmentId = requestData.appointment.id

    // C. Customer sees request in their list
    const custListRes = await request(app.getHttpServer())
      .get('/api/v1/requests')
      .set('Authorization', `Bearer ${customerToken}`)
    expect(custListRes.status).toBe(200)
    expect(custListRes.body.data.some((r: { id: string }) => r.id === requestData.id)).toBe(true)

    // D. Admin views candidates and assigns caregiver
    const adminSummary = await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard/summary')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(adminSummary.status).toBe(200)
    expect(adminSummary.body.data.pending_requests).toBeGreaterThanOrEqual(1)

    const candidatesRes = await request(app.getHttpServer())
      .get(`/api/v1/admin/appointments/${appointmentId}/candidates`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(candidatesRes.status).toBe(200)
    expect(candidatesRes.body.data.candidates).toBeDefined()
    expect(candidatesRes.body.data.appointment.request_sub_city_name).toBe('Bole')

    const assignRes = await request(app.getHttpServer())
      .post(`/api/v1/admin/appointments/${appointmentId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ caregiver_id: caregiverId })
    expect(assignRes.status).toBe(201)

    // E. Caregiver views offers and accepts
    const offersRes = await request(app.getHttpServer())
      .get('/api/v1/caregiver/offers')
      .set('Authorization', `Bearer ${caregiverToken}`)
    expect(offersRes.status).toBe(200)
    const offer = offersRes.body.data.find((o: { appointment_id: string }) => o.appointment_id === appointmentId)
    expect(offer).toBeDefined()
    expect(offer.sub_city_name).toBe('Bole')
    expect(offer.landmark).toBe('Next to Atlas Hotel')

    const acceptRes = await request(app.getHttpServer())
      .post(`/api/v1/caregiver/offers/${appointmentId}/accept`)
      .set('Authorization', `Bearer ${caregiverToken}`)
    expect(acceptRes.status).toBe(201)
    expect(acceptRes.body.data.status).toBe('CONFIRMED')

    // F. Caregiver marks EN_ROUTE
    const enRouteRes = await request(app.getHttpServer())
      .post(`/api/v1/caregiver/appointments/${appointmentId}/en-route`)
      .set('Authorization', `Bearer ${caregiverToken}`)
    expect(enRouteRes.status).toBe(201)
    expect(enRouteRes.body.data.status).toBe('EN_ROUTE')

    // G. Caregiver arrives and starts visit
    const arriveRes = await request(app.getHttpServer())
      .post(`/api/v1/caregiver/appointments/${appointmentId}/arrive`)
      .set('Authorization', `Bearer ${caregiverToken}`)
      .send({ lat: 9.0105, lng: 38.7891 })
    expect(arriveRes.status).toBe(201)
    expect(arriveRes.body.data.status).toBe('IN_PROGRESS')

    // H. Caregiver completes visit with observations and vitals
    const completeRes = await request(app.getHttpServer())
      .post(`/api/v1/caregiver/appointments/${appointmentId}/complete`)
      .set('Authorization', `Bearer ${caregiverToken}`)
      .send({
        observations: 'Surgical wound clean and healing without signs of infection. Dressing changed under aseptic technique.',
        supplies_used: [
          { item: 'Sterile Gauze 4x4', quantity: 2 },
          { item: 'Antiseptic Solution 50ml', quantity: 1 },
        ],
        follow_up_required: true,
        follow_up_notes: 'Next dressing change recommended in 48 hours.',
        vitals: {
          bp_systolic: 120,
          bp_diastolic: 80,
          heart_rate: 74,
          temperature_c: 36.8,
          oxygen_sat_pct: 98,
        },
      })
    expect(completeRes.status).toBe(201)
    expect(completeRes.body.data.status).toBe('COMPLETED')

    // I. Customer reviews completed visit
    const reviewRes = await request(app.getHttpServer())
      .post(`/api/v1/appointments/${appointmentId}/reviews`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        rating_overall: 5,
        rating_professionalism: 5,
        rating_punctuality: 5,
        rating_quality: 5,
        comment: 'Sister Almaz was very gentle, punctual, and thoroughly professional!',
        is_public: true,
      })
    expect(reviewRes.status).toBe(201)
    expect(reviewRes.body.data.rating_overall).toBe(5)

    // J. Verify caregiver received rating
    const ratingsRes = await request(app.getHttpServer())
      .get(`/api/v1/caregiver/${caregiverId}/ratings`)
    expect(ratingsRes.status).toBe(200)
    expect(ratingsRes.body.data.length).toBeGreaterThanOrEqual(1)
    expect(ratingsRes.body.data[0].comment).toContain('Sister Almaz')
  })
})
