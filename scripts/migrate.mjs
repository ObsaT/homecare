#!/usr/bin/env node
// Forward-only migration runner.
//
// Usage:
//   node --env-file=.env scripts/migrate.mjs            # applies pending migrations to DATABASE_URL
//   DATABASE_URL=... node scripts/migrate.mjs
//
// Migrations are SQL files in db/migrations/, applied in lexicographic order, each in its own
// transaction, recorded in schema_migrations. A migration that has been applied is never re-run and
// never edited — forward-only, per docs/13-infrastructure.md § 2. To change a shipped migration,
// add a new one.
//
// The transaction-is-per-file rule is honoured by Postgres: an error inside a file rolls that file
// back, but earlier files stay applied; the runner reports which file failed so a human applies the
// fix as a new migration.

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Client } = pg

const MIGRATIONS_DIR = new URL('../db/migrations/', import.meta.url)
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Run scripts/provision-db.sh and use --env-file=.env.')
  process.exit(2)
}

const client = new Client({ connectionString: databaseUrl })
await client.connect()

await client.query(`
  create table if not exists schema_migrations (
    name       text primary key,
    applied_at timestamptz not null default now()
  )
`)

const { rows } = await client.query('select name from schema_migrations')
const applied = new Set(rows.map((row) => row.name))

const dir = fileURLToPath(MIGRATIONS_DIR)
const files = (await readFile(join(dir, 'manifest.txt'), 'utf8'))
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))

let ran = 0
for (const name of files) {
  if (applied.has(name)) continue
  const sql = await readFile(join(dir, name), 'utf8')
  try {
    await client.query('begin')
    await client.query(sql)
    await client.query('insert into schema_migrations (name) values ($1)', [name])
    await client.query('commit')
    console.log(`applied ${name}`)
    ran += 1
  } catch (error) {
    await client.query('rollback')
    console.error(`failed ${name}: ${error instanceof Error ? error.message : String(error)}`)
    await client.end()
    process.exit(1)
  }
}

if (ran === 0) console.log('schema is up to date')
await client.end()