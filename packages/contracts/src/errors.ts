import { z } from 'zod'

/**
 * Error codes and their HTTP status mapping, from docs/07-api-contract.md § 0.
 *
 * `NOT_FOUND` deliberately covers "does not exist" *and* "out of scope for this actor". Returning
 * 403 for a record that belongs to another customer would confirm it exists, which is an
 * enumeration leak. See docs/11-security.md § 6.
 */

export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  RATE_LIMITED: 'RATE_LIMITED',
  LICENSE_EXPIRED: 'LICENSE_EXPIRED',
  PHI_ACCESS_DENIED: 'PHI_ACCESS_DENIED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  /** Caregiver is registered but not yet approved. Every caregiver endpoint 403s with this. */
  ACCOUNT_PENDING: 'ACCOUNT_PENDING',
  /** A rotated refresh token was replayed; the whole family is revoked. */
  TOKEN_REUSE_DETECTED: 'TOKEN_REUSE_DETECTED',
  /** Another caregiver won the assignment race. `meta` carries the winner's first name only. */
  APPOINTMENT_ALREADY_ASSIGNED: 'APPOINTMENT_ALREADY_ASSIGNED',
  OTP_INVALID: 'OTP_INVALID',
  OTP_LOCKED: 'OTP_LOCKED',
} as const

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

const HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_STATE_TRANSITION: 409,
  RATE_LIMITED: 429,
  LICENSE_EXPIRED: 403,
  PHI_ACCESS_DENIED: 403,
  PAYLOAD_TOO_LARGE: 413,
  INTERNAL_ERROR: 500,
  ACCOUNT_PENDING: 403,
  TOKEN_REUSE_DETECTED: 401,
  APPOINTMENT_ALREADY_ASSIGNED: 409,
  OTP_INVALID: 400,
  OTP_LOCKED: 429,
}

export function httpStatusFor(code: ErrorCode): number {
  return HTTP_STATUS[code]
}

export const ApiErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    message_am: z.string().optional(),
    fields: z.record(z.string(), z.string()).optional(),
    /** Populated for CONFLICT and INVALID_STATE_TRANSITION. */
    meta: z.record(z.string(), z.unknown()).optional(),
    request_id: z.string(),
  }),
})
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>

/** Cursor pagination envelope from docs/07-api-contract.md § 0. */
export const PageInfoSchema = z.object({
  next_cursor: z.string().nullable(),
  has_more: z.boolean(),
  limit: z.number().int().positive(),
})
export type PageInfo = z.infer<typeof PageInfoSchema>

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ data: z.array(item), page: PageInfoSchema })