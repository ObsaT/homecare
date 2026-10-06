import { describe, expect, it } from 'vitest'
import { colors, radius, spacing, tokens, typography } from './tokens.js'

/**
 * Tokens are the one thing in the system where an error is invisible in code review and obvious to
 * a customer. These tests check the properties that must hold for the palette to be usable, not the
 * specific values.
 */

function hex(value: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(value)
  if (!match) throw new Error(`Not a 6-digit hex colour: ${value}`)
  const int = Number.parseInt(match[1] as string, 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}

/** Linearises one sRGB channel, per WCAG 2.1 relative luminance. */
function linearise(channel: number): number {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** Relative luminance per WCAG 2.1. */
function luminance(value: string): number {
  const [r, g, b] = hex(value)
  return 0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b)
}

function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

describe('colour palette', () => {
  it('uses only 6-digit hex values', () => {
    const walk = (value: unknown): void => {
      if (typeof value === 'string' && value.startsWith('#')) {
        expect(value, `malformed colour ${value}`).toMatch(/^#[0-9A-Fa-f]{6}$/)
      } else if (value && typeof value === 'object') {
        for (const nested of Object.values(value)) walk(nested)
      }
    }
    walk(colors)
  })

  it('keeps body text readable on the page background (WCAG AA)', () => {
    // 4.5:1 is the AA threshold for normal text. Both of these are primary UI text on the default
    // background, so failing here means text is genuinely hard to read in the field.
    expect(contrastRatio(colors.text.primary, colors.surface.page)).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps secondary text readable on the page background', () => {
    expect(contrastRatio(colors.text.secondary, colors.surface.page)).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps white text readable on the primary brand colour', () => {
    expect(contrastRatio(colors.brand.onPrimary, colors.brand.primary)).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps white text readable on the danger colour', () => {
    expect(contrastRatio('#FFFFFF', colors.feedback.danger)).toBeGreaterThanOrEqual(4.5)
  })

  /**
   * Status colours encode status *group*, not identity. Failures share the danger colour and live
   * visits share the brand colour, because the UI always pairs colour with an icon and a text label
   * (docs/12-design-and-wireframes.md § 3). Asserting that all twelve are distinct would push the
   * design toward twelve arbitrary hues and hurt the colour-blind and the glanceable case both.
   *
   * What must hold is that the grouping is intentional. This pins the mapping so recolouring one
   * status in isolation fails here.
   */
  it('groups statuses by meaning rather than assigning twelve arbitrary hues', () => {
    const danger = colors.feedback.danger
    const muted = colors.text.tertiary
    const brand = colors.brand.primary

    // Every failure outcome reads the same, because they mean the same thing to a dispatcher.
    expect(colors.status.cancelled).toBe(danger)
    expect(colors.status.declined).toBe(danger)
    expect(colors.status.noShow).toBe(danger)
    expect(colors.status.unableToFulfill).toBe(danger)

    // Inactive and dead-ended states recede.
    expect(colors.status.draft).toBe(muted)
    expect(colors.status.expired).toBe(muted)
    expect(colors.status.closed).toBe(colors.text.secondary)

    // In-flight and done states use the brand colour, separated by the label and icon.
    expect(colors.status.confirmed).toBe(brand)
    expect(colors.status.inProgress).toBe(brand)
    expect(colors.status.completed).toBe(colors.feedback.success)
  })

  it('gives every status a colour', () => {
    for (const [name, value] of Object.entries(colors.status)) {
      expect(value, `status ${name} has no colour`).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })

  it('separates draft from confirmed visually', () => {
    expect(colors.status.draft).not.toBe(colors.status.confirmed)
  })
})

describe('spacing and radius', () => {
  it('uses a consistent 4-point scale', () => {
    for (const value of Object.values(spacing)) {
      expect(value % 4, `spacing value ${value} is off the 4-point grid`).toBe(0)
    }
  })

  it('increases monotonically', () => {
    const values = Object.values(spacing) as number[]
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeGreaterThan(values[i - 1] as number)
    }
  })

  it('has a pill radius larger than any corner radius', () => {
    const cornerRadii = Object.values(radius).filter((v) => v !== radius.pill) as number[]
    expect(Math.max(...cornerRadii)).toBeLessThan(radius.pill)
  })
})

describe('typography', () => {
  it('pairs a font size with a line height everywhere', () => {
    expect(Object.keys(typography.size).sort()).toEqual(Object.keys(typography.lineHeight).sort())
  })

  it('keeps mobile body text at 16 or larger', () => {
    // docs/12-design-and-wireframes.md: 14px body on a phone in daylight is not readable.
    expect(typography.size.body).toBeGreaterThanOrEqual(16)
    expect(typography.size.caption).toBeGreaterThanOrEqual(12)
  })

  it('gives every style a line height at least as large as its font size', () => {
    for (const [name, size] of Object.entries(typography.size)) {
      const lineHeight = typography.lineHeight[name as keyof typeof typography.lineHeight]
      expect(lineHeight, `${name} line height`).toBeGreaterThanOrEqual(size)
    }
  })
})

describe('token package shape', () => {
  it('exposes a single root object for export', () => {
    expect(Object.keys(tokens).sort()).toEqual([
      'breakpoint',
      'colors',
      'locale',
      'radius',
      'spacing',
      'touchTarget',
      'typography',
    ])
  })
})