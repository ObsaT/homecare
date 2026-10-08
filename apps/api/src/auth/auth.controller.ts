import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import {
  ErrorCode,
  LoginSchema,
  OtpRequestSchema,
  OtpVerifySchema,
  RefreshSchema,
  RegisterCustomerSchema,
  httpStatusFor,
  type Login,
  type OtpRequest,
  type OtpVerify,
  type Refresh,
  type RegisterCustomer,
  type Session,
} from '@homecare/contracts'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { AuthService } from './auth.service'
import { AuthError } from './errors'
import { SessionService, type SessionContext } from './session.service'
import { RegistrationService } from './registration.service'
import { JwtAuthGuard, type AuthenticatedUser, type AuthenticatedRequest } from './jwt-auth.guard'
import { CurrentUser } from './current-user.decorator'
import { AuthTokenError } from './token.service'

function sessionContext(req: { headers?: Record<string, string | undefined>; ip?: string }): SessionContext {
  const forwarded = req.headers?.['x-forwarded-for']
  const ip = forwarded?.split(',')[0]?.trim() || req.ip || null
  const ua = req.headers?.['user-agent'] ?? null
  return { ip, userAgent: ua }
}

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(RegistrationService) private readonly registration: RegistrationService,
  ) {}

  /**
   * Issues an OTP challenge. Always the same status and body shape regardless of whether the phone
   * is registered (see the enumeration note on `AuthService`).
   */
  @Post('otp/request')
  @HttpCode(200)
  async requestOtp(
    @Body(ZodValidationPipe(OtpRequestSchema)) body: OtpRequest,
    @Req() req: { ip?: string; headers?: Record<string, string | undefined> },
  ): Promise<unknown> {
    try {
      return await this.auth.requestOtp(body, sessionContext(req).ip ?? 'unknown')
    } catch (error) {
      throw this.toHttp(error)
    }
  }

  /** Verified OTP -> session for registered numbers, REGISTER token for unknown ones. */
  @Post('otp/verify')
  @HttpCode(200)
  async verifyOtp(
    @Body(ZodValidationPipe(OtpVerifySchema)) body: OtpVerify,
    @Req() req: AuthenticatedRequest,
  ): Promise<unknown> {
    try {
      const result = await this.auth.verifyForSession(body, sessionContext(req))
      return result.kind === 'session' ? result.session : result.register
    } catch (error) {
      throw this.toHttp(error)
    }
  }

  /** Registers a customer account with its first session. */
  @Post('register/customer')
  @HttpCode(201)
  async registerCustomer(
    @Body() body: any,
    @Req() req: AuthenticatedRequest,
  ): Promise<unknown> {
    try {
      return await this.registration.registerCustomer(body, sessionContext(req))
    } catch (error) {
      throw this.toHttp(error)
    }
  }

  /** Registers a caregiver account, records Telebirr onboarding fee payment, and initializes caregiver profile. */
  @Post('register/caregiver')
  @HttpCode(201)
  async registerCaregiver(
    @Body() body: any,
    @Req() req: AuthenticatedRequest,
  ): Promise<unknown> {
    try {
      return await this.registration.registerCaregiver(body, sessionContext(req))
    } catch (error) {
      throw this.toHttp(error)
    }
  }


  @Post('login')
  @HttpCode(200)
  async login(
    @Body(ZodValidationPipe(LoginSchema)) body: Login,
    @Req() req: AuthenticatedRequest,
  ): Promise<Session> {
    try {
      return await this.auth.login(body, sessionContext(req))
    } catch (error) {
      throw this.toHttp(error)
    }
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Body(ZodValidationPipe(RefreshSchema)) body: Refresh,
    @Req() req: AuthenticatedRequest,
  ): Promise<Session> {
    try {
      const session = await this.sessions.rotate(body.refresh_token, sessionContext(req))
      return { ...session, is_new_user: false }
    } catch (error) {
      throw this.toHttp(error)
    }
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: AuthenticatedUser | null): Promise<void> {
    try {
      if (user) await this.sessions.logout(user.sid)
    } catch (error) {
      throw this.toHttp(error)
    }
  }

  @Post('logout-all')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async logoutAll(@CurrentUser() user: AuthenticatedUser | null): Promise<void> {
    try {
      if (user) await this.sessions.logoutAll(user.id)
    } catch (error) {
      throw this.toHttp(error)
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthenticatedUser | null): Promise<unknown> {
    try {
      if (!user) throw new AuthError(ErrorCode.UNAUTHENTICATED, 'Sign in to continue')
      return await this.sessions.me(user.id)
    } catch (error) {
      throw this.toHttp(error)
    }
  }

  private toHttp(error: unknown): HttpException {
    if (error instanceof AuthError) {
      return new HttpException({ code: error.code, message: error.message }, httpStatusFor(error.code))
    }
    if (error instanceof AuthTokenError) {
      return new HttpException(
        { code: ErrorCode.UNAUTHENTICATED, message: 'Your session has expired. Sign in again.' },
        401,
      )
    }
    return error as HttpException
  }
}