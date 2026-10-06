import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common'
import { ErrorCode } from '@homecare/contracts'
import { UsersRepository } from '../db/users.repository'
import { TokenService, AuthTokenError } from './token.service'
import { AuthError } from './errors'

export interface AuthenticatedUser {
  id: string
  role: string
  sid: string
}

export interface AuthenticatedRequest {
  user: AuthenticatedUser
  headers: { authorization?: string }
  ip?: string
}

/**
 * Bearer-token guard. Any endpoint that needs the logged-in identity applies `@UseGuards` and the
 * `@CurrentUser()` decorator; the guard also re-checks that the account is active on *every* request,
 * so a suspension takes effect at the next call rather than at token expiry.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(UsersRepository) private readonly users: UsersRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const header = request.headers?.authorization
    if (!header?.startsWith('Bearer ')) {
      throw new AuthError(ErrorCode.UNAUTHENTICATED, 'Sign in to continue')
    }

    let claims: { sub: string; sid: string; role: string }
    try {
      claims = this.tokens.verifyAccessToken(header.slice('Bearer '.length))
    } catch (error) {
      if (error instanceof AuthTokenError) {
        throw new AuthError(ErrorCode.UNAUTHENTICATED, 'Your session has expired. Sign in again.')
      }
      throw error
    }

    const user = await this.users.findSessionUser(claims.sub)
    if (!user) {
      throw new AuthError(ErrorCode.UNAUTHENTICATED, 'This account is no longer active')
    }

    request.user = { id: user.id, role: user.role, sid: claims.sid }
    return true
  }
}