import { z } from 'zod'
import {
  ConsentType,
  ConsentTypeSchema,
  LanguageSchema,
  OtpPurposeSchema,
  UserRoleSchema,
} from './enums.js'
import { AddisLatitude, AddisLongitude, IsoDateTime, PhoneE164, UUID } from './primitives.js'
import { REQUIRED_CONSENT_TYPES } from './enums.js'

/**
 * Auth and registration schemas from docs/07-api-contract.md § 1.
 */

export const OtpRequestSchema = z.object({
  phone_e164: PhoneE164,
  purpose: OtpPurposeSchema,
})
export type OtpRequest = z.infer<typeof OtpRequestSchema>

export const OtpRequestResponseSchema = z.object({
  challenge_id: UUID,
  expires_at: IsoDateTime,
  resend_after_seconds: z.number().int().positive(),
})
export type OtpRequestResponse = z.infer<typeof OtpRequestResponseSchema>

export const OtpVerifySchema = z.object({
  challenge_id: UUID,
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
})
export type OtpVerify = z.infer<typeof OtpVerifySchema>

export const SessionUserSchema = z.object({
  id: UUID,
  role: UserRoleSchema,
  status: z.string(),
  full_name: z.string(),
})
export type SessionUser = z.infer<typeof SessionUserSchema>

export const SessionSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  /** Seconds. 900 = 15 minutes, per the access-token policy. */
  expires_in: z.number().int().positive(),
  user: SessionUserSchema,
  is_new_user: z.boolean(),
})
export type Session = z.infer<typeof SessionSchema>

/**
 * Response for a verified OTP on an unregistered phone (docs/07-api-contract.md § POST
 * /auth/otp/verify). Scope is REGISTER only — the token cannot open any other endpoint, which is
 * what keeps the verify endpoint from leaking whether a phone has an account.
 */
export const RegistrationTokenSchema = z.object({
  is_new_user: z.literal(true),
  register_token: z.string().min(1),
  /** Seconds until the registration token expires. */
  expires_in: z.number().int().positive(),
})
export type RegistrationToken = z.infer<typeof RegistrationTokenSchema>

/**
 * Password policy. Minimum 10 characters, rejected if it is one of the 20 commonest passwords.
 * Strength is reported by the client for the meter; the server only enforces pass/fail.
 */
export const PASSWORD_MIN_LENGTH = 10

export const PasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(200, 'Password is too long')

export const COMMON_PASSWORDS = [
  'password123',
  'password1234',
  'password12345',
  'qwerty12345',
  '1234567890',
  '12345678901',
  'addisababa123',
  'addisababa1234',
  'ethiopia12345',
  'abebebekele123',
  'sarabekele12345',
  'welcome12345',
  'iloveyou1234',
  'sunshine12345',
  'princess1234',
  'football1234',
  'letmein12345',
  'monkey123456',
  'dragon123456',
  'trustno12345',
] as const

export const StrongPasswordSchema = PasswordSchema.refine(
  (value) => !COMMON_PASSWORDS.includes(value.toLowerCase() as (typeof COMMON_PASSWORDS)[number]),
  { message: 'This password is too common. Choose something less predictable.' },
)

export const AddressSchema = z.object({
  label: z.string().min(1).max(60),
  sub_city_id: UUID,
  woreda: z.string().min(1).max(10),
  kebele: z.string().min(1).max(10),
  house_number: z.string().min(1).max(120),
  landmark: z.string().max(200).optional(),
  latitude: AddisLatitude.optional(),
  longitude: AddisLongitude.optional(),
  access_notes: z.string().max(500).optional(),
})
export type Address = z.infer<typeof AddressSchema>

/**
 * Address coordinates are optional and stored as `geo_precision = 'NONE'` when absent.
 * See docs/06-data-model.md § 4 on not storing precise location for patients who do not want it.
 */
export function addressGeoPrecision(
  address: Pick<Address, 'latitude' | 'longitude'>,
): 'PIN' | 'CENTROID' | 'NONE' {
  if (address.latitude !== undefined && address.longitude !== undefined) return 'PIN'
  return 'NONE'
}

export const EmergencyContactSchema = z.object({
  full_name: z.string().min(2).max(100),
  phone_e164: PhoneE164,
  relationship: z.string().min(2).max(40),
})
export type EmergencyContact = z.infer<typeof EmergencyContactSchema>

export const ConsentSchema = z.object({
  type: ConsentTypeSchema,
  version: z.string().min(1).max(20),
  granted: z.boolean(),
})
export type Consent = z.infer<typeof ConsentSchema>

/**
 * Registration enforces that every required consent is present *and* granted.
 *
 * This is a hard failure rather than a warning: without health-data processing consent the
 * platform cannot lawfully hold a clinical record, so a partially consented account is not a valid
 * state to persist.
 */
export function missingRequiredConsents(consents: readonly Consent[]): ConsentType[] {
  const granted = new Set(
    consents.filter((c) => c.granted).map((c) => c.type as ConsentType),
  )
  return REQUIRED_CONSENT_TYPES.filter((required) => !granted.has(required))
}

export const RegisterCustomerSchema = z
  .object({
    register_token: z.string().min(1),
    full_name: z.string().min(2).max(100),
    email: z.string().email().max(254).optional(),
    password: StrongPasswordSchema,
    preferred_language: LanguageSchema,
    address: AddressSchema,
    emergency_contact: EmergencyContactSchema,
    consents: z.array(ConsentSchema).min(1),
  })
  .superRefine((value, ctx) => {
    const missing = missingRequiredConsents(value.consents)
    for (const type of missing) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['consents'],
        message:
          type === ConsentType.HEALTH_DATA_PROCESSING
            ? 'You must consent to processing health data in order to book care'
            : `You must agree to the ${type.toLowerCase().replace('_', ' ')} to continue`,
      })
    }
  })
export type RegisterCustomer = z.infer<typeof RegisterCustomerSchema>

export const LoginSchema = z.object({
  phone_e164: PhoneE164,
  password: PasswordSchema,
})
export type Login = z.infer<typeof LoginSchema>

export const RefreshSchema = z.object({
  refresh_token: z.string().min(1),
})
export type Refresh = z.infer<typeof RefreshSchema>

export const RegisterDeviceSchema = z.object({
  platform: z.enum(['android', 'ios']),
  fcm_token: z.string().min(10),
  device_model: z.string().max(120).optional(),
  app_version: z.string().regex(/^\d+\.\d+\.\d+/),
})
export type RegisterDevice = z.infer<typeof RegisterDeviceSchema>

export const ChangePasswordSchema = z.object({
  current_password: PasswordSchema,
  new_password: StrongPasswordSchema,
})
export type ChangePassword = z.infer<typeof ChangePasswordSchema>

export const UpdateProfileSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  email: z.string().email().max(254).optional(),
  preferred_language: LanguageSchema.optional(),
})
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>