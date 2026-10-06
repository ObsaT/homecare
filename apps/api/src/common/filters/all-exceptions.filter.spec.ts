import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { ZodError } from 'zod'
import { fieldErrorsFromZod, isZodErrorLike } from './all-exceptions.filter'
import { CreateRequestSchema, RegisterCustomerSchema } from '@homecare/contracts'

/**
 * Field-level error grouping is what lets the client attach a message to the right input instead of
 * showing one banner for a six-step form. Nested and repeated failures are where this goes wrong.
 */
describe('fieldErrorsFromZod', () => {
  it('groups a failure by its dotted path', () => {
    const result = RegisterCustomerSchema.safeParse({ full_name: 'A' })
    expect(result.success).toBe(false)
    if (result.success) return
    const fields = fieldErrorsFromZod(result.error as ZodError)
    expect(Object.keys(fields)).toContain('full_name')
  })

  it('uses a root key when the failure has no path', () => {
    const error = new ZodError([{ code: 'custom', path: [], message: 'Something is wrong' }])
    expect(fieldErrorsFromZod(error)).toEqual({ _root: 'Something is wrong' })
  })

  it('joins nested paths with dots so the client can address the field', () => {
    const result = CreateRequestSchema.safeParse({})
    expect(result.success).toBe(false)
    if (result.success) return
    const fields = fieldErrorsFromZod(result.error as ZodError)
    expect(Object.keys(fields)).toContain('windows')
  })

  it('collapses repeated failures on one field into a single message', () => {
    const error = new ZodError([
      { code: 'custom', path: ['password'], message: 'Too short' },
      { code: 'custom', path: ['password'], message: 'Too short' },
      { code: 'custom', path: ['password'], message: 'Too common' },
    ])
    expect(fieldErrorsFromZod(error)).toEqual({ password: 'Too short Too common' })
  })

  it('returns an empty object for a schema that passes', () => {
    expect(fieldErrorsFromZod(new ZodError([]))).toEqual({})
  })
})

describe('isZodErrorLike', () => {
  it('recognises the ESM ZodError this module imports', () => {
    const error = new ZodError([])
    expect(isZodErrorLike(error)).toBe(true)
  })

  /**
   * The regression this exists for: @homecare/contracts is ESM, so its `schema.parse()` throws an
   * error from zod's ESM build, while this CJS-compiled filter resolves `require('zod')` to the CJS
   * build. `instanceof ZodError` silently fails across the two, and every invalid field became a 500.
   * This constructs a CJS-build ZodError from inside an ESM vitest file — the same two-builds-in-one
   * process as production — and asserts the duck-type check catches it.
   */
  it('recognises a ZodError from the other build (dual-package hazard)', () => {
    const require = createRequire(process.cwd())
    const cjsZod: typeof import('zod') = require('zod')
    const cjsError = new cjsZod.ZodError([])
    const esmZodError = new ZodError([])
    expect(cjsZod.ZodError).not.toBe(esmZodError.constructor)
    expect(cjsError instanceof esmZodError.constructor).toBe(false)
    expect(isZodErrorLike(cjsError)).toBe(true)
  })

  it('rejects non-zod objects', () => {
    expect(isZodErrorLike(new Error('boom'))).toBe(false)
    expect(isZodErrorLike(null)).toBe(false)
    expect(isZodErrorLike('ZodError')).toBe(false)
    expect(isZodErrorLike({ constructor: { name: 'ZodError' } })).toBe(false)
  })

  it('produces field errors from a cross-build error', () => {
    const require = createRequire(process.cwd())
    const cjsZod: typeof import('zod') = require('zod')
    const cjsError = new cjsZod.ZodError([
      { code: 'custom', path: ['phone_e164'], message: 'Invalid number' },
    ])
    expect(fieldErrorsFromZod(cjsError)).toEqual({ phone_e164: 'Invalid number' })
  })
})