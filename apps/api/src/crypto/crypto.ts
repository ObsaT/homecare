import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'

/**
 * Small, dependency-free crypto helpers.
 *
 * Deliberately limited surface: the only primitives used here are what the documented features
 * actually need — RS256 signing (jose-free; uses jsonwebtoken at the service layer), opaque tokens,
 * scrypt passwords, and sha256 digests. Anything that touches PHI must go through the field-level
 * encryption layer in docs/11-security.md § 4, which is a separate module and not yet built.
 */

/** RS256 keypair for access-token signing. Development/test helper; keys also come from .secrets/. */
export function randomKeyPair(): { private: string; public: string } {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  return {
    public: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    private: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  }
}

/** Opaque token with 256 bits of entropy. Base64url keeps it URL-safe for headers and query strings. */
export function randomOpaqueToken(): string {
  return randomBytes(32).toString('base64url')
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const SCRYPT_LEN = 32

export type PasswordEntry = { salt: string; key: Buffer; params: [number, number, number] }

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const key = scryptSync(password, salt, SCRYPT_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P })
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${key.toString('base64')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, n, r, p, salt, keyB64] = parts
  const expected = Buffer.from(keyB64 as string, 'base64')
  const actual = scryptSync(password, salt as string, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  })
  return timingSafeEqual(actual, expected)
}