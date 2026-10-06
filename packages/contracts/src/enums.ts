import { z } from 'zod'

/**
 * Enums mirroring the PostgreSQL enum types in docs/06-data-model.md.
 *
 * Rule: every enum value must exist in both places. If you change a value here, change the
 * `create type` statement in the migration too, and check the notification event keys in
 * docs/09-notifications.md and the state machines in docs/08-workflows.md.
 */

export const UserRole = {
  CUSTOMER: 'CUSTOMER',
  CAREGIVER: 'CAREGIVER',
  DISPATCHER: 'DISPATCHER',
  ADMIN: 'ADMIN',
  FINANCE: 'FINANCE',
  CLINICAL_SUPERVISOR: 'CLINICAL_SUPERVISOR',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const
export const UserRoleSchema = z.enum([
  UserRole.CUSTOMER,
  UserRole.CAREGIVER,
  UserRole.DISPATCHER,
  UserRole.ADMIN,
  UserRole.FINANCE,
  UserRole.CLINICAL_SUPERVISOR,
  UserRole.SUPER_ADMIN,
])
export type UserRole = z.infer<typeof UserRoleSchema>

export const AccountStatus = {
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  DEACTIVATED: 'DEACTIVATED',
  CLOSED: 'CLOSED',
} as const
export const AccountStatusSchema = z.enum([
  AccountStatus.PENDING_VERIFICATION,
  AccountStatus.ACTIVE,
  AccountStatus.SUSPENDED,
  AccountStatus.DEACTIVATED,
  AccountStatus.CLOSED,
])
export type AccountStatus = z.infer<typeof AccountStatusSchema>

export const OtpPurpose = {
  REGISTER: 'REGISTER',
  LOGIN: 'LOGIN',
  VERIFY_PHONE: 'VERIFY_PHONE',
  RESET_PASSWORD: 'RESET_PASSWORD',
  ARRIVAL_CODE: 'ARRIVAL_CODE',
} as const
export const OtpPurposeSchema = z.enum([
  OtpPurpose.REGISTER,
  OtpPurpose.LOGIN,
  OtpPurpose.VERIFY_PHONE,
  OtpPurpose.RESET_PASSWORD,
  OtpPurpose.ARRIVAL_CODE,
])
export type OtpPurpose = z.infer<typeof OtpPurposeSchema>

/**
 * `HEALTH_DATA_PROCESSING` is deliberately a distinct consent type, never bundled into
 * `TERMS`. Bundling health-data consent into general terms is the pattern regulators object to.
 * See docs/03-customer-app-spec.md C4 Step 2.
 */
export const ConsentType = {
  TERMS: 'TERMS',
  PRIVACY: 'PRIVACY',
  HEALTH_DATA_PROCESSING: 'HEALTH_DATA_PROCESSING',
  MARKETING: 'MARKETING',
  PHOTO_SHARING: 'PHOTO_SHARING',
  CAREGIVER_RESPONSE: 'CAREGIVER_RESPONSE',
} as const
export const ConsentTypeSchema = z.enum([
  ConsentType.TERMS,
  ConsentType.PRIVACY,
  ConsentType.HEALTH_DATA_PROCESSING,
  ConsentType.MARKETING,
  ConsentType.PHOTO_SHARING,
  ConsentType.CAREGIVER_RESPONSE,
])
export type ConsentType = z.infer<typeof ConsentTypeSchema>

/** Consents a customer must grant to complete registration. */
export const REQUIRED_CONSENT_TYPES = [
  ConsentType.TERMS,
  ConsentType.PRIVACY,
  ConsentType.HEALTH_DATA_PROCESSING,
] as const satisfies readonly ConsentType[]

export const ServiceCode = {
  NURSING: 'NURSING',
  ELDERLY: 'ELDERLY',
  POST_HOSPITAL: 'POST_HOSPITAL',
  WOUND_CARE: 'WOUND_CARE',
  MEDICATION: 'MEDICATION',
  PERSONAL_CARE: 'PERSONAL_CARE',
  FEEDING: 'FEEDING',
  VITALS: 'VITALS',
  PHYSIOTHERAPY: 'PHYSIOTHERAPY',
  OTHER: 'OTHER',
  // Aliases for compatibility
  INJECTION: 'INJECTION',
  VITAL_CHECKS: 'VITAL_CHECKS',
  CATHETER: 'CATHETER',
  POST_OP: 'POST_OP',
  PHYSIO: 'PHYSIO',
  PALLIATIVE: 'PALLIATIVE',
  BATHING: 'BATHING',
  MEAL_PREP: 'MEAL_PREP',
  MOBILITY: 'MOBILITY',
  COMPANIONSHIP: 'COMPANIONSHIP',
} as const
export const ServiceCodeSchema = z.enum([
  ServiceCode.NURSING,
  ServiceCode.ELDERLY,
  ServiceCode.POST_HOSPITAL,
  ServiceCode.WOUND_CARE,
  ServiceCode.MEDICATION,
  ServiceCode.PERSONAL_CARE,
  ServiceCode.FEEDING,
  ServiceCode.VITALS,
  ServiceCode.PHYSIOTHERAPY,
  ServiceCode.OTHER,
  ServiceCode.INJECTION,
  ServiceCode.VITAL_CHECKS,
  ServiceCode.CATHETER,
  ServiceCode.POST_OP,
  ServiceCode.PHYSIO,
  ServiceCode.PALLIATIVE,
  ServiceCode.BATHING,
  ServiceCode.MEAL_PREP,
  ServiceCode.MOBILITY,
  ServiceCode.COMPANIONSHIP,
])
export type ServiceCode = z.infer<typeof ServiceCodeSchema>

/**
 * Services that count as clinical. Only these are eligible to appear in a `clinical.visit_records`
 * context, only these require a care checklist, and only these may be gated behind a licence check.
 * See docs/11-security.md § 7 on restricting clinical surfaces.
 */
export const CLINICAL_SERVICE_CODES = [
  ServiceCode.NURSING,
  ServiceCode.POST_HOSPITAL,
  ServiceCode.WOUND_CARE,
  ServiceCode.MEDICATION,
  ServiceCode.VITALS,
  ServiceCode.PHYSIOTHERAPY,
  ServiceCode.INJECTION,
  ServiceCode.VITAL_CHECKS,
  ServiceCode.CATHETER,
  ServiceCode.POST_OP,
  ServiceCode.PHYSIO,
  ServiceCode.PALLIATIVE,
] as const satisfies readonly ServiceCode[]

export const BillingUnit = {
  PER_VISIT: 'PER_VISIT',
  PER_HOUR: 'PER_HOUR',
  PER_DAY: 'PER_DAY',
  PER_SESSION: 'PER_SESSION',
} as const
export const BillingUnitSchema = z.enum([
  BillingUnit.PER_VISIT,
  BillingUnit.PER_HOUR,
  BillingUnit.PER_DAY,
  BillingUnit.PER_SESSION,
])
export type BillingUnit = z.infer<typeof BillingUnitSchema>

export const Urgency = {
  ROUTINE: 'ROUTINE',
  URGENT_24H: 'URGENT_24H',
  URGENT_TODAY: 'URGENT_TODAY',
} as const
export const UrgencySchema = z.enum([
  Urgency.ROUTINE,
  Urgency.URGENT_24H,
  Urgency.URGENT_TODAY,
])
export type Urgency = z.infer<typeof UrgencySchema>

export const RecurrenceFreq = {
  NONE: 'NONE',
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  BIWEEKLY: 'BIWEEKLY',
  MONTHLY: 'MONTHLY',
} as const
export const RecurrenceFreqSchema = z.enum([
  RecurrenceFreq.NONE,
  RecurrenceFreq.DAILY,
  RecurrenceFreq.WEEKLY,
  RecurrenceFreq.BIWEEKLY,
  RecurrenceFreq.MONTHLY,
])
export type RecurrenceFreq = z.infer<typeof RecurrenceFreqSchema>

export const RequestStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  NEEDS_INFO: 'NEEDS_INFO',
  APPROVED: 'APPROVED',
  ASSIGNED: 'ASSIGNED',
  CONFIRMED: 'CONFIRMED',
  EN_ROUTE: 'EN_ROUTE',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  UNABLE_TO_FULFILL: 'UNABLE_TO_FULFILL',
  CANCELLED: 'CANCELLED',
  CLOSED: 'CLOSED',
} as const
export const RequestStatusSchema = z.enum([
  RequestStatus.DRAFT,
  RequestStatus.SUBMITTED,
  RequestStatus.UNDER_REVIEW,
  RequestStatus.NEEDS_INFO,
  RequestStatus.APPROVED,
  RequestStatus.ASSIGNED,
  RequestStatus.CONFIRMED,
  RequestStatus.EN_ROUTE,
  RequestStatus.IN_PROGRESS,
  RequestStatus.COMPLETED,
  RequestStatus.UNABLE_TO_FULFILL,
  RequestStatus.CANCELLED,
  RequestStatus.CLOSED,
])
export type RequestStatus = z.infer<typeof RequestStatusSchema>

export const AppointmentStatus = {
  PENDING: 'PENDING',
  OFFERED: 'OFFERED',
  ACCEPTED: 'ACCEPTED',
  EN_ROUTE: 'EN_ROUTE',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  DECLINED: 'DECLINED',
  NO_SHOW: 'NO_SHOW',
  UNABLE_TO_FULFILL: 'UNABLE_TO_FULFILL',
  EXPIRED: 'EXPIRED',
} as const
export const AppointmentStatusSchema = z.enum([
  AppointmentStatus.PENDING,
  AppointmentStatus.OFFERED,
  AppointmentStatus.ACCEPTED,
  AppointmentStatus.EN_ROUTE,
  AppointmentStatus.IN_PROGRESS,
  AppointmentStatus.COMPLETED,
  AppointmentStatus.CANCELLED,
  AppointmentStatus.DECLINED,
  AppointmentStatus.NO_SHOW,
  AppointmentStatus.UNABLE_TO_FULFILL,
  AppointmentStatus.EXPIRED,
])
export type AppointmentStatus = z.infer<typeof AppointmentStatusSchema>

export const AssignmentStatus = {
  OFFERED: 'OFFERED',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
  REASSIGNED: 'REASSIGNED',
  AUTO_CANCELLED: 'AUTO_CANCELLED',
} as const
export const AssignmentStatusSchema = z.enum([
  AssignmentStatus.OFFERED,
  AssignmentStatus.ACCEPTED,
  AssignmentStatus.DECLINED,
  AssignmentStatus.EXPIRED,
  AssignmentStatus.REVOKED,
  AssignmentStatus.REASSIGNED,
  AssignmentStatus.AUTO_CANCELLED,
])
export type AssignmentStatus = z.infer<typeof AssignmentStatusSchema>

export const DeclineReason = {
  TOO_FAR: 'TOO_FAR',
  NOT_AVAILABLE: 'NOT_AVAILABLE',
  NOT_QUALIFIED: 'NOT_QUALIFIED',
  PERSONAL: 'PERSONAL',
  PATIENT_CONFLICT: 'PATIENT_CONFLICT',
  OTHER: 'OTHER',
} as const
export const DeclineReasonSchema = z.enum([
  DeclineReason.TOO_FAR,
  DeclineReason.NOT_AVAILABLE,
  DeclineReason.NOT_QUALIFIED,
  DeclineReason.PERSONAL,
  DeclineReason.PATIENT_CONFLICT,
  DeclineReason.OTHER,
])
export type DeclineReason = z.infer<typeof DeclineReasonSchema>

export const PaymentMethod = {
  CASH: 'CASH',
  BANK_TRANSFER: 'BANK_TRANSFER',
  TELEBIRR: 'TELEBIRR',
  CBE_BIRR: 'CBE_BIRR',
  CARD: 'CARD',
  CHEQUE: 'CHEQUE',
  OTHER: 'OTHER',
} as const
export const PaymentMethodSchema = z.enum([
  PaymentMethod.CASH,
  PaymentMethod.BANK_TRANSFER,
  PaymentMethod.TELEBIRR,
  PaymentMethod.CBE_BIRR,
  PaymentMethod.CARD,
  PaymentMethod.CHEQUE,
  PaymentMethod.OTHER,
])
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>

export const PaymentStatus = {
  CLAIMED: 'CLAIMED',
  PENDING_CONFIRMATION: 'PENDING_CONFIRMATION',
  CONFIRMED: 'CONFIRMED',
  FAILED: 'FAILED',
  REVERSED: 'REVERSED',
} as const
export const PaymentStatusSchema = z.enum([
  PaymentStatus.CLAIMED,
  PaymentStatus.PENDING_CONFIRMATION,
  PaymentStatus.CONFIRMED,
  PaymentStatus.FAILED,
  PaymentStatus.REVERSED,
])
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>

export const InvoiceStatus = {
  DRAFT: 'DRAFT',
  ISSUED: 'ISSUED',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  VOID: 'VOID',
  DISPUTED: 'DISPUTED',
  REFUNDED: 'REFUNDED',
} as const
export const InvoiceStatusSchema = z.enum([
  InvoiceStatus.DRAFT,
  InvoiceStatus.ISSUED,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.PAID,
  InvoiceStatus.OVERDUE,
  InvoiceStatus.VOID,
  InvoiceStatus.DISPUTED,
  InvoiceStatus.REFUNDED,
])
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>

export const IncidentSeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const
export const IncidentSeveritySchema = z.enum([
  IncidentSeverity.LOW,
  IncidentSeverity.MEDIUM,
  IncidentSeverity.HIGH,
  IncidentSeverity.CRITICAL,
])
export type IncidentSeverity = z.infer<typeof IncidentSeveritySchema>

export const Language = {
  EN: 'en',
  AM: 'am',
} as const
export const LanguageSchema = z.enum([Language.EN, Language.AM])
export type Language = z.infer<typeof LanguageSchema>