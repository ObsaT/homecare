import { describe, expect, it } from 'vitest'
import {
  AddressSchema,
  COMMON_PASSWORDS,
  OtpVerifySchema,
  RegisterCustomerSchema,
  StrongPasswordSchema,
  missingRequiredConsents,
} from './auth.js'
import { ConsentType, ConsentTypeSchema } from './enums.js'
import { BookingWindowSchema, CreateRequestSchema, flaggedVitals, haversineKm } from './booking.js'
import { AddisLatitude, AddisLongitude, PhoneE164, Santim } from './primitives.js'

const UUID_A = '3f1a0e6a-1b2c-4d5e-8f90-1234567890ab'

describe('PhoneE164', () => {
  it('normalises the shapes an Ethiopian user actually types', () => {
    const expected = '251911234567'
    const inputs = [
      '0911234567',
      '0911 234 567',
      '911234567',
      '+251911234567',
      '+251 911 234 567',
      '251911234567',
      '00251911234567',
      '(0911) 234-567',
    ]
    for (const input of inputs) {
      expect(PhoneE164.parse(input), input).toBe(expected)
    }
  })

  it('rejects numbers that are not Ethiopian mobiles', () => {
    const inputs = [
      '0811234567',
      '251811234567',
      '09112345678',
      '91123456',
      '',
      'not-a-number',
      '+12025550143',
    ]
    for (const input of inputs) {
      expect(PhoneE164.safeParse(input).success, input).toBe(false)
    }
  })
})

describe('Santim', () => {
  it('rejects floats, because money is never fractional', () => {
    expect(Santim.safeParse(150050).success).toBe(true)
    expect(Santim.safeParse(1500.5).success).toBe(false)
    expect(Santim.safeParse('150050').success).toBe(false)
  })

  it('rejects negative money', () => {
    expect(Santim.safeParse(-1).success).toBe(false)
  })
})

describe('Addis coordinates', () => {
  it('accepts central Addis Ababa', () => {
    expect(AddisLatitude.safeParse(9.0192).success).toBe(true)
    expect(AddisLongitude.safeParse(38.7525).success).toBe(true)
  })

  it('rejects coordinates outside the metro area', () => {
    expect(AddisLatitude.safeParse(11.59).success).toBe(false)
    expect(AddisLongitude.safeParse(-74.0).success).toBe(false)
  })
})

describe('StrongPasswordSchema', () => {
  it('requires at least 10 characters', () => {
    expect(StrongPasswordSchema.safeParse('short1!').success).toBe(false)
    expect(StrongPasswordSchema.safeParse('a-long-enough-passphrase').success).toBe(true)
  })

  it('rejects the commonest passwords regardless of length', () => {
    for (const password of COMMON_PASSWORDS) {
      expect(StrongPasswordSchema.safeParse(password).success, password).toBe(false)
    }
  })
})

describe('OtpVerifySchema', () => {
  it('requires exactly 6 digits', () => {
    expect(OtpVerifySchema.safeParse({ challenge_id: UUID_A, code: '123456' }).success).toBe(true)
    expect(OtpVerifySchema.safeParse({ challenge_id: UUID_A, code: '12345' }).success).toBe(false)
    expect(OtpVerifySchema.safeParse({ challenge_id: UUID_A, code: '1234567' }).success).toBe(false)
    expect(OtpVerifySchema.safeParse({ challenge_id: UUID_A, code: 'abcdef' }).success).toBe(false)
  })
})

describe('AddressSchema', () => {
  const valid = {
    label: 'Home',
    sub_city_id: UUID_A,
    woreda: '03',
    kebele: '11',
    house_number: 'Bldg 4, Apt 202',
    landmark: 'Across from St. Joseph Cathedral',
    latitude: 9.0192,
    longitude: 38.7525,
  }

  it('accepts a complete address', () => {
    expect(AddressSchema.safeParse(valid).success).toBe(true)
  })

  it('treats coordinates as optional so patients can opt out of location storage', () => {
    const { latitude: _lat, longitude: _lon, ...withoutCoords } = valid
    expect(AddressSchema.safeParse(withoutCoords).success).toBe(true)
  })
})

describe('consent enforcement', () => {
  const base = {
    register_token: 'tok',
    full_name: 'Abebe Bekele',
    password: 'a-long-enough-passphrase',
    preferred_language: 'am' as const,
    address: {
      label: 'Home',
      sub_city_id: UUID_A,
      woreda: '03',
      kebele: '11',
      house_number: 'Bldg 4',
    },
    emergency_contact: {
      full_name: 'Sara Bekele',
      phone_e164: '0911112233',
      relationship: 'Daughter',
    },
  }

  const allConsents = [
    { type: ConsentType.TERMS, version: '1.0', granted: true },
    { type: ConsentType.PRIVACY, version: '1.0', granted: true },
    { type: ConsentType.HEALTH_DATA_PROCESSING, version: '1.0', granted: true },
  ]

  it('accepts a fully consented registration', () => {
    expect(RegisterCustomerSchema.safeParse({ ...base, consents: allConsents }).success).toBe(true)
  })

  it('rejects registration without health-data consent', () => {
    const consents = allConsents.filter((c) => c.type !== ConsentType.HEALTH_DATA_PROCESSING)
    const result = RegisterCustomerSchema.safeParse({ ...base, consents })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.toLowerCase().includes('health data'))).toBe(
        true,
      )
    }
  })

  it('rejects a consent that is present but not granted', () => {
    const consents = allConsents.map((c) =>
      c.type === ConsentType.PRIVACY ? { ...c, granted: false } : c,
    )
    expect(RegisterCustomerSchema.safeParse({ ...base, consents }).success).toBe(false)
  })

  it('does not accept a granted marketing consent in place of health-data consent', () => {
    const consents = [
      ...allConsents.filter((c) => c.type !== ConsentType.HEALTH_DATA_PROCESSING),
      { type: ConsentType.MARKETING, version: '1.0', granted: true },
    ]
    expect(RegisterCustomerSchema.safeParse({ ...base, consents }).success).toBe(false)
  })

  it('lists exactly the missing required types', () => {
    expect(missingRequiredConsents([])).toEqual([
      ConsentType.TERMS,
      ConsentType.PRIVACY,
      ConsentType.HEALTH_DATA_PROCESSING,
    ])
    expect(missingRequiredConsents(allConsents)).toEqual([])
  })

  it('does not require optional consents', () => {
    const consents = [
      ...allConsents,
      { type: ConsentType.MARKETING, version: '1.0', granted: false },
      { type: ConsentType.PHOTO_SHARING, version: '1.0', granted: false },
    ]
    expect(missingRequiredConsents(consents)).toEqual([])
  })

  it('uses the shared consent enum so the API and the database cannot drift', () => {
    for (const type of [ConsentType.TERMS, ConsentType.HEALTH_DATA_PROCESSING]) {
      expect(ConsentTypeSchema.safeParse(type).success).toBe(true)
    }
    expect(ConsentTypeSchema.safeParse('NOT_A_CONSENT').success).toBe(false)
  })
})

describe('BookingWindowSchema', () => {
  const start = '2026-10-06T09:00:00Z'

  it('accepts either an end time or a duration, but not both and not neither', () => {
    expect(BookingWindowSchema.safeParse({ start, duration_minutes: 120 }).success).toBe(true)
    expect(BookingWindowSchema.safeParse({ start, end: '2026-10-06T11:00:00Z' }).success).toBe(true)
    expect(BookingWindowSchema.safeParse({ start }).success).toBe(false)
    expect(
      BookingWindowSchema.safeParse({ start, end: '2026-10-06T11:00:00Z', duration_minutes: 120 })
        .success,
    ).toBe(false)
  })
})

describe('CreateRequestSchema', () => {
  const base = {
    service_code: 'WOUND_CARE',
    patient: {
      full_name: 'Almaz Tadesse',
      date_of_birth: '1958-04-12',
      gender: 'FEMALE' as const,
    },
    sub_city_id: UUID_A,
    address_id: UUID_A,
    windows: [{ start: '2026-10-06T09:00:00Z', duration_minutes: 120 }],
    duration_minutes: 120,
    urgency: 'URGENT_24H' as const,
    authorised: true,
  }

  it('accepts a well-formed booking', () => {
    expect(CreateRequestSchema.safeParse(base).success).toBe(true)
  })

  it('defaults allergies and medications to empty arrays', () => {
    const result = CreateRequestSchema.safeParse(base)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.patient.allergies).toEqual([])
      expect(result.data.patient.medications).toEqual([])
    }
  })

  it('requires a duration of at least 30 minutes', () => {
    expect(CreateRequestSchema.safeParse({ ...base, duration_minutes: 15 }).success).toBe(false)
  })

  it('caps a recurring series at 52 occurrences', () => {
    expect(
      CreateRequestSchema.safeParse({
        ...base,
        recurrence: { freq: 'WEEKLY', count: 53 },
      }).success,
    ).toBe(false)
    expect(
      CreateRequestSchema.safeParse({ ...base, recurrence: { freq: 'WEEKLY', count: 52 } })
        .success,
    ).toBe(true)
  })

  it('rejects a clinical value that has been placed in a coordinate field', () => {
    // Coordinates are typed as numbers; a stray diagnosis string must not pass.
    expect(
      CreateRequestSchema.safeParse({ ...base, latitude: 'diabetes type 2' }).success,
    ).toBe(false)
  })
})

describe('flaggedVitals', () => {
  it('flags readings outside the configured range', () => {
    expect(flaggedVitals({ temperature_c: 39.2 })).toContain('temperature_c')
    expect(flaggedVitals({ spo2_pct: 88 })).toContain('spo2_pct')
  })

  it('does not flag normal readings', () => {
    expect(flaggedVitals({ temperature_c: 36.8, pulse_bpm: 72, spo2_pct: 98 })).toEqual([])
  })

  it('ignores fields that were not recorded', () => {
    expect(flaggedVitals({})).toEqual([])
  })
})

describe('haversineKm', () => {
  it('measures the real distance across Addis Ababa', () => {
    // Cathedral to Mercato is roughly 2 km.
    const km = haversineKm(
      { latitude: 9.0192, longitude: 38.7525 },
      { latitude: 9.0330, longitude: 38.7570 },
    )
    expect(km).toBeGreaterThan(1.5)
    expect(km).toBeLessThan(2.5)
  })

  it('returns zero for identical points', () => {
    expect(haversineKm({ latitude: 9.0, longitude: 38.75 }, { latitude: 9.0, longitude: 38.75 })).toBe(0)
  })
})