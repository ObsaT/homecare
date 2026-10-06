/**
 * Design tokens, mirroring docs/12-design-and-wireframes.md.
 *
 * These live in a package rather than in the admin app because both surfaces need identical values,
 * and a colour that differs between the dashboard and the caregiver app reads as a bug to a customer
 * looking at two screens from the same company.
 *
 * `packages/design-tokens` is exported as JSON for the web apps and mirrored into a Dart file for
 * Flutter via `scripts/export-tokens.ts`. Keeping one source and a generated copy is the only way
 * they stay in step; maintaining two by hand is how a 44px tap target quietly becomes 40px in one app.
 */

export const colors = {
  surface: {
    page: '#FFFFFF',
    pageMuted: '#F7F8F7',
    raised: '#FFFFFF',
    sunken: '#F1F3F2',
    inverse: '#151A19',
  },
  text: {
    primary: '#151A19',
    secondary: '#5A6360',
    tertiary: '#8A928F',
    onDark: '#FFFFFF',
    onDarkSecondary: '#B4BCB9',
  },
  border: {
    subtle: '#E6E9E8',
    strong: '#C9CFCD',
  },
  brand: {
    primary: '#0F6B5C',
    primaryHover: '#0B5749',
    primaryPressed: '#084338',
    onPrimary: '#FFFFFF',
    accent: '#C2703B',
  },
  status: {
    draft: '#8A928F',
    pending: '#B4791F',
    offered: '#1F6FB2',
    confirmed: '#0F6B5C',
    inProgress: '#0F6B5C',
    completed: '#4A7C59',
    cancelled: '#8C2F2F',
    declined: '#8C2F2F',
    expired: '#8A928F',
    noShow: '#8C2F2F',
    unableToFulfill: '#8C2F2F',
    closed: '#5A6360',
  },
  feedback: {
    info: '#1F6FB2',
    infoSoft: '#E7F0F7',
    success: '#4A7C59',
    successSoft: '#E8F1EA',
    warning: '#B4791F',
    warningSoft: '#FBF2E2',
    danger: '#8C2F2F',
    dangerSoft: '#F8E9E9',
  },
  critical: '#8C2F2F',
} as const

/**
 * 4-point scale, matching docs/12-design-and-wireframes.md § 2.
 *
 * There is deliberately no 2px step: a half-step value is always a sign that a gap was tuned by eye
 * somewhere, and it makes every other spacing decision a judgement call.
 */
export const spacing = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  xxxl: 32,
  huge: 48,
  giant: 64,
} as const

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  pill: 999,
} as const

export const typography = {
  familyPrimary: 'system-ui',
  familyMono: 'ui-monospace',
  size: {
    caption: 12,
    bodySmall: 14,
    body: 16,
    title: 18,
    heading: 24,
    display: 32,
  },
  lineHeight: {
    caption: 16,
    bodySmall: 21,
    body: 24,
    title: 24,
    heading: 32,
    display: 40,
  },
} as const

export const breakpoint = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const

/**
 * Minimum 44x44 touch targets.
 *
 * 40 was considered and rejected: the caregiver app is used on low-end Android phones, often
 * one-handed, sometimes in daylight, by someone in a hurry. See docs/14-testing.md § 8.
 */
export const touchTarget = { minSize: 44 } as const

/** Ethiopia's mobile prefix, for display formatting only. */
export const locale = {
  default: 'en',
  supported: ['en', 'am'],
  country: 'ET',
  currency: 'ETB',
  currencyMinorUnits: 100,
  timezone: 'Africa/Addis_Ababa',
  dateFormat: 'yyyy-MM-dd',
  timeFormat: 'HH:mm',
} as const

export const tokens = {
  colors,
  spacing,
  radius,
  typography,
  breakpoint,
  touchTarget,
  locale,
} as const

export type Tokens = typeof tokens