# apps/admin — Next.js Operations Dashboard

**Status:** Built and verified. Consumes `@homecare/contracts` and `@homecare/design-tokens`.

## Implemented Pages & Architecture

| Route | Purpose | Spec Reference |
|---|---|---|
| `/` | Operations Dashboard with live KPIs, active visits, pending request alerts, and revenue in ETB | A1 |
| `/requests` | Dispatcher Request Queue with search, status filters, and modal to assign/reassign caregivers | A2 |
| `/caregivers` | Caregiver Roster with qualifications, availability toggle, completed visits count, and rating scores | A7 |
| `/services` | Service Catalogue with 9 launch services + OTHER, durations, licensing constraints, and ETB pricing | A8 |

## Design Tokens & Theme

The admin dashboard directly imports color tokens, typography, and status themes from `@homecare/design-tokens`:
- Brand Primary: `#0F6B5C` (Forest Teal)
- Brand Accent: `#C2703B` (Warm Ochre)
- Surface Page Muted: `#F7F8F7`
- Semantic Status Colors: Draft, Pending, Offered, Confirmed, In Progress, Completed, Cancelled.

## Running the Admin Dashboard

```bash
# Development server (runs on port 3001)
npm run dev -w @homecare/admin

# Production build and start
npm run build -w @homecare/admin
npm run start -w @homecare/admin
```