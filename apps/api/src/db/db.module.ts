import { Global, Inject, Module, OnModuleInit } from '@nestjs/common'
import { Pool, type PoolClient } from 'pg'
import { getConfig } from '../config'

export const PG_POOL = 'PG_POOL'

export function createPool(connectionString: string): Pool {
  const isLocal =
    connectionString.includes('127.0.0.1') ||
    connectionString.includes('localhost') ||
    connectionString.includes('@postgres:')
  const useSsl =
    !isLocal &&
    (process.env.PGSSLMODE === 'require' ||
      connectionString.includes('sslmode=') ||
      process.env.NODE_ENV === 'production')

  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  })
  // Fail fast on configuration mistakes instead of surfacing them as request-time timeouts.
  pool.on('error', (error) => {
    // eslint-disable-next-line no-console
    console.error('pg pool error', error)
  })
  return pool
}

/**
 * Owns the Postgres connection pool. Global so any module can inject the pool token directly,
 * matching how Nest wires cross-cutting infrastructure.
 */
@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: (): Pool => createPool(getConfig().databaseUrl),
    },
  ],
  exports: [PG_POOL],
})
export class DbModule implements OnModuleInit {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return
    try {
      await this.pool.query(`
        alter table auth.users drop constraint if exists users_preferred_language_check;
        alter table auth.users add constraint users_preferred_language_check check (preferred_language in ('en', 'am', 'om'));

        alter table ops.caregiver_profiles
          add column if not exists coverage_sub_city_ids uuid[] not null default '{}',
          add column if not exists registration_fee_paid boolean default true,
          add column if not exists registration_payment_id uuid;

        alter table ops.caregiver_settings
          add column if not exists service_area_notes text;

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
      `)

      // One-time clean slate check: ensure seeded demo Caregivers/Customers (11111111-1111-4111-8111-111111111111..22) are purged once
      const cleanCheck = await this.pool.query(
        `select 1 from fin.system_settings where setting_key = 'clean_slate_admin_only_v1'`,
      )
      if (cleanCheck.rows.length === 0) {
        await this.pool.query(`
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
          insert into fin.system_settings (setting_key, setting_value)
          values ('clean_slate_admin_only_v1', '{"executed": true}'::jsonb)
          on conflict (setting_key) do nothing;
        `)
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[DbModule] Schema auto-sync skipped or partial:', err)
    }
  }
}

/** Runs `fn` inside a transaction; used by registration, which writes several rows atomically. */
export async function withTransaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('begin')
    const result = await fn(client)
    await client.query('commit')
    return result
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

/** Wipes the auth/core tables. Tests only. */
export async function truncateAuthCore(pool: Pool): Promise<void> {
  await pool.query(
    'truncate auth.sessions, auth.consents, auth.otp_challenges, core.addresses, core.emergency_contacts, auth.users restart identity cascade',
  )
}

export function errCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null) {
    return (error as { code?: string }).code
  }
  return undefined
}