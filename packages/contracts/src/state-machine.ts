import { AppointmentStatus, RequestStatus } from './enums.js'

/**
 * State machines from docs/08-workflows.md § 2 and § 3.
 *
 * This is the heart of the system, so it lives in `contracts` rather than in the API: the mobile
 * app uses it to decide which buttons to enable, the admin dashboard uses it to render its action
 * menus, and the API uses it as the single authority. A client and server that disagree about
 * allowed transitions is a support ticket factory.
 *
 * An illegal transition is answered with `409 INVALID_STATE_TRANSITION` carrying the list of
 * currently allowed transitions, which is what makes these tables testable from the client side.
 */

export type Actor = 'CUSTOMER' | 'CAREGIVER' | 'DISPATCHER' | 'SYSTEM' | 'SUPER_ADMIN'

export interface Transition<From extends string, To extends string> {
  from: From
  to: To
  actor: readonly Actor[]
  /** Human-readable guard, surfaced to the dispatcher and used as the reason in tests. */
  guard: string
}

/**
 * Request lifecycle.
 *
 * OPEN QUESTION: docs/08-workflows.md § 2 states that once a request is `EN_ROUTE` or `IN_PROGRESS`
 * "a dispatcher must cancel with a reason", but the transition table in the same section only
 * lists `any pre-en-route -> CANCELLED`. Those two statements disagree, so this table follows the
 * table literally and no dispatcher cancellation exists after `EN_ROUTE`.
 *
 * That is the conservative reading, and it has a real operational consequence: if a patient is
 * hospitalised mid-visit there is no modelled way to cancel. Resolve before build. Tracked as a
 * question in docs/16-open-questions.md, not silently decided here.
 */
export const REQUEST_TRANSITIONS: readonly Transition<RequestStatus, RequestStatus>[] = [
  { from: RequestStatus.DRAFT, to: RequestStatus.SUBMITTED, actor: ['CUSTOMER'], guard: 'Required fields present; consent recorded; lead time satisfied' },
  { from: RequestStatus.SUBMITTED, to: RequestStatus.UNDER_REVIEW, actor: ['DISPATCHER', 'SUPER_ADMIN'], guard: 'Picker-up only' },
  { from: RequestStatus.SUBMITTED, to: RequestStatus.UNABLE_TO_FULFILL, actor: ['DISPATCHER', 'SUPER_ADMIN'], guard: 'Reason and alternatives required' },
  { from: RequestStatus.UNDER_REVIEW, to: RequestStatus.NEEDS_INFO, actor: ['DISPATCHER', 'SUPER_ADMIN'], guard: 'info_request non-empty' },
  { from: RequestStatus.NEEDS_INFO, to: RequestStatus.UNDER_REVIEW, actor: ['CUSTOMER'], guard: 'info_response non-empty' },
  { from: RequestStatus.UNDER_REVIEW, to: RequestStatus.APPROVED, actor: ['DISPATCHER', 'SUPER_ADMIN'], guard: 'Service active and caregiver capacity exists, or backlog accepted' },
  { from: RequestStatus.APPROVED, to: RequestStatus.ASSIGNED, actor: ['SYSTEM'], guard: 'At least one appointment ACCEPTED and none CANCELLED' },
  { from: RequestStatus.ASSIGNED, to: RequestStatus.CONFIRMED, actor: ['CUSTOMER', 'SYSTEM'], guard: 'Customer confirms, or auto-confirm after 2h' },
  { from: RequestStatus.CONFIRMED, to: RequestStatus.EN_ROUTE, actor: ['CAREGIVER', 'SYSTEM'], guard: 'Assignment accepted' },
  { from: RequestStatus.EN_ROUTE, to: RequestStatus.IN_PROGRESS, actor: ['CAREGIVER', 'SYSTEM'], guard: 'Arrival recorded; GPS within tolerance' },
  { from: RequestStatus.IN_PROGRESS, to: RequestStatus.COMPLETED, actor: ['CAREGIVER', 'SYSTEM'], guard: 'Visit record present or created in the same request' },
  { from: RequestStatus.COMPLETED, to: RequestStatus.CLOSED, actor: ['SYSTEM'], guard: 'Invoice issued and settled, or 30 days elapsed' },
  { from: RequestStatus.SUBMITTED, to: RequestStatus.CANCELLED, actor: ['CUSTOMER', 'DISPATCHER', 'SUPER_ADMIN', 'SYSTEM'], guard: 'Reason required; cancellation policy applied' },
  { from: RequestStatus.UNDER_REVIEW, to: RequestStatus.CANCELLED, actor: ['CUSTOMER', 'DISPATCHER', 'SUPER_ADMIN', 'SYSTEM'], guard: 'Reason required; cancellation policy applied' },
  { from: RequestStatus.NEEDS_INFO, to: RequestStatus.CANCELLED, actor: ['CUSTOMER', 'DISPATCHER', 'SUPER_ADMIN', 'SYSTEM'], guard: 'Reason required; cancellation policy applied' },
  { from: RequestStatus.APPROVED, to: RequestStatus.CANCELLED, actor: ['CUSTOMER', 'DISPATCHER', 'SUPER_ADMIN', 'SYSTEM'], guard: 'Reason required; cancellation policy applied' },
  { from: RequestStatus.ASSIGNED, to: RequestStatus.CANCELLED, actor: ['CUSTOMER', 'DISPATCHER', 'SUPER_ADMIN', 'SYSTEM'], guard: 'Reason required; cancellation policy applied' },
  { from: RequestStatus.CONFIRMED, to: RequestStatus.CANCELLED, actor: ['CUSTOMER', 'DISPATCHER', 'SUPER_ADMIN', 'SYSTEM'], guard: 'Reason required; cancellation policy applied' },
  { from: RequestStatus.DRAFT, to: RequestStatus.CANCELLED, actor: ['CUSTOMER', 'SYSTEM'], guard: 'Reason required' },
  { from: RequestStatus.UNABLE_TO_FULFILL, to: RequestStatus.SUBMITTED, actor: ['CUSTOMER'], guard: 'Customer selects an alternative' },
  { from: RequestStatus.UNABLE_TO_FULFILL, to: RequestStatus.CLOSED, actor: ['SYSTEM'], guard: 'After the alternative window' },
]

/** Appointment lifecycle. Offers race, so acceptance is a conditional update in the database. */
export const APPOINTMENT_TRANSITIONS: readonly Transition<AppointmentStatus, AppointmentStatus>[] = [
  { from: AppointmentStatus.PENDING, to: AppointmentStatus.OFFERED, actor: ['DISPATCHER', 'SUPER_ADMIN', 'SYSTEM'], guard: 'Caregiver eligible; availability covers the whole visit' },
  { from: AppointmentStatus.PENDING, to: AppointmentStatus.ACCEPTED, actor: ['DISPATCHER', 'SUPER_ADMIN'], guard: 'Direct assign mode' },
  { from: AppointmentStatus.OFFERED, to: AppointmentStatus.ACCEPTED, actor: ['CAREGIVER'], guard: 'expires_at > now(); no conflicting assignment; conditional update on status = OFFERED' },
  { from: AppointmentStatus.OFFERED, to: AppointmentStatus.DECLINED, actor: ['CAREGIVER'], guard: 'Decline reason required' },
  { from: AppointmentStatus.OFFERED, to: AppointmentStatus.EXPIRED, actor: ['SYSTEM'], guard: 'expires_at < now(); release sibling offers' },
  { from: AppointmentStatus.ACCEPTED, to: AppointmentStatus.EN_ROUTE, actor: ['CAREGIVER'], guard: 'None' },
  { from: AppointmentStatus.EN_ROUTE, to: AppointmentStatus.IN_PROGRESS, actor: ['CAREGIVER'], guard: 'Arrival recorded; GPS within 2km or override reason' },
  { from: AppointmentStatus.IN_PROGRESS, to: AppointmentStatus.COMPLETED, actor: ['CAREGIVER'], guard: 'Visit record submitted' },
  { from: AppointmentStatus.PENDING, to: AppointmentStatus.CANCELLED, actor: ['DISPATCHER', 'SUPER_ADMIN', 'SYSTEM'], guard: 'Reason; fee calculation; notification' },
  { from: AppointmentStatus.OFFERED, to: AppointmentStatus.CANCELLED, actor: ['DISPATCHER', 'SUPER_ADMIN', 'SYSTEM'], guard: 'Reason; fee calculation; notification' },
  { from: AppointmentStatus.ACCEPTED, to: AppointmentStatus.CANCELLED, actor: ['DISPATCHER', 'SUPER_ADMIN', 'SYSTEM'], guard: 'Reason; caregiver suspended or licence expired' },
  { from: AppointmentStatus.ACCEPTED, to: AppointmentStatus.NO_SHOW, actor: ['DISPATCHER', 'SUPER_ADMIN'], guard: 'Side recorded; 30-minute grace period elapsed' },
  { from: AppointmentStatus.PENDING, to: AppointmentStatus.UNABLE_TO_FULFILL, actor: ['DISPATCHER', 'SUPER_ADMIN'], guard: 'Reason; whole-series decision' },
  { from: AppointmentStatus.OFFERED, to: AppointmentStatus.UNABLE_TO_FULFILL, actor: ['DISPATCHER', 'SUPER_ADMIN'], guard: 'Reason; whole-series decision' },
  { from: AppointmentStatus.ACCEPTED, to: AppointmentStatus.UNABLE_TO_FULFILL, actor: ['DISPATCHER', 'SUPER_ADMIN'], guard: 'Reason; whole-series decision' },
]

/** Terminal states accept no further transitions. Enforced by `allowedTransitions` returning []. */
export const TERMINAL_REQUEST_STATUSES: readonly RequestStatus[] = [
  RequestStatus.CANCELLED,
  RequestStatus.CLOSED,
]

export const TERMINAL_APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  AppointmentStatus.COMPLETED,
  AppointmentStatus.CANCELLED,
  AppointmentStatus.DECLINED,
  AppointmentStatus.EXPIRED,
  AppointmentStatus.UNABLE_TO_FULFILL,
  AppointmentStatus.NO_SHOW,
]

function index<S extends string>(rows: readonly Transition<S, S>[]): Map<S, Transition<S, S>[]> {
  const map = new Map<S, Transition<S, S>[]>()
  for (const row of rows) {
    const bucket = map.get(row.from)
    if (bucket) bucket.push(row)
    else map.set(row.from, [row])
  }
  return map
}

const requestIndex = index(REQUEST_TRANSITIONS)
const appointmentIndex = index(APPOINTMENT_TRANSITIONS)

export function allowedRequestTransitions(
  from: RequestStatus,
  actor?: Actor,
): readonly Transition<RequestStatus, RequestStatus>[] {
  const all = requestIndex.get(from) ?? []
  return actor ? all.filter((t) => t.actor.includes(actor)) : all
}

export function allowedAppointmentTransitions(
  from: AppointmentStatus,
  actor?: Actor,
): readonly Transition<AppointmentStatus, AppointmentStatus>[] {
  const all = appointmentIndex.get(from) ?? []
  return actor ? all.filter((t) => t.actor.includes(actor)) : all
}

export function canTransitionRequest(from: RequestStatus, to: RequestStatus, actor: Actor): boolean {
  return (requestIndex.get(from) ?? []).some((t) => t.to === to && t.actor.includes(actor))
}

export function canTransitionAppointment(
  from: AppointmentStatus,
  to: AppointmentStatus,
  actor: Actor,
): boolean {
  return (appointmentIndex.get(from) ?? []).some((t) => t.to === to && t.actor.includes(actor))
}

/**
 * Convenience flags the UI needs constantly.
 *
 * `canCustomerCancelRequest` is the reason `CANCELLED` is repeated across seven request rows:
 * once a caregiver is en route or in the home, cancelling is a dispatcher decision because the
 * caregiver has already travelled.
 */
export function canCustomerCancelRequest(from: RequestStatus): boolean {
  return canTransitionRequest(from, RequestStatus.CANCELLED, 'CUSTOMER')
}

export function isTerminalRequest(status: RequestStatus): boolean {
  return TERMINAL_REQUEST_STATUSES.includes(status)
}

export function isTerminalAppointment(status: AppointmentStatus): boolean {
  return TERMINAL_APPOINTMENT_STATUSES.includes(status)
}