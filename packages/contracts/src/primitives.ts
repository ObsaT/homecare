import { z } from 'zod'

/**
 * Primitive value schemas shared across the API surface.
 *
 * These are the narrowest place to enforce the conventions in docs/07-api-contract.md § 0,
 * because every request body, response, and database column eventually routes through them.
 */

export const UUID = z.string().uuid()

/**
 * Ethiopian mobile numbers, normalised to E.164 without the `+` or spaces.
 *
 * Accepts the shapes users actually type (`0911234567`, `911234567`, `+251 911 234 567`,
 * `0025 911 234 567`) and rejects everything else. Returning a helpful message beats rejecting
 * silently on the client.
 *
 * A national mobile number is 9 digits beginning with 9 or 7, so the only accepted forms are:
 * `251XXXXXXXXX`, `0XXXXXXXXX`, or `XXXXXXXXX`.
 */
const ETHIOPIA_MOBILE_REGEX = /^251[79]\d{8}$/

function normaliseEthiopianPhone(value: string): string {
  let digits = value.replace(/[\s()-]/g, '')
  if (digits.startsWith('+')) digits = digits.slice(1)
  else if (digits.startsWith('00')) digits = digits.slice(2)

  // `0XXXXXXXXX` and bare `XXXXXXXXX` are national forms; prefix the country code.
  if (digits.startsWith('0')) digits = `251${digits.slice(1)}`
  else if (digits.length === 9 && (digits.startsWith('9') || digits.startsWith('7'))) {
    digits = `251${digits}`
  }
  return digits
}

export const PhoneE164 = z
  .string()
  .trim()
  .transform(normaliseEthiopianPhone)
  .refine((value) => ETHIOPIA_MOBILE_REGEX.test(value), {
    message: 'Enter a valid Ethiopian mobile number, for example 0911 234 567',
  })
  .refine((value) => ETHIOPIA_MOBILE_REGEX.test(value), {
    message: 'Enter a valid Ethiopian mobile number, for example 0911 234 567',
  })

/**
 * Money is always integer santim (ETB cents) in a field ending `_santim`.
 * Never a float, never a number with a fractional part. See docs/10-payments.md § 1.
 */
export const Santim = z
  .number()
  .int('Money must be an integer number of santim')
  .nonnegative('Money cannot be negative')
  .max(Number.MAX_SAFE_INTEGER)

/** Integer minutes. Durations are never floats anywhere in this system. */
export const Minutes = z.number().int().nonnegative().max(60 * 24 * 365)

/** ISO 8601 instant. Always UTC on the wire; the client renders Africa/Addis_Ababa. */
export const IsoDateTime = z.string().datetime({ offset: true })

/** Calendar date, `YYYY-MM-DD`, no time component. */
export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')

export const Latitude = z.number().min(-90).max(90)
export const Longitude = z.number().min(-180).max(180)

/** Addis Ababa bounding box. Rejects coordinates outside the metro area, which is almost always a typo. */
export const AddisLatitude = Latitude.refine((v) => v >= 8.9 && v <= 9.15, {
  message: 'Latitude is outside Addis Ababa',
})
export const AddisLongitude = Longitude.refine((v) => v >= 38.65 && v <= 39.1, {
  message: 'Longitude is outside Addis Ababa',
})