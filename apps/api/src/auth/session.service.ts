import { Inject, Injectable } from '@nestjs/common'
import { ErrorCode, type SessionUser } from '@homecare/contracts'
import { randomUUID } from 'node:crypto'
import { SessionsRepository, SESSION_REVOKE } from '../db/sessions.repository'
import { UsersRepository, type SessionUser as DbSessionUser } from '../db/users.repository'
import { TokenService } from './token.service'
import { AuthError } from './errors'

export interface SessionContext {
  ip: string | null
  userAgent: string | null
}

/** Access + refresh + user, minus `is_new_user`, which is a property of the request not the pair. */
export interface IssuedSession {
  access_token: string
  refresh_token: string
  /** Seconds until the access token expires. */
  expires_in: number
  user: SessionUser
  family_id: string
}

/**
 * Issues, rotates, and revokes sessions against auth.sessions.
 *
 * Rotation policy (docs/07-api-contract.md § 1, docs/11-security.md § 4):
 *  - every refresh-token use closes the current row (rotated_at) and opens a new one in the same
 *    family, with a brand-new refresh token;
 *  - presenting a token whose row was rotated is treated as theft: the whole family is revoked and
 *    `TOKEN_REUSE_DETECTED` is returned, because the original token should be in exactly one place;
 *  - presenting a revoked token (deliberate logout) is a plain 401, not a theft signal.
 */
@Injectable()
export class SessionService {
  constructor(
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(SessionsRepository) private readonly sessions: SessionsRepository,
    @Inject(UsersRepository) private readonly users: UsersRepository,
  ) {}

  async issue(
    user: DbSessionUser,
    context: SessionContext,
  ): Promise<IssuedSession> {
    const familyId = randomUUID()
    const refresh = this.tokens.issueRefreshToken()
    const issuedAt = Date.now()
    const row = await this.sessions.insert({
      userId: user.id,
      refreshHash: refresh.hash,
      familyId,
      expiresAt: this.tokens.refreshExpiry(issuedAt),
      userAgent: context.userAgent,
      ip: context.ip,
    })
    return this.buildIssue(user, refresh.token, familyId, row.id)
  }

  /**
   * Rotates a refresh token. `TOKEN_REUSE_DETECTED` when a rotated token is presented again; the
   * family is revoked first so every other device in it is logged out too.
   */
  async rotate(refreshToken: string, context: SessionContext): Promise<IssuedSession> {
    const row = await this.sessions.findByRefreshHash(this.tokens.hashOf(refreshToken))
    if (!row) throw new AuthError(ErrorCode.UNAUTHENTICATED, 'This session is no longer valid')
    if (row.rotated_at !== null) {
      await this.sessions.revokeFamily(row.family_id, SESSION_REVOKE.REUSE_DETECTED)
      throw new AuthError(
        ErrorCode.TOKEN_REUSE_DETECTED,
        'This session may have been copied. Sign in again with a fresh OTP.',
      )
    }
    if (row.revoked_at !== null) {
      throw new AuthError(ErrorCode.UNAUTHENTICATED, 'This session has been logged out')
    }
    if (row.expires_at.getTime() <= Date.now()) {
      throw new AuthError(ErrorCode.UNAUTHENTICATED, 'This session has expired')
    }

    const user = await this.users.findSessionUser(row.user_id)
    if (!user) throw new AuthError(ErrorCode.UNAUTHENTICATED, 'This account is no longer active')

    await this.sessions.markRotated(row.id)
    const refresh = this.tokens.issueRefreshToken()
    const issuedAt = Date.now()
    const next = await this.sessions.insert({
      userId: user.id,
      refreshHash: refresh.hash,
      familyId: row.family_id,
      expiresAt: this.tokens.refreshExpiry(issuedAt),
      userAgent: context.userAgent,
      ip: context.ip,
    })
    return this.buildIssue(user, refresh.token, row.family_id, next.id)
  }

  /** Revokes one session (logout). The sid is bound to the access token, so no user check needed. */
  async logout(sessionId: string): Promise<void> {
    await this.sessions.revoke(sessionId, SESSION_REVOKE.LOGOUT)
  }

  /** Revokes every open session (logout-all). */
  async logoutAll(userId: string): Promise<void> {
    await this.sessions.revokeUserSessions(userId, SESSION_REVOKE.LOGOUT_ALL)
  }

  /** Current profile for an authenticated user; 401 once the account is suspended or closed. */
  async me(userId: string): Promise<SessionUser> {
    const user = await this.users.findSessionUser(userId)
    if (!user) throw new AuthError(ErrorCode.UNAUTHENTICATED, 'This account is no longer active')
    return { id: user.id, role: user.role as SessionUser['role'], status: user.status, full_name: user.full_name }
  }

  private buildIssue(
    user: DbSessionUser,
    refreshToken: string,
    familyId: string,
    sessionId: string,
  ): IssuedSession {
    const accessToken = this.tokens.issueAccessToken({
      sub: user.id,
      sid: sessionId,
      role: user.role,
      jti: randomUUID(),
      family_id: familyId,
    })
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: this.tokens.accessTtlSeconds,
      user: { id: user.id, role: user.role as SessionUser['role'], status: user.status, full_name: user.full_name },
      family_id: familyId,
    }
  }
}