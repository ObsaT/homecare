import { describe, expect, it } from 'vitest'
import { AppointmentStatus } from './enums.js'
import {
  allowedAppointmentTransitions,
  allowedRequestTransitions,
  canCustomerCancelRequest,
  canTransitionAppointment,
  canTransitionRequest,
  isTerminalAppointment,
  isTerminalRequest,
  APPOINTMENT_TRANSITIONS,
  REQUEST_TRANSITIONS,
} from './state-machine.js'

/**
 * The state machine is the part of this system where a silent mistake causes real operational
 * damage: an illegal transition means a visit that nobody attends, a caregiver paid for nothing, or
 * a record that contradicts itself. These tests pin the behaviour in docs/08-workflows.md.
 */

describe('request state machine', () => {
  it('allows the customer to submit a draft but not to approve it', () => {
    expect(canTransitionRequest('DRAFT', 'SUBMITTED', 'CUSTOMER')).toBe(true)
    expect(canTransitionRequest('DRAFT', 'APPROVED', 'CUSTOMER')).toBe(false)
  })

  it('routes the happy path end to end', () => {
    const path: [string, string, 'CUSTOMER' | 'CAREGIVER' | 'DISPATCHER' | 'SYSTEM'][] = [
      ['DRAFT', 'SUBMITTED', 'CUSTOMER'],
      ['SUBMITTED', 'UNDER_REVIEW', 'DISPATCHER'],
      ['UNDER_REVIEW', 'APPROVED', 'DISPATCHER'],
      ['APPROVED', 'ASSIGNED', 'SYSTEM'],
      ['ASSIGNED', 'CONFIRMED', 'SYSTEM'],
      ['CONFIRMED', 'EN_ROUTE', 'SYSTEM'],
      ['EN_ROUTE', 'IN_PROGRESS', 'SYSTEM'],
      ['IN_PROGRESS', 'COMPLETED', 'SYSTEM'],
      ['COMPLETED', 'CLOSED', 'SYSTEM'],
    ]
    for (const [from, to, actor] of path) {
      expect(canTransitionRequest(from as never, to as never, actor), `${from} -> ${to}`).toBe(true)
    }
  })

  it('permits customer cancellation before the caregiver travels, and not after', () => {
    for (const status of ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFO', 'APPROVED', 'ASSIGNED', 'CONFIRMED']) {
      expect(canCustomerCancelRequest(status as never), status).toBe(true)
    }
    // Past this boundary the caregiver has already travelled, so a dispatcher must decide.
    expect(canCustomerCancelRequest('EN_ROUTE')).toBe(false)
    expect(canCustomerCancelRequest('IN_PROGRESS')).toBe(false)
  })

  it('has no modelled dispatcher cancellation after en route (open question in doc 08 § 2)', () => {
    // Encodes the literal transition table. See the note on REQUEST_TRANSITIONS: the spec prose
    // implies a dispatcher should be able to cancel here, and the table does not allow it.
    // This test is expected to change once that ambiguity is resolved.
    expect(canTransitionRequest('EN_ROUTE', 'CANCELLED', 'DISPATCHER')).toBe(false)
    expect(canTransitionRequest('IN_PROGRESS', 'CANCELLED', 'DISPATCHER')).toBe(false)
  })

  it('lets a customer return an unfulfillable request to submitted', () => {
    expect(canTransitionRequest('UNABLE_TO_FULFILL', 'SUBMITTED', 'CUSTOMER')).toBe(true)
  })

  it('has no way out of a terminal state', () => {
    expect(allowedRequestTransitions('CLOSED')).toEqual([])
    expect(allowedRequestTransitions('CANCELLED')).toEqual([])
    expect(isTerminalRequest('CLOSED')).toBe(true)
    expect(isTerminalRequest('COMPLETED')).toBe(false)
  })

  it('reports no duplicate from/to pairs', () => {
    const seen = new Set<string>()
    for (const t of REQUEST_TRANSITIONS) {
      const key = `${t.from}->${t.to}`
      expect(seen.has(key), `duplicate transition ${key}`).toBe(false)
      seen.add(key)
    }
  })

  it('gives every transition at least one actor and a guard note', () => {
    for (const t of REQUEST_TRANSITIONS) {
      expect(t.actor.length, `${t.from} -> ${t.to}`).toBeGreaterThan(0)
      expect(t.guard.length, `${t.from} -> ${t.to}`).toBeGreaterThan(0)
    }
  })
})

describe('appointment state machine', () => {
  it('only lets a caregiver accept their own offer', () => {
    expect(canTransitionAppointment('OFFERED', 'ACCEPTED', 'CAREGIVER')).toBe(true)
    expect(canTransitionAppointment('OFFERED', 'ACCEPTED', 'DISPATCHER')).toBe(false)
    expect(canTransitionAppointment('PENDING', 'ACCEPTED', 'DISPATCHER')).toBe(true)
  })

  it('does not let an offer be declined by a dispatcher', () => {
    expect(canTransitionAppointment('OFFERED', 'DECLINED', 'CAREGIVER')).toBe(true)
    expect(canTransitionAppointment('OFFERED', 'DECLINED', 'DISPATCHER')).toBe(false)
  })

  it('expires offers only via the system', () => {
    expect(canTransitionAppointment('OFFERED', 'EXPIRED', 'SYSTEM')).toBe(true)
    expect(canTransitionAppointment('OFFERED', 'EXPIRED', 'CAREGIVER')).toBe(false)
  })

  it('marks no-show only from ACCEPTED', () => {
    expect(canTransitionAppointment('ACCEPTED', 'NO_SHOW', 'DISPATCHER')).toBe(true)
    expect(canTransitionAppointment('EN_ROUTE', 'NO_SHOW', 'DISPATCHER')).toBe(false)
  })

  it('cannot complete a visit that has not started', () => {
    expect(canTransitionAppointment('ACCEPTED', 'COMPLETED', 'CAREGIVER')).toBe(false)
    expect(canTransitionAppointment('IN_PROGRESS', 'COMPLETED', 'CAREGIVER')).toBe(true)
  })

  it('treats completed, cancelled, expired and declined as terminal', () => {
    for (const status of [
      AppointmentStatus.COMPLETED,
      AppointmentStatus.CANCELLED,
      AppointmentStatus.DECLINED,
      AppointmentStatus.EXPIRED,
      AppointmentStatus.UNABLE_TO_FULFILL,
      AppointmentStatus.NO_SHOW,
    ]) {
      expect(isTerminalAppointment(status), status).toBe(true)
      expect(allowedAppointmentTransitions(status), status).toEqual([])
    }
  })

  it('filters transitions by actor for the dispatcher UI', () => {
    const dispatcher = allowedAppointmentTransitions(AppointmentStatus.OFFERED, 'DISPATCHER')
    expect(dispatcher.length).toBeGreaterThan(0)
    expect(dispatcher.every((t) => t.actor.includes('DISPATCHER'))).toBe(true)
    expect(dispatcher.map((t) => t.to)).not.toContain(AppointmentStatus.DECLINED)
  })

  it('cannot skip straight from PENDING to IN_PROGRESS', () => {
    expect(canTransitionAppointment('PENDING', 'IN_PROGRESS', 'SYSTEM')).toBe(false)
  })

  it('has no duplicate from/to pairs', () => {
    const seen = new Set<string>()
    for (const t of APPOINTMENT_TRANSITIONS) {
      const key = `${t.from}->${t.to}`
      expect(seen.has(key), `duplicate transition ${key}`).toBe(false)
      seen.add(key)
    }
  })
})