# [Company Name] Home Care — Application Development Document

**Status:** v1.0 — baseline for build
**Target market:** Addis Ababa (launch), Ethiopian cities (expansion)
**Last updated:** 2026-10-05

---

## What this is

A complete build specification for a home health care platform with three surfaces:

| Surface | Audience | Stack |
|---|---|---|
| Customer mobile app | Patients and family members booking care | Flutter (Android + iOS, one codebase) |
| Caregiver mobile app | Nurses, care workers, physiotherapists | Flutter (same codebase, role-gated) |
| Admin web dashboard | Your operations team | Next.js + TypeScript |

Hand this folder to a developer or development company. Every screen, field, API call,
table, permission, and workflow needed for the first release is specified here.

---

## Document index

| # | Document | Contents |
|---|---|---|
| 00 | This README | Scope decisions, reading order, project layout |
| 01 | [Product Scope & Service Model](docs/01-product-scope.md) | Business model, MVP boundary, out-of-scope, metrics |
| 02 | [Roles & Permissions](docs/02-roles-and-permissions.md) | 7 roles, full permission matrix, access rules |
| 03 | [Customer App Spec](docs/03-customer-app-spec.md) | Every customer screen, field, and state |
| 04 | [Caregiver App Spec](docs/04-caregiver-app-spec.md) | Every caregiver screen, field, and state |
| 05 | [Admin Dashboard Spec](docs/05-admin-dashboard-spec.md) | Every dashboard page and its data |
| 06 | [Data Model](docs/06-data-model.md) | All tables, columns, types, constraints, indexes |
| 07 | [API Contract](docs/07-api-contract.md) | Every endpoint, request/response shape, errors |
| 08 | [Workflows & State Machines](docs/08-workflows.md) | Status transitions, assignment logic, edge cases |
| 09 | [Notification System](docs/09-notifications.md) | Event matrix, message templates, delivery rules |
| 10 | [Payments & Pricing](docs/10-payments.md) | Quote engine, invoices, manual recording, gateway seam |
| 11 | [Security, Privacy & Compliance](docs/11-security.md) | PHI handling, encryption, audit, retention, consent |
| 12 | [Design System & Wireframes](docs/12-design-and-wireframes.md) | Tokens, components, ASCII wireframes per screen |
| 13 | [Infrastructure & DevOps](docs/13-infrastructure.md) | Environments, CI/CD, hosting, observability |
| 14 | [QA & Testing](docs/14-testing.md) | Test pyramid, critical paths, release gates |
| 15 | [Roadmap, Team & Budget](docs/15-roadmap-and-budget.md) | Phases, timelines, cost categories, build-vs-buy |
| 16 | [Open Questions & Launch Checklist](docs/16-open-questions.md) | Decisions needed before build, go-live gate |

**Answer [16](docs/16-open-questions.md) before you build.** It lists every decision that is yours
to make and every question for a local lawyer. Items marked *blocking* change the data model, the
permissions, or the service scope, so a developer will otherwise have to guess.

---

## Build status

The specification above is complete. The implementation is at the very beginning. This section
exists so nobody mistakes the two.

| Surface | State | Verified |
|---|---|---|
| `packages/contracts` | Shared types, zod schemas, state machines, error codes | 46 tests passing, typecheck clean |
| `packages/design-tokens` | Colour, spacing, type, locale tokens | 15 tests passing, WCAG contrast checked |
| `packages/config` | Shared ESLint flat config and TS base | lint runs across every workspace |
| `apps/api` | NestJS. Health, OTP request, cross-cutting error and request-id handling | 56 tests passing, typecheck and lint clean, boots and serves |

What has **not** been built yet: the database and migrations, session issuance, registration,
booking, assignment, the visit flow, notifications, payments, every permissioned endpoint, the
admin dashboard, and the mobile app. The current API is an authentication entry point, not a
product.

`apps/admin`, `apps/mobile`, and `infra` contain only a README explaining what belongs there and
why it is not scaffolded yet.

```bash
npm install
npm run verify   # lint, build, typecheck, test — in that order
```

Build must precede typecheck and test: the API resolves `@homecare/contracts` through its `dist/`,
which does not exist in a clean checkout. `npm run verify` encodes the correct order so it does not
have to be remembered.

### Dependency security

`npm audit --omit=dev` reports **2 moderate advisories**, both fixable only by a major upgrade of
NestJS:

- `@nestjs/core` injection neutralisation — fixed in 11.1.18+.
- `file-type` — `@nestjs/common` pins exactly `20.4.1`; the fix requires a major jump, and the code
  path that uses it (file upload type detection) is not implemented yet.

Both should be handled together in one deliberate Nest 11 upgrade, not by forcing a transitive
dependency past a pinned version. The remaining advisories are in development tooling (vitest,
webpack, esbuild, picomatch) and are not reachable in production.

Production-reachable transitive dependencies (`body-parser`, `qs`, `multer`) are pinned through
`overrides` in the root `package.json`. **Do not run `npm audit fix`** — it re-resolves the tree
against the parent ranges and silently strips these overrides. Re-run `npm install` after any
`package.json` change.

---

## Scope decisions already made

These were decided up front so the developers do not have to guess:

1. **One mobile codebase** — Flutter, covering Android and iOS, with the caregiver app
   shipped as a role-gated mode inside the same app. One release train, one Play Store
   submission, one codebase to maintain.
2. **Payments are recorded manually in v1.** No gateway integration in the MVP. The data
   model includes a `payment_method` seam so Telebirr, CBE Birr, or a card gateway can be
   added later without a migration. See [10-payments](docs/10-payments.md).
3. **Clinical notes are not chat.** Care documentation goes into a structured visit record
   with its own access rules, not the messaging thread. See [11-security](docs/11-security.md).
4. **The app does not promise emergency medical response.** An emergency screen routes users
   to official emergency services and your urgent-care line. See [03-customer-app-spec](docs/03-customer-app-spec.md).
5. **Patient health data is encrypted at the field level** and lives in a logically separate
   schema with tighter access control than business data. Not an afterthought.

---

## Reading order for a new developer

1. This README — scope decisions
2. [01](docs/01-product-scope.md) then [02](docs/02-roles-and-permissions.md) — the model
3. [16](docs/16-open-questions.md) — what is still undecided, and what a lawyer must confirm
4. [08](docs/08-workflows.md) — the state machine is the heart of the system; understand this first
5. [06](docs/06-data-model.md) and [07](docs/07-api-contract.md) — the contract
6. [03](docs/03-customer-app-spec.md), [04](docs/04-caregiver-app-spec.md), [05](docs/05-admin-dashboard-spec.md) — the screens
7. [11](docs/11-security.md) — required reading, not optional
8. [15](docs/15-roadmap-and-budget.md) — phases and gates

---

## Repository layout

```
homecare/
├── apps/
│   ├── api/                 NestJS backend (REST + WebSocket)      [built]
│   ├── admin/               Next.js admin dashboard                 [README only]
│   └── mobile/              Flutter app (customer + caregiver)     [README only]
├── packages/
│   ├── contracts/           Shared API types + validation schemas   [built]
│   ├── design-tokens/       Colours, spacing, typography, locale   [built]
│   └── config/              Shared eslint + tsconfig base          [built]
├── docs/                    This specification                      [built]
├── infra/                   Terraform, k8s manifests, CI workflows  [README only]
├── package.json             npm workspaces root
├── tsconfig.base.json
└── .prettierrc.json
```

Marked *built* means it compiles, lints, and has tests passing. *README only* means the directory
explains what belongs there and why it is not there yet — see the "Build status" table above.

## Naming and language

- Code, identifiers, and documentation: English.
- Customer and caregiver UI: **English and Amharic** from day one, because the primary user
  base is Addis Ababa. Do not ship English-only and "translate later" — retrofitting i18n is
  expensive. All strings go through localization files from the first commit.
- Currency: ETB throughout. Store amounts as integers in **santim** (ETB cents). See [10](docs/10-payments.md).

## The single most important note

This document is a complete technical specification, but it is **not legal advice**. Before
launch you need a local Ethiopian lawyer to confirm health-data, licensing, and payment
requirements. See [16-open-questions](docs/16-open-questions.md) for the specific items to raise.