import { type ErrorCode, httpStatusFor } from '@homecare/contracts'
import { HttpException } from '@nestjs/common'

export class AuthError extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super({ code, message }, httpStatusFor(code))
    this.name = 'AuthError'
  }
}