import { Inject, Injectable } from '@nestjs/common'
import { Pool } from 'pg'
import { PG_POOL } from '../db/db.module'

export interface CreatePatientInput {
  full_name: string
  date_of_birth?: string
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'UNSPECIFIED'
  mobility?: 'INDEPENDENT' | 'NEEDS_ASSISTANCE' | 'WALKING_AID' | 'WHEELCHAIR' | 'BEDBOUND' | 'OTHER'
  allergies?: string[]
  physician_name?: string
  physician_phone?: string
  medications?: Array<{
    name: string
    route?: string
    frequency?: string
  }>
}

@Injectable()
export class PatientsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async listPatients(householdUserId: string) {
    const query = `
      select
        id, full_name, date_of_birth, gender, mobility,
        allergies, physician_name, physician_phone, is_active, created_at
      from clinical.patients
      where household_user_id = $1 and deleted_at is null
      order by created_at desc
    `
    const { rows } = await this.pool.query(query, [householdUserId])
    return rows
  }

  async createPatient(householdUserId: string, input: CreatePatientInput) {
    const nameSearch = input.full_name.toLowerCase().trim()
    const client = await this.pool.connect()
    try {
      await client.query('begin')
      const patientQuery = `
        insert into clinical.patients (
          household_user_id, full_name, name_search, date_of_birth,
          gender, mobility, allergies, physician_name, physician_phone
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        returning id, full_name, date_of_birth, gender, mobility, allergies, physician_name, physician_phone, created_at
      `
      const patientRes = await client.query(patientQuery, [
        householdUserId,
        input.full_name,
        nameSearch,
        input.date_of_birth || null,
        input.gender || 'UNSPECIFIED',
        input.mobility || null,
        input.allergies || [],
        input.physician_name || null,
        input.physician_phone || null,
      ])
      const patient = patientRes.rows[0]

      if (input.medications && input.medications.length > 0) {
        for (const med of input.medications) {
          await client.query(
            `insert into clinical.patient_medications (patient_id, name, route, frequency)
             values ($1, $2, $3, $4)`,
            [patient.id, med.name, med.route || 'ORAL', med.frequency || null],
          )
        }
      }

      await client.query('commit')
      return patient
    } catch (err) {
      await client.query('rollback')
      throw err
    } finally {
      client.release()
    }
  }

  async getPatient(householdUserId: string, patientId: string) {
    const query = `
      select
        id, full_name, date_of_birth, gender, mobility,
        allergies, physician_name, physician_phone, is_active, created_at
      from clinical.patients
      where id = $1 and household_user_id = $2 and deleted_at is null
    `
    const { rows } = await this.pool.query(query, [patientId, householdUserId])
    if (rows.length === 0) return null

    const patient = rows[0]
    const medsRes = await this.pool.query(
      `select id, name, route, frequency from clinical.patient_medications where patient_id = $1 and is_active = true`,
      [patient.id],
    )
    patient.medications = medsRes.rows
    return patient
  }
}
