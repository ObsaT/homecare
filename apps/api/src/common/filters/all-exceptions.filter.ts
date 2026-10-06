import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { type ApiErrorBody, ErrorCode, httpStatusFor } from '@homecare/contracts'
import { amharicMessageFor } from '../amharic-messages'

/**
 * Single exit point for every error, producing the envelope in docs/07-api-contract.md § 0.
 *
 * The security property worth stating plainly: **no unexpected error ever leaks internals**. A
 * 500 returns a generic message and a `request_id`; the stack trace stays in the server log, where
 * support can correlate it via that same request id. A care platform holding health data should
 * assume its error messages will be read by someone who should not have the details.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp()
    const request = http.getRequest<Request & { requestId?: string }>()
    const response = http.getResponse<Response>()
    const requestId = request.requestId ?? 'unknown'

    const { status, code, message, fields, meta } = this.describe(exception, request.url)

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status} ${code}`,
        exception instanceof Error ? exception.stack : String(exception),
      )
    }

    const body: ApiErrorBody = {
      error: {
        code,
        message,
        message_am: amharicMessageFor(code),
        ...(fields ? { fields } : {}),
        ...(meta ? { meta } : {}),
        request_id: requestId,
      },
    }
    response.status(status).json(body)
  }

  private describe(
    exception: unknown,
    url: string,
  ): {
    status: number
    code: ErrorCode
    message: string
    fields?: Record<string, string>
    meta?: Record<string, unknown>
  } {
    if (isZodErrorLike(exception)) {
      return {
        status: httpStatusFor(ErrorCode.VALIDATION_ERROR),
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Some fields need attention',
        fields: fieldErrorsFromZod(exception),
      }
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const payload = exception.getResponse()

      if (typeof payload === 'string') {
        return { status, code: codeForStatus(status), message: payload }
      }

      const record = payload as Record<string, unknown>
      const code = typeof record.code === 'string' ? (record.code as ErrorCode) : codeForStatus(status)
      const message = typeof record.message === 'string' ? record.message : exception.message
      const meta = typeof record.meta === 'object' && record.meta !== null
        ? (record.meta as Record<string, unknown>)
        : undefined
      const fields = typeof record.fields === 'object' && record.fields !== null
        ? (record.fields as Record<string, string>)
        : undefined

      return { status, code, message, ...(fields ? { fields } : {}), ...(meta ? { meta } : {}) }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      message:
        'Something went wrong on our side. Quote the reference below when contacting support.',
      meta: { url },
    }
  }
}

/**
 * Validation failures are reported per field path so the client can attach the message to the
 * right input rather than showing one banner for the whole form.
 *
 * Nested paths are joined with dots (`patient.medications.0.route`), and repeated failures on one
 * field are joined into a single message. A caregiver typing into a phone form should never be
 * shown three separate errors for one input.
 */

type ZodIssueLike = { path: Array<string | number | symbol>; message: string }

/**
 * True for anything that looks like a zod error.
 *
 * This is deliberately not `instanceof ZodError`. `@homecare/contracts` is an ESM package, so its
 * `schema.parse()` throws errors created by zod's ESM build, while this filter (CommonJS) resolves
 * `require('zod')` to the CJS build. They are two different `ZodError` classes, so `instanceof`
 * silently fails and every validation error becomes a 500 INTERNAL_ERROR. That failure only appears
 * under real `node dist/main.js` — vitest resolves a single zod copy, which is why the e2e suffix
 * used to pass while production was broken.
 */
export function isZodErrorLike(value: unknown): value is { issues: ZodIssueLike[] } {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { constructor?: { name?: string }; issues?: unknown }
  return candidate.constructor?.name === 'ZodError' && Array.isArray(candidate.issues)
}

export function fieldErrorsFromZod(error: { issues: ZodIssueLike[] }): Record<string, string> {
  const grouped = new Map<string, string[]>()
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_root'
    const messages = grouped.get(key)
    if (messages) messages.push(issue.message)
    else grouped.set(key, [issue.message])
  }
  return Object.fromEntries([...grouped].map(([key, messages]) => [key, [...new Set(messages)].join(' ')]))
}

function codeForStatus(status: number): ErrorCode {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return ErrorCode.VALIDATION_ERROR
    case HttpStatus.UNAUTHORIZED:
      return ErrorCode.UNAUTHENTICATED
    case HttpStatus.FORBIDDEN:
      return ErrorCode.FORBIDDEN
    case HttpStatus.NOT_FOUND:
      return ErrorCode.NOT_FOUND
    case HttpStatus.CONFLICT:
      return ErrorCode.CONFLICT
    case HttpStatus.PAYLOAD_TOO_LARGE:
      return ErrorCode.PAYLOAD_TOO_LARGE
    case HttpStatus.TOO_MANY_REQUESTS:
      return ErrorCode.RATE_LIMITED
    default:
      return status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.VALIDATION_ERROR
  }
}