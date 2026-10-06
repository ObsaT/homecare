import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

export const REQUEST_ID_HEADER = 'x-request-id'
export const MAX_REQUEST_ID_LENGTH = 64

/**
 * Assigns `X-Request-Id` to every request, per docs/07-api-contract.md § 0.
 *
 * This is middleware rather than an interceptor for one concrete reason: interceptors only run for
 * *matched* routes, so a 404 from an unmatched URL would carry neither the response header nor the
 * id in the error body. That is exactly the request you most want to correlate when a client reports
 * "it says not found". Middleware runs for every request that reaches Express.
 *
 * An inbound `X-Request-Id` is echoed so a trace spans gateway, API, and mobile client, but it is
 * not trusted blindly: the value is length-capped and restricted to printable ASCII, because it is
 * written into logs and error bodies and a caller must not be able to inject newlines into a log
 * line or grow a header without bound.
 */
export function requestIdMiddleware(
  request: Request & { requestId?: string },
  response: Response,
  next: NextFunction,
): void {
  const inbound = request.headers[REQUEST_ID_HEADER]
  const candidate = Array.isArray(inbound) ? inbound[0] : inbound
  const requestId =
    typeof candidate === 'string' && isSafeRequestId(candidate) ? candidate : randomUUID()

  request.requestId = requestId
  response.setHeader('X-Request-Id', requestId)
  next()
}

export function isSafeRequestId(value: string): boolean {
  if (value.length === 0 || value.length > MAX_REQUEST_ID_LENGTH) return false
  // Printable ASCII only. Anything else is either a log-injection attempt or a client bug.
  return /^[\x20-\x7e]+$/.test(value)
}