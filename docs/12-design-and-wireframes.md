# 12 — Design System & Wireframes

## 1. Design principles

1. **The customer is anxious.** They are handing a vulnerable person to a stranger. Every screen
   should reduce uncertainty about what happens next. Status, names, photos, and preparation
   details are reassurance features, not decoration.
2. **The caregiver is in the field.** Glanceability beats density. One screen readable in three
   seconds at arm's length in daylight.
3. **Amharic is not a translation.** Design the layout with the longer Ethiopic glyphs in mind.
   Test every screen in both languages from day one; retrofitting a second language is expensive and
   produces clipped text.
4. **Accessibility is not optional.** A 78-year-old patient may use this app, and a caregiver may be
   in bright sun or a dim room.
5. **Status is never colour alone.** Every status uses colour plus an icon plus a text label. This is
   both an accessibility requirement and a requirement for users whose phones render colour badly.

## 2. Colour tokens

Semantic, not decorative. A developer picks by meaning, never by hue.

| Token | Light | Dark | Use |
|---|---|---|---|
| `primary` | `#0B6E4F` | `#12A374` | Main actions, brand. Deep green reads clinical and calm, not medical-blue |
| `primaryDark` | `#085139` | `#0B6E4F` | Pressed state |
| `onPrimary` | `#FFFFFF` | `#FFFFFF` | Text on primary |
| `secondary` | `#1B4B8F` | `#3D7BD0` | Secondary actions, informational |
| `surface` | `#FFFFFF` | `#151A19` | Page background |
| `surfaceAlt` | `#F5F7F6` | `#1E2523` | Cards, list rows |
| `border` | `#D8DEDC` | `#33403C` | Dividers, outlines |
| `textPrimary` | `#111917` | `#F2F5F4` | Body |
| `textSecondary` | `#5A6664` | `#A6B2AF` | Secondary |
| `success` | `#0B7A45` | `#1FA362` | Completed, confirmed, paid |
| `warning` | `#B87400` | `#E39A1F` | Needs attention, urgent |
| `danger` | `#B3261E` | `#F2726A` | Failure, critical, destructive |
| `info` | `#1B4B8F` | `#5C97E8` | Informational |

Contrast requirements, verified in both themes:

- Body text on its background: **4.5:1 minimum**
- Large text (≥ 18pt, or ≥ 14pt bold): **3:1**
- Icons conveying meaning, and UI component boundaries: **3:1**
- Status colour against its background, **and** the paired icon against both

Verify with a contrast checker, not by eye. Eye is unreliable, particularly on low-end phone
screens in sunlight, which is exactly the environment this app runs in.

### Status colour mapping

| Status | Colour | Icon |
|---|---|---|
| `SUBMITTED` | info | clock-outline |
| `UNDER_REVIEW` | info | search-outline |
| `NEEDS_INFO` | warning | help-circle-outline |
| `APPROVED` / `ASSIGNED` | secondary | person-add-outline |
| `CONFIRMED` | success | checkmark-circle-outline |
| `EN_ROUTE` | secondary | navigate-outline |
| `IN_PROGRESS` | success | pulse-outline |
| `COMPLETED` | success | checkmark-done-outline |
| `CANCELLED` | neutral | close-circle-outline |
| `UNABLE_TO_FULFILL` | danger | alert-circle-outline |
| `UNPAID` / `OVERDUE` | warning / danger | card-outline / alert-outline |

`UNABLE_TO_FULFILL` is red because the customer needs to notice it, but the screen that shows it
must be empathetic rather than alarming. Use the colour to draw attention; write the copy with
care.

## 3. Typography

System fonts, both covering Ethiopic. No web font download at runtime.

| Role | Mobile | Admin |
|---|---|---|
| Display | 28 / 36, 700 | 32 / 40, 700 |
| Title 1 | 22 / 28, 700 | 24 / 32, 700 |
| Title 2 | 18 / 24, 600 | 20 / 28, 600 |
| Body | 16 / 24, 400 | 14 / 21, 400 |
| Label | 14 / 20, 500 | 13 / 18, 500 |
| Caption | 12 / 16, 400 | 12 / 16, 400 |
| Numeric, tabular | monospace for ETB and timers | monospace for tables and money |

Rules:

- Minimum body size 16 on mobile. 14 on a phone in daylight is unreadable
- Line height 1.5 for Amharic. Ethiopic glyphs have tall ascenders and descenders; 1.3 clips
- **Tabular figures for all money and timers.** A running timer's digits must not shift horizontally
- User text scaling to 200% without truncation. Test it; it fails on more screens than you expect
- Line length under 70 characters for body text in both languages

### Font check before committing

Verify the system font renders `አ` `ስ` `ፍ` `ዕ` `በ` `ን` `ጥ` `ራ` at every size on the cheapest
Android device you can find. Some Ethiopic fallback fonts clip descenders at small sizes. If the
fallback is poor, bundle a Noto Sans Ethiopic subset rather than shipping broken Amharic.

## 4. Spacing, radius, elevation

- 4-point scale: 4, 8, 12, 16, 24, 32, 48, 64
- Radius: 8 for controls, 12 for cards, 999 for pills
- Elevation: two levels only. Flat and elevated. Nothing in between
- Touch targets: minimum 44×44 dp, ideally 48×48. In the caregiver app, 56 for primary actions

## 5. Component inventory

Build these once, in `packages/design-tokens` plus a shared component library, and use them in both
apps. A component that exists in one app and was hand-rolled in the other is a bug you will
rediscover.

### Foundations

Button (primary, secondary, tertiary, danger, loading, disabled, icon-only), TextField (with
helper text, error text, prefix, suffix, OTP variant), TextArea, Select, DatePicker, TimePicker,
Chip (filter and selectable), Toggle, Checkbox, Radio, Stepper, Slider, SearchField, SegmentedControl,
BottomSheet, Dialog, Snackbar, Tooltip.

### Status

StatusChip (icon + label + colour), StatusStepper (horizontal, for C11), UrgencyBadge, PriceTag,
Avatar (with presence), EmptyState, LoadingState, ErrorState (with retry), SkeletonLoader.

### Domain

ServiceCard, CaregiverCard (photo, name, qualification, verification line), PatientCard, AppointmentCard,
OfferCard (with expiry countdown), VisitSummaryCard, AddressCard, PriceBreakdown (line items with
explanations), PaymentMethodSelector, RatingInput (star), ConsentCheckbox (with version display),
EmergencyBanner, UrgentCareStrip, DocumentUploader (with per-item status), VitalInput (compact numeric),
ChecklistItem, Timeline, SyncIndicator, LocationPill, CountdownBadge, OfflineBanner, AmharicText.

## 6. Screen skeletons

Every screen in the customer app follows one of four skeletons. Consistency across 24 screens comes
from this, not from discipline.

**Home** — app bar (title, notification, language) → status strips → next-visit card → actions grid → list

**List** — app bar (title, filter) → filter chips → scrollable list → optional FAB

**Detail** — app bar (back, title, overflow) → status header → sections → sticky bottom action

**Wizard** — app bar (close, step "3 of 6") → progress bar → form → sticky footer (Back, Next)

**Form** — app bar (back, title) → grouped fields → sticky primary button

## 7. Customer app wireframes

### C6 — Home

```
┌──────────────────────────────────────┐
│ Good morning, Abebe            🌐 🔔  │
├──────────────────────────────────────┤
│ ⚠  Urgent care: 9XX XXX XXX    Call  │  ← always present
├──────────────────────────────────────┤
│                                      │
│   ┌──────────────────────────────┐   │
│   │      Request home care       │   │  ← 56dp, primary
│   └──────────────────────────────┘   │
│                                      │
├──────────────────────────────────────┤
│ NEXT VISIT                     in 2h │
│ ┌──────────────────────────────────┐ │
│ │ Mon 20 Oct, 09:00–11:00          │ │
│ │ Wound care · Almaz Bekele        │ │
│ │ (📷) Marta T.  RN · 7 yrs        │ │
│ │ Bole, Woreda 03                   │ │
│ │ [View details]        [Navigate] │ │
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ REQUEST IN PROGRESS                   │
│ ┌──────────────────────────────────┐ │
│ │ ○ Requested → ◉ Under review → ○ │ │
│ │    20 Oct · Wound care            │ │
│ │    We'll assign a caregiver soon. │ │
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ My patients │ Upcoming │ Messages │ Billing │
│   icons          icons     icons    icons    │
├──────────────────────────────────────┤
│ Services                              │
│ [Nursing] [Elderly] [Wound care] →   │  ← horizontal
│ [Physiotherapy] [Personal care] →    │
├──────────────────────────────────────┤
│ Need help?  Call us  ·  Message us   │
└──────────────────────────────────────┘
```

### C7 — Request wizard, step 3 (When)

```
┌──────────────────────────────────────┐
│  ✕        Step 3 of 6              ?  │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░  │
│  ● Patient  ● Service  ◉ When  ○ Where │
├──────────────────────────────────────┤
│ WHEN DO YOU NEED CARE?                │
│                                      │
│ [ One-time ] [ ● Recurring ]         │
│                                      │
│ How often?                           │
│ ┌──────────────────────────────────┐ │
│ │ Every ●───○────○────○────○────○ │ │
│ │  1    week 2    week 3   month   │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Which days?                          │
│ [M✓][T ][W ][T✓][F ][S ][S ]         │
│                                      │
│ Start date                           │
│ ┌──────────────────────────────────┐ │
│ │ 📅  20 Oct 2026                   │ │
│ └──────────────────────────────────┘ │
│ Start time                           │
│ ┌──────────────────────────────────┐ │
│ │ 🕐  09:00              (15-min)   │ │
│ └──────────────────────────────────┘ │
│ How long?                           │
│ ┌──────────────────────────────────┐ │
│ │ 2 hours              −  +        │ │
│ │ ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░ │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Ends:  [● After 8 visits] ○ On date  │
│       ○ Never                        │
│                                      │
│ Most caregivers are free at:          │  ← advisory, not a promise
│ 09:00  13:00  15:00                  │
│                                      │
│ Estimated: ETB 1,800.00   [Details]  │
├──────────────────────────────────────┤
│ [← Back]            [Next →]         │
└──────────────────────────────────────┘
```

### C11 — Request detail, status tracker

```
┌──────────────────────────────────────┐
│ ←  REQ-2026-000123              ⋯    │
├──────────────────────────────────────┤
│ Wound care                            │
│ Almaz Bekele · Mon 20 Oct 09:00–11:00│
│                                      │
│  ●───────●───────◉───────○───────○   │
│  │       │       │       │       │   │
│  │       │       │       │       └ Today
│  │       │       │       └ Caregiver arriving
│  │       │       └ Caregiver assigned · 11:02
│  │       └ Confirmed · 11:05
│  └ Under review · 09:31
│                                      │
│ YOUR CAREGIVER                       │
│ ┌──────────────────────────────────┐ │
│ │ ┌────┐ Marta Tesfaye             │ │
│ │ │📷 │ Registered Nurse · 7 yrs   │ │
│ │ └────┘ Amharic, English          │ │
│ │ ✓ Licence verified · Background │ │
│ │   checked · Identity verified    │ │
│ │ [Message us]      [Call office]  │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ ✓ Prefer this caregiver next time │ │
│ └──────────────────────────────────┘ │
│                                      │
│ 📍 WHERE                             │
│ ┌──────────────────────────────────┐ │
│ │ [map thumbnail]                  │ │
│ │ Bole, Woreda 03, Kebele 11       │ │
│ │ Bldg 4, Apt 202                  │ │
│ │ Across from St. Joseph Cathedral │ │
│ │ [View map]                       │ │
│ └──────────────────────────────────┘ │
│ ⚑ For the caregiver                   │
│ Blue gate · remove shoes · dog in yard│
│                                      │
│ PRICE                                │
│ Wound care 2h          ETB 1,600.00  │
│ Transport (Bole)        ETB  200.00  │
│ ────────────────────────────────     │
│ Total                  ETB 1,800.00  │
│                                      │
│ TIMELINE                             │
│ • 20 Oct 11:05  Visit confirmed       │
│ • 20 Oct 11:02  Marta assigned        │
│ • 20 Oct 09:31  Reviewed by our team  │
│ • 20 Oct 09:00  Request received      │
│                                      │
│ ───────────────────────────────────  │
│ [Message us]  [Cancel visit]         │
└──────────────────────────────────────┘
```

### C11 variant — `UNABLE_TO_FULFILL`

```
┌──────────────────────────────────────┐
│ ←  REQ-2026-000125                     │
├──────────────────────────────────────┤
│ ⚠ We could not arrange this visit     │
│                                      │
│ We are sorry. We do not have a        │
│ physiotherapist available in Kirkos   │
│ sub-city this week.                   │
│                                      │
│ We tried:                            │
│ • 3 physiotherapists in your area     │
│ • Extending the search to all Addis  │
│                                      │
│ What we can do instead:              │
│ ○ Nursing care 09:00 Mon 20 Oct      │
│ ○ Try 27 Oct instead                 │
│ ● Speak to our team                  │
│                                      │
│ [Choose another date]                │
│ [Choose another service]             │
│ [📞 Contact our office]              │
└──────────────────────────────────────┘
```

### C22 — Emergency (Amharic by default)

```
┌──────────────────────────────────────┐
│ ←        የአደጋ ሁኔታ                       │
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ 🚨 ለሕክምና አደጋ የሚፈልጋው ነው:      │ │
│ │                                  │ │
│ │ ወዲያውኑ የአገልግሎትና ጥናናናነ መለጫ ተቀርበው  │ │
│ │ [  ደውል። 📞 አሁን ይደውሉ  ]        │ │
│ │                                  │ │
│ │ ወደአቅርቡ ያለው እምቅ የሕክምና ተቋም        │ │
│ │ ጥናናናነ መተቋማ ይሂዱ።                  │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ 📞 አስቸኳር የአገልግሎት መስመር ነገር  │ │
│ │ 9XX XXX XXX                      │ │
│ │ ሰዓቶች 8:00 – 18:00              │ │
│ └──────────────────────────────────┘ │
│ ⚠ ይህ አገልግሎት የአደጋ መልስ ነገር  │  │
│    አይደለም። አስቸኳር አገልግሎት ነው። │
│                                      │
│ በስራ ሰዓት ውስጥ ከዚህ በላይ የተጠየቀ   │
│ ጥያቄ ለመስረስ ይደውሉ።                 │
└──────────────────────────────────────┘
```

Amharic first regardless of app language, per [03](03-customer-app-spec.md) § C22. The person in a
crisis may read no other language, and this may be the only thing they read.

### C17 — Review

```
┌──────────────────────────────────────┐
│ ←     How was your experience?       │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │ ┌────┐ Marta Tesfaye           │  │
│  │ │📷 │ Wound care · 20 Oct      │  │
│  │ └────┘                          │  │
│  └────────────────────────────────┘  │
│                                      │
│        ★ ★ ★ ★ ★                     │
│      Excellent                        │  ← changes per selection
│                                      │
│ Professionalism      ★ ★ ★ ★ ★        │
│ Punctuality          ★ ★ ★ ★ ☆        │
│ Quality of service   ★ ★ ★ ★ ★        │
│                                      │
│ Add a comment (optional)             │
│ ┌──────────────────────────────────┐ │
│ │                                  │ │
│ └──────────────────────────────────┘ │
│                                      │
│ ☑ Share my review with [Company]    │
│                                      │
│ [ Submit review ]                    │
│                                      │
│ You can edit this for 7 days.        │
└──────────────────────────────────────┘
```

## 8. Caregiver app wireframes

### G3 — Today

```
┌──────────────────────────────────────┐
│ Good morning, Almaz             ▣   │
│ 3 visits today              Available │  ← toggle
├──────────────────────────────────────┤
│ NEXT · in 2h 15m                     │
│ ┌──────────────────────────────────┐ │
│ │ ⏱ LEAVE BY 08:42                │ │
│ │                                  │ │
│ │ Mr. Bekele Teshome, 78           │ │
│ │ Wound care · 2h                   │ │
│ │ 09:00 – 11:00                     │ │
│ │                                  │ │
│ │ Bole, Woreda 03 · 3.2 km         │ │
│ │ 📍 Bldg 4, Apt 202               │ │
│ │ ⚠ Allergy: Penicillin           │ │  ← safety, prominent
│ │                                  │ │
│ │ [▶ Start visit]     [🧭 Navigate] │ │
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ TODAY                                │
│ ┌──────────────────────────────────┐ │
│ │ 09:00  Mr. Bekele   Wound care   │ │
│ │ 13:00  Mrs. Tadesse Personal c.  │ │
│ │ 16:00  Mr. Haile   Physiotherapy │ │
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ ⚠ 1 new offer · expires in 3h        │  ← tappable
├──────────────────────────────────────┤
│ [Report a problem] [Call dispatch]  │
└──────────────────────────────────────┘
```

`LEAVE BY` is computed from the travel estimate, not hardcoded. It is the single most useful line
on this screen.

### G5 — Offer detail

```
┌──────────────────────────────────────┐
│ ←      New visit offer              │
├──────────────────────────────────────┤
│ Wound care · 2 hours                 │
│ Mon 20 Oct, 09:00 – 11:00           │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ Almaz, 75–84                     │ │
│ │ Post-operative wound dressing    │ │
│ │ Bole · 3.2 km · ~18 min travel   │ │
│ └──────────────────────────────────┘ │
│                                      │
│ ⚠ This patient requires a licensed  │
│   nurse. You are cleared.            │
│                                      │
│ Payout: ETB 500.00                   │
│                                      │
│ Offer expires 13:00 (3h 20m left)   │
│                                      │
│ [✓ Accept]        [✗ Decline]        │
└──────────────────────────────────────┘
```

No address until acceptance. `Care brief` is one line, not a full chart. The caregiver opens the
app to see the detail, which requires authentication and creates an audit record.

### G9 — Active visit

```
┌──────────────────────────────────────┐
│ ←  Mr. Bekele · Wound care      ⚠    │
│ 09:04          ⏱ 01:23:47            │
├──────────────────────────────────────┤
│ ⚠ ALLERGY: Penicillin · latex-free   │  ← pinned
├──────────────────────────────────────┤
│ 📍 Location shared with customer     │  ← honest state
├──────────────────────────────────────┤
│ VITALS                    [+ Add]    │
│ ┌──────────────────────────────────┐ │
│ │ BP      │ HR     │ Temp  │ SpO₂  │ │  ← large targets
│ │ 130/85  │ 78     │ 36.8  │ 97    │ │
│ ├──────────────────────────────────┤ │
│ │ Glucose │ Resp   │ Weight │      │ │
│ │  ─────  │  ────  │ ─────  │      │ │
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ CARE LOG                             │
│ ┌──────────────────────────────────┐ │
│ │ ✓ Wound cleaned           Done   │ │
│ │ ✓ Old dressing removed       Done │ │
│ │ ✓ New dressing applied      Done │ │
│ │ ○ Pressure relief         N/A ▼   │ │
│ │ ○ Patient education      Pending  │ │
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ NOTES                       💾 Saved │
│ ┌──────────────────────────────────┐ │
│ │ Wound clean, no signs of         │ │
│ │ infection. Slight redness at     │ │
│ │ edges.                           │ │
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ [📞 Family] [📞 Dispatch] [🚨 Emergency] │
└──────────────────────────────────────┘
```

Notes autosave every few seconds and show a saved indicator. A caregiver who is not sure they
pressed save will not write notes.

### G10 — Complete visit

```
┌──────────────────────────────────────┐
│ ✕        Complete visit        Step 4 │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
├──────────────────────────────────────┤
│ 1 DEPARTURE                          │
│    Departure time  11:10   [Change]  │
│                                      │
│ 2 SUMMARY                            │
│    ✓ Wound cleaned                   │
│    ✓ Dressing changed                │
│    ✓ Vitals recorded                 │
│    [Edit]                            │
│                                      │
│ 3 VITALS                             │
│    BP 130/85  HR 78  T 36.8°C        │
│    SpO₂ 97%           [Edit]         │
│                                      │
│ 4 OBSERVATIONS                *      │
│ ┌──────────────────────────────────┐ │
│ │ Wound clean, no signs of         │ │
│ │ infection. Slight redness at     │ │
│ │ the edges.                       │ │
│ └──────────────────────────────────┘ │
│                                      │
│ 5 SUPPLIES USED              [+ Add] │
│    Dressing pack ×1          [Remove]│
│    Saline 500ml ×2            [Remove]│
│                                      │
│ 6 FOLLOW-UP                         │
│    [◉ Yes ○ No]                      │
│    Redress in 2 days                │
│    [Suggest next visit: 22 Oct]      │
│                                      │
│ 7 SIGNATURE                         │
│ ┌──────────────────────────────────┐ │
│ │      ~~~~~~~~~~~~~~~~~~~~~~      │ │
│ │         Sign here                │ │
│ │  Signed by: Sara Bekele (daughter)│ │
│ │  [Skip — reason: resident asleep]│ │
│ └──────────────────────────────────┘ │
│                                      │
│ 8 PHOTOS                    [consent]│
│    + Wound before  + Wound after     │
│    ☑ Patient consented to photos     │
├──────────────────────────────────────┤
│ [Save draft]        [Complete visit] │
│                                     │
│ This visit cannot be edited after    │
│ 24 hours.                            │
└──────────────────────────────────────┘
```

### G16 — Incident (critical)

```
┌──────────────────────────────────────┐
│ ✕        Report a problem            │
├──────────────────────────────────────┤
│ SEVERITY                             │
│  [Low] [Medium] [High] [● CRITICAL]  │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ 🚨 IMMEDIATE DANGER              │ │
│ │                                  │ │
│ │ If anyone is in danger:          │ │
│ │                                  │ │
│ │ [  📞 CALL EMERGENCY SERVICES  ] │ │  ← does not wait for
│ │      991                          │ │     the form to submit
│ │ [  📞 CALL DISPATCH NOW         ] │
│ │                                  │ │
│ │ This report saves on your phone  │ │
│ │ even without signal.             │ │
│ └──────────────────────────────────┘ │
│                                      │
│ What happened?                       │
│ ┌──────────────────────────────────┐ │
│ │                                  │ │
│ └──────────────────────────────────┘ │
│                                      │
│ What did you do?                     │
│ ┌──────────────────────────────────┐ │
│ └──────────────────────────────────┘ │
│                                      │
│ Anyone present?                      │
│ ┌──────────────────────────────────┐ │
│ └──────────────────────────────────┘ │
│                                      │
│ [📷 Add photos]                      │
├──────────────────────────────────────┤
│ [Submit report]                      │
└──────────────────────────────────────┘
```

The critical panel appears the moment severity is selected, and the two call buttons are above the
fold. Never make someone fill in a form before they can call for help.

## 9. Admin dashboard layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ☰  [Company] Home Care      ⊕ New booking   🔔 3   Abebe · Admin  ▾       │
├───────────────┬──────────────────────────────────────────────────────────┤
│ Dashboard     │  Dashboard                          [Today ▾] [Export]    │
│               │  ┌──────────┬──────────┬──────────┬──────────┐             │
│ OPERATIONS    │  │Needs     │Unassigned│Today     │Fill rate │             │
│  Request queue│  │attention │requests  │visits    │          │             │
│  Schedule     │  │    7  ⚠ │    3     │  24      │  83%     │             │
│  Active visits│  └──────────┴──────────┴──────────┴──────────┘             │
│  Assignments  │  ┌──────────┬──────────┬──────────┬──────────┐             │
│               │  │Revenue   │Outstand. │Payables  │On-time   │             │
│ PEOPLE        │  │ETB 48.2k │ETB 12.3k │ETB 21.4k │  88%     │             │
│  Customers    │  └──────────┴──────────┴──────────┴──────────┘             │
│  Caregivers   │                                                           │
│  Staff        │  NEEDS ATTENTION                        View all →       │
│               │  ┌──────────────────────────────────────────────────┐    │
│ CATALOGUE     │  │ ⚠ REQ-...125  URGENT  Wound care   2h unassigned│   │
│  Services     │  │ ⚠ REQ-...124  Wound care     awaiting info 3h  │    │
│  Prices       │  │ ⚠ Visit record missing — Almaz B., 8h          │    │
│  Supplies     │  └──────────────────────────────────────────────────┘    │
│               │                                                           │
│ FINANCE       │  TODAY'S SCHEDULE                    [Week ▾] [+]       │
│  Invoices     │  ┌────────┬────────┬────────┬────────┬────────┐            │
│  Payments     │  │ 08:00  │ 09:00  │ 10:00  │ 13:00  │ 14:00  │            │
│  Reports      │  │ M.T.   │ H.K.   │ M.T.   │ A.D.   │ —      │            │
│               │  │ Bekele │ Tadesse│ Fitsum │ Haile  │        │            │
│ QUALITY       │  │ ✓ DONE │ ● LIVE │ ┌────┐ │ 📍    │        │            │
│  Visits       │  │        │        │ │??  │ │       │        │            │
│  Incidents    │  │        │        │ │Open│ │       │        │            │
│  Reviews      │  │        │        │ └────┘ │       │        │            │
│               │  └────────┴────────┴────────┴────────┴────────┘            │
│ SYSTEM         │                                                           │
│  Audit log    │  COVERAGE                                                  │
│  Settings     │  Bole   ████████░░  5 visits, 22h capacity                │
│               │  Kirkos ████░░░░░░  2 visits,  8h capacity                │
│               │  Yeka   ░░░░░░░░░  0 visits,  0h capacity  ← gap         │
└───────────────┴──────────────────────────────────────────────────────────┘
```

The unassigned gutter on the schedule is where work arrives. If a dispatcher has to hunt, you have
designed the dashboard wrong.

## 10. Empty, loading, and error states

Every screen implements all four. This is where most quality gaps appear.

**Empty — first run (no data ever).** Illustration, one sentence explaining the value, one primary
action. No disabled controls, no grey placeholder boxes.

**Empty — filtered result.** "No requests match these filters." + **Clear filters**. Distinguish this
from the first-run empty state; they are different problems.

**Loading.** Skeletons for lists and cards, not a spinner over a blank page. Skeletons should match
the final layout so nothing jumps on load.

**Loading — slow.** After 3 s, "This is taking longer than usual." After 10 s, a retry with the
request id shown. Show the request id to support; it halves the time to diagnose anything.

**Error — recoverable.** Plain message, one retry action, request id small at the bottom.

**Error — validation.** Inline, per field, adjacent to the input, with the message naming the fix:
"Phone number must be 9 digits" rather than "Invalid input".

**Error — permission.** "You do not have access to this record." Do not reveal whether it exists.

**Error — offline.** A persistent banner: "You are offline. Your changes are saved and will be
sent when you reconnect." Never a dead end.

**Error — 500.** "Something went wrong on our side. Our team has been notified." Plus the request
id. Never a stack trace.

## 11. Amharic localisation notes

- Translate as a first-class activity, not a post-hoc pass. A developer should not be the one
  deciding Amharic wording for a clinical message
- Professional medical review of all clinical copy in both languages
- Pluralisation differs from English. Avoid plurals where a neutral phrasing works
- Numbers: Latin digits throughout, including in Amharic, for consistency with prices and times
- Date format: `20 ኦክቶ 2026` rather than a translated `MM/DD/YYYY`
- Time: 12-hour with ጠዋት / ከሰዓት for AM/PM, or 24-hour. Pick one and be consistent
- Text expansion: Amharic strings run longer than English. Buttons, chips, and cards need up to 40%
  more width. Design the layout flexible, and test with `textScaleFactor: 1.3`
- Truncation: if anything must truncate, do it with a line clamp plus a tap to expand, never an
  ellipsis in the middle of a clinical term
- Mixed content: service names come from the bilingual database, so no English words leak into an
  Amharic sentence
- Right-to-left is not needed for Amharic, but confirm line-height and diacritic rendering

## 12. Accessibility checklist

Per screen, before design sign-off:

- [ ] Every interactive element has an accessible label and a ≥44×44 dp target
- [ ] Contrast 4.5:1 body, 3:1 large text and icons, verified with a checker
- [ ] Status conveyed by icon and text as well as colour
- [ ] 200% text scale with no truncation and no horizontal scroll
- [ ] Screen reader can complete the booking flow end to end
- [ ] Every input has a visible label, not only a placeholder
- [ ] Error messages associated with their field, announced on focus
- [ ] Focus order follows visual order; visible focus indicator on every control
- [ ] Dynamic content (toast, sync state, new message) announced politely
- [ ] Language attribute set per element where the content differs
- [ ] Reduced-motion preference respected; no essential information conveyed by animation alone
- [ ] Map has a text alternative: the address is always shown as text
- [ ] Charts in the admin have a data-table alternative
- [ ] Tested on the cheapest Android device in scope, outdoors at midday

## 13. Design review checklist

For each screen before sign-off:

- [ ] Amharic version reviewed by a fluent speaker, no truncation at 200% text scale
- [ ] All states implemented: empty, loading, error, permission, offline
- [ ] Offline behaviour specified
- [ ] No PHI in any notification payload this screen triggers
- [ ] Every destructive action has a typed confirmation and an undo where possible
- [ ] Deep links from notifications resolve to this screen in a sensible state
- [ ] Permission-gated elements render from the server's `can` object, not a local guess
- [ ] Longest realistic content tested: longest name, longest address, 6 services added
- [ ] Caregiver-mode variant reviewed: bigger targets, sunlight, one-handed
- [ ] Screen reader pass completed
- [ ] Copy reviewed for tone: empathetic at failure states, plain at clinical ones