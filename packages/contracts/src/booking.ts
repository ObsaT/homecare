import { z } from 'zod'
import { RecurrenceFreqSchema, ServiceCodeSchema, UrgencySchema } from './enums.js'
import {
  AddisLatitude,
  AddisLongitude,
  IsoDateTime,
  Minutes,
  PhoneE164,
  Santim,
  UUID,
} from './primitives.js'

/**
 * Request booking and appointment schemas from docs/07-api-contract.md § 2.
 *
 * Clinical fields live in the request body only and must never appear in a URL or query string.
 * There is no schema here that can be serialised into a path parameter, which is the point.
 */

export const PatientSchema = z.object({
  full_name: z.string().min(2).max(100),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED']),
  /** Free text, deliberately not an enum: home care does not fit a fixed mobility taxonomy well. */
  mobility_notes: z.string().max(500).optional(),
  allergies: z.array(z.string().max(80)).max(30).default([]),
  doctor_name: z.string().max(120).optional(),
  doctor_phone: PhoneE164.optional(),
  medications: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        route: z.enum(['ORAL', 'TOPICAL', 'IV', 'IM', 'SUBCUTANEOUS', 'INHALED', 'RECTAL', 'OTHER']),
        frequency: z.string().max(80).optional(),
      }),
    )
    .max(50)
    .default([]),
})
export type Patient = z.infer<typeof PatientSchema>

export const BookingWindowSchema = z
  .object({
    start: IsoDateTime,
    /** Optional exact end. When absent the duration is used instead. */
    end: IsoDateTime.optional(),
    duration_minutes: Minutes.min(30).max(60 * 24 * 14).optional(),
  })
  .refine((w) => (w.end === undefined) !== (w.duration_minutes === undefined), {
    message: 'Provide either an end time or a duration',
  })
export type BookingWindow = z.infer<typeof BookingWindowSchema>

export const CreateRequestSchema = z.object({
  service_code: ServiceCodeSchema,
  patient: PatientSchema,
  sub_city_id: UUID,
  address_id: UUID,
  windows: z.array(BookingWindowSchema).min(1).max(5),
  duration_minutes: Minutes.min(30).max(60 * 24 * 14),
  urgency: UrgencySchema,
  recurrence: z
    .object({
      freq: RecurrenceFreqSchema,
      /** Up to 52 occurrences. Beyond a year of scheduled care, re-book instead. */
      count: z.number().int().min(2).max(52),
    })
    .optional(),
  notes: z.string().max(2000).optional(),
  latitude: AddisLatitude.optional(),
  longitude: AddisLongitude.optional(),
  /** Required at submission, not at draft. */
  authorised: z.boolean().default(false),
})

export type CreateRequest = z.infer<typeof CreateRequestSchema>

export const CancelReasonSchema = z.enum([
  'CUSTOMER_CANCELLED',
  'CUSTOMER_NO_LONGER_NEEDS',
  'CAREGIVER_UNAVAILABLE',
  'CAREGIVER_NO_SHOW',
  'DISPATCHER_REASSIGNMENT',
  'PATIENT_HOSPITALISED',
  'UNABLE_TO_FULFILL',
  'WEATHER',
  'OTHER',
])

export const CancelRequestSchema = z.object({
  reason: CancelReasonSchema,
  explanation: z.string().max(500).optional(),
  /** When true, cancels every future occurrence in the series. */
  whole_series: z.boolean().default(true),
})
export type CancelRequest = z.infer<typeof CancelRequestSchema>

export const QuoteLineSchema = z.object({
  label: z.string(),
  amount_santim: Santim,
  explanation: z.object({ en: z.string(), am: z.string() }),
})
export type QuoteLine = z.infer<typeof QuoteLineSchema>

export const QuoteSchema = z.object({
  id: UUID,
  subtotal_santim: Santim,
  surcharge_santim: Santim,
  discount_santim: Santim,
  total_santim: Santim,
  lines: z.array(QuoteLineSchema),
  /** A quote before assignment is an estimate and must be labelled as one in the UI. */
  is_estimate: z.boolean(),
  valid_until: IsoDateTime,
})
export type Quote = z.infer<typeof QuoteSchema>

/**
 * Offer to a caregiver. `expires_at` is computed from the offer window: 90 minutes for a same-day
 * visit, 4 hours otherwise. See docs/08-workflows.md § 4.
 */
export const OFFER_WINDOW_SAME_DAY_MINUTES = 90
export const OFFER_WINDOW_LATER_MINUTES = 240

export const RespondToOfferSchema = z.object({
  accept: z.boolean(),
  /** Required when declining; the engine uses it to improve future suggestions. */
  decline_reason: z.enum([
    'TOO_FAR',
    'NOT_AVAILABLE',
    'NOT_QUALIFIED',
    'PERSONAL',
    'PATIENT_CONFLICT',
    'OTHER',
  ]).optional(),
  decline_note: z.string().max(500).optional(),
})
export type RespondToOffer = z.infer<typeof RespondToOfferSchema>

export const ArrivalCodeVerifySchema = z.object({
  appointment_id: UUID,
  code: z.string().regex(/^\d{4}$/, 'Enter the 4-digit code'),
})
export type ArrivalCodeVerify = z.infer<typeof ArrivalCodeVerifySchema>

export const VitalsSchema = z.object({
  temperature_c: z.number().min(30).max(45).optional(),
  pulse_bpm: z.number().int().min(20).max(300).optional(),
  systolic_bp: z.number().int().min(50).max(300).optional(),
  diastolic_bp: z.number().int().min(30).max(200).optional(),
  respiratory_rate: z.number().int().min(5).max(80).optional(),
  spo2_pct: z.number().int().min(50).max(100).optional(),
  blood_sugar_mmol: z.number().min(0).max(50).optional(),
})
export type Vitals = z.infer<typeof VitalsSchema>

/**
 * Vital ranges that flag a reading for clinical review.
 *
 * These thresholds are configuration, not law, and they are placeholders pending the clinical
 * supervisor's sign-off. See docs/16-open-questions.md CL4. They live here so the client can show
 * a warning before submission, but the server treats a flagged reading as advisory rather than a
 * hard validation failure, because refusing to record an out-of-range reading is worse than
 * recording it and alerting a clinician.
 */
export const VITAL_FLAG_RANGES = {
  temperature_c: { low: 35.0, high: 38.0 },
  pulse_bpm: { low: 50, high: 120 },
  systolic_bp: { low: 90, high: 180 },
  diastolic_bp: { low: 60, high: 110 },
  spo2_pct: { low: 92, high: 100 },
} as const satisfies Partial<Record<keyof Vitals, { low: number; high: number }>>

export function flaggedVitals(vitals: Vitals): (keyof Vitals)[] {
  return (Object.keys(VITAL_FLAG_RANGES) as (keyof typeof VITAL_FLAG_RANGES)[]).filter((field) => {
    const value = vitals[field]
    if (value === undefined) return false
    const range = VITAL_FLAG_RANGES[field]
    return value < range.low || value > range.high
  })
}

/** Arrival is trusted when the caregiver is within this distance of the address. */
export const ARRIVAL_GPS_TOLERANCE_KM = 2

/** The 30-minute grace period before a missed appointment may be marked NO_SHOW. */
export const NO_SHOW_GRACE_MINUTES = 30

/** Caregivers have this long to correct their own visit record before it is append-only. */
export const VISIT_RECORD_AMENDMENT_WINDOW_HOURS = 24

export function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLon = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}