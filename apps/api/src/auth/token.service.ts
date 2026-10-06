import { Injectable } from '@nestjs/common'
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken'
import { getConfig } from '../config'
import { randomOpaqueToken, sha256Hex } from '../crypto/crypto'

export interface AccessTokenClaims {
  /** Subject — the user id. */
  sub: string
  /** Session id, attached to `sid`. */
  sid: string
  role: string
  /** Refresh-token family id. Present so revocation can be traced without a DB round trip. */
  family_id?: string
  jti: string
}

export interface VerifiedAccessToken {
  sub: string
  sid: string
  role: string
  jti: string
}

const ACCESS_ALGORITHM = 'RS256'

/**
 * Issues and verifies access tokens and refresh tokens.
 *
 * Access: RS256 JWT, 15 minutes, claims sub/role/sid/jti per docs/11-security.md § 4 — deliberately
 * no PHI. Refresh: opaque 256-bit token; only its sha256 is ever stored or looked up.
 */
@Injectable()
export class TokenService {
  readonly accessTtlSeconds: number
  private readonly refreshTtlSeconds: number
  private readonly privateKey: string
  private readonly publicKey: string

  constructor() {
    const config = getConfig()
    this.accessTtlSeconds = config.jwtAccessTtlSeconds
    this.refreshTtlSeconds = config.jwtRefreshTtlSeconds
    this.privateKey = config.privateKey
    this.publicKey = config.publicKey
  }

  /** The value that goes into auth.sessions.refresh_hash and lookup keys. */
  hashOf(refreshToken: string): string {
    return sha256Hex(refreshToken)
  }

  issueAccessToken(claims: AccessTokenClaims): string {
    const options: SignOptions = {
      algorithm: ACCESS_ALGORITHM,
      expiresIn: this.accessTtlSeconds,
      jwtid: claims.jti,
      subject: claims.sub,
    }
    const payload: Record<string, string> = { role: claims.role, sid: claims.sid }
    if (claims.family_id) payload.family_id = claims.family_id
    return jwt.sign(payload, this.privateKey, options)
  }

  /**
   * Verifies a bearer token and returns its claims. Throws AuthTokenError; the guard maps failures
   * to `401 UNAUTHENTICATED`. A malformed, expired, or unknown-signature token is the one fast path
   * in the auth flow that must not be confused with a wrong password.
   */
  verifyAccessToken(token: string): VerifiedAccessToken {
    let decoded: string | JwtPayload
    try {
      decoded = jwt.verify(token, this.publicKey, {
        algorithms: [ACCESS_ALGORITHM],
        issuer: undefined,
      })
    } catch {
      throw new AuthTokenError('Invalid access token')
    }
    if (typeof decoded === 'string') throw new AuthTokenError('Invalid access token')
    if (typeof decoded.sub !== 'string' || typeof decoded.sid !== 'string') {
      throw new AuthTokenError('Access token missing required claims')
    }
    return {
      sub: decoded.sub,
      sid: decoded.sid,
      role: typeof decoded.role === 'string' ? decoded.role : '',
      jti: typeof decoded.jti === 'string' ? decoded.jti : '',
    }
  }

  issueRefreshToken(): { token: string; hash: string } {
    const token = randomOpaqueToken()
    return { token, hash: sha256Hex(token) }
  }

  refreshExpiry(now = Date.now()): Date {
    return new Date(now + this.refreshTtlSeconds * 1000)
  }
}

export class AuthTokenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthTokenError'
  }
}