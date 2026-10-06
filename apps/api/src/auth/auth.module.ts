import { Module } from '@nestjs/common'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { OtpChallengeStore } from './otp-challenge.store'
import { SmsProvider } from './sms.provider'
import { TokenService } from './token.service'
import { SessionService } from './session.service'
import { RegistrationService } from './registration.service'
import { UsersRepository } from '../db/users.repository'
import { SessionsRepository } from '../db/sessions.repository'
import { RedisRateLimiter } from '../redis/rate-limiter'
import { JwtAuthGuard } from './jwt-auth.guard'

/**
 * Every provider used by the auth surface, listed explicitly: DbModule and RedisModule are declared
 * @Global in app.module, so the pool and Redis handles land here without an import edge.
 */
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpChallengeStore,
    SmsProvider,
    TokenService,
    SessionService,
    RegistrationService,
    UsersRepository,
    SessionsRepository,
    RedisRateLimiter,
    JwtAuthGuard,
  ],
  exports: [TokenService, UsersRepository, JwtAuthGuard],
})
export class AuthModule {}