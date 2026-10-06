import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomKeyPair } from './crypto/crypto'

/**
 * Environment configuration, loaded once per process.
 *
 * Values come from process.env, seeded from `.env` at the repository root (searched upward from the
 * working directory, so this works whether commands run from the repo root or from apps/api). That
 * file is gitignored and produced by scripts/provision-db.sh.
 */

let baseDir: string | undefined

function findEnvFile(dir: string): string | undefined {
  const candidate = join(dir, '.env')
  if (existsSync(candidate)) return candidate
  const parent = resolve(dir, '..')
  if (parent === dir) return undefined
  return findEnvFile(parent)
}

/** Seeds process.env from the nearest `.env`. Variable presence wins: it does not override real env. */
export function loadEnv(): void {
  const file = findEnvFile(process.cwd())
  if (!file) return
  baseDir = resolve(file, '..')
  const text = readFileSync(file, 'utf8')
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const cleanLine = line.startsWith('export ') ? line.slice(7).trim() : line
    const eq = cleanLine.indexOf('=')
    if (eq <= 0) continue
    const key = cleanLine.slice(0, eq).trim()
    const value = cleanLine.slice(eq + 1).trim().replace(/^"(.*)"$/, '$1')
    if (key && !(key in process.env)) process.env[key] = value
  }
}

export interface AppConfig {
  baseDir: string
  databaseUrl: string
  databaseUrlTest: string
  redisUrl: string
  jwtAccessTtlSeconds: number
  jwtRefreshTtlSeconds: number
  port: number
  privateKey: string
  publicKey: string
}

function repoRoot(): string {
  if (baseDir) return baseDir
  let dir = process.cwd()
  let rootCandidate = dir
  while (dir !== resolve(dir, '..')) {
    const pkgPath = join(dir, 'package.json')
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
        if (pkg.workspaces) {
          baseDir = dir
          return dir
        }
      } catch {
        // ignore parse error
      }
      rootCandidate = dir
    }
    dir = resolve(dir, '..')
  }
  return baseDir ?? rootCandidate
}

const stringEnv = (key: string, fallback: string): string => process.env[key] || fallback
const numberEnv = (key: string, fallback: number): number => {
  const value = Number(process.env[key])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

// Ephemeral development/test keypair, generated once per process. Production must provide real
// keys: inline PEM via JWT_PRIVATE_KEY/JWT_PUBLIC_KEY, or files under .secrets/.
let devKeyPair: { private: string; public: string } | undefined

function loadKey(kind: 'private' | 'public'): string {
  const inline = process.env[`JWT_${kind.toUpperCase()}_KEY`]
  if (inline) return inline

  const candidates = [
    join(repoRoot(), '.secrets', `jwt-${kind}.pem`),
    join(process.cwd(), '.secrets', `jwt-${kind}.pem`),
    resolve(__dirname, '../../..', '.secrets', `jwt-${kind}.pem`),
    resolve(__dirname, '../..', '.secrets', `jwt-${kind}.pem`),
  ]
  for (const file of candidates) {
    if (existsSync(file)) return readFileSync(file, 'utf8')
  }

  if (process.env.NODE_ENV !== 'production') {
    if (!devKeyPair) devKeyPair = randomKeyPair()
    return devKeyPair[kind]
  }
  throw new Error(
    `No JWT_${kind.toUpperCase()}_KEY and no jwt-${kind}.pem found in .secrets. Run scripts/generate-keys.sh, or set the key inline.`,
  )
}

export function getConfig(): AppConfig {
  loadEnv()
  return {
    baseDir: repoRoot(),
    databaseUrl: stringEnv('DATABASE_URL', 'postgres://homecare@127.0.0.1:5432/homecare'),
    databaseUrlTest: stringEnv('DATABASE_URL_TEST', 'postgres://homecare@127.0.0.1:5432/homecare_test'),
    redisUrl: stringEnv('REDIS_URL', 'redis://127.0.0.1:6379'),
    jwtAccessTtlSeconds: numberEnv('JWT_ACCESS_TTL_SECONDS', 900),
    jwtRefreshTtlSeconds: numberEnv('JWT_REFRESH_TTL_SECONDS', 2_592_000),
    port: numberEnv('PORT', 3000),
    privateKey: loadKey('private'),
    publicKey: loadKey('public'),
  }
}