# 13 — Infrastructure & DevOps

## 1. Topology

```
                     ┌──────────────────┐
   Customers ───────▶│  CDN / WAF       │
   Caregivers ──────▶│  (TLS, rate      │
                     │   limiting)       │
                     └────────┬─────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
    ┌─────────▼─────────┐        ┌───────────▼──────────┐
    │ Admin (Next.js)   │        │  API (NestJS)       │
    │ static + SSR      │        │  stateless, 2+ pods │
    └───────────────────┘        └────┬───────┬────┬────┘
                                      │       │    │
                          ┌───────────▼──┐ ┌──▼────▼──────┐
                          │ PostgreSQL   │ │ Redis        │
                          │ primary +    │ │ cache, OTP,  │
                          │ replica, RLS │ │ queue, locks │
                          └───────┬──────┘ └─────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
              ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼──────┐
              │ Backups   │ │ Replica   │ │ KMS /      │
              │ (enc,     │ │ (reads,   │ │ secrets    │
              │  separate) │ │  reporting)│ └────────────┘
              └───────────┘ └───────────┘
                                  │
              ┌───────────────────┴────────────────────┐
              │  Worker: scheduler · notifier · exports │
              │  Consumer: outbox                       │
              │  Cron: retention · reconciliation       │
              └─────────────────────────────────────────┘
```

**Why the API is stateless:** horizontal scaling without sticky sessions, so a deploy or a crash
does not end a booking mid-submission. All session state lives in Postgres and Redis.

**Why the worker is a separate service, not a cron in the API:** a bulk report or a retry storm
must not degrade the API that a caregiver is depending on in a customer's home. Keep the
request-serving path small.

### Environment strategy

| Environment | Purpose | Data | Hosting |
|---|---|---|---|
| `local` | Development | Generated synthetic seed data | Docker Compose on a laptop |
| `dev` | Integration, QA, shared testing | Synthetic only | Single cloud project |
| `staging` | Release verification, client demo | Synthetic, seeded realistically | Mirrors production shape |
| `prod` | Live | Real | Multi-AZ, backups, separate security group |

**Hard rule: no real data in any environment other than production.** Not anonymised, not
"just a few rows". Not ever. Synthetic data must be obviously synthetic, including names and
clinical details, so nobody mistakes a test patient for a real one.

Separate cloud accounts or projects per environment, so a compromised staging key cannot reach
production.

## 2. Local development

```bash
# One command, reproducible on any machine
make bootstrap      # install deps, generate keys, create DB, seed synthetic data
make run            # start API, admin, mobile, and workers
make reset          # drop and reseed
make test           # unit and integration
make e2e            # end-to-end against a local stack
```

Docker Compose services: `postgres` (with RLS roles pre-created), `redis`, `api`, `worker`,
`admin`, `mailhog` (captures email instead of sending it), `fake-sms` (captures SMS and lets you
trigger delivery failure), `minio` (S3-compatible, for object storage testing).

`fake-sms` matters more than it looks. You must be able to test SMS delivery failure, the spend cap,
and the critical-incident fallback path without spending real money or waiting on a real carrier.

### Seed data

Synthetic seed: 1 Super Admin, 2 Dispatchers, 1 Finance, 1 Clinical Supervisor, 15 caregivers with
realistic availability and qualification mixes, 40 customers with 60 patients, 200 requests across
every status including the awkward ones (recurring with gaps, reassigned twice, partially paid,
disputed), 12 services with prices and surcharges, 11 Addis sub-cities with woredas, and 12 months
of historical visits so reports have something to show.

**Seed every status including the ones you do not want.** An environment where every request is
`COMPLETED` hides half your bugs.

## 3. CI/CD

### Pipeline per commit

```
1. Install, cache
2. Lint, format check, typecheck          (both TS and Dart)
3. Unit tests                            (coverage gate)
4. Secret scan, dependency audit, licence check
5. SAST, container scan, IaC scan
6. Build API image, admin build, mobile release
   ├─ mobile: binary size budget, cold-start benchmark
   └─ api:   contract snapshot diff → fail on breaking change
7. Ephemeral preview environment
8. Integration tests (real Postgres with RLS, real Redis, real object storage)
9. Permission matrix tests (positive AND negative per endpoint)
10. IDOR tests (cross-household, cross-caregiver → 404)
11. PHI-leak test (logs, analytics, error tracking, notification payloads)
12. End-to-end tests (Playwright for admin, Flutter integration tests)
13. DAST against the preview
14. Publish preview, notify the team
```

### Pipeline gates

| Gate | Blocks merge |
|---|---|
| Typecheck, lint | Yes |
| Unit tests, coverage threshold | Yes |
| Any negative permission test failing | Yes |
| Any IDOR test failing | Yes |
| PHI-leak test failing | Yes |
| High or critical CVE | Yes |
| Secret detected | Yes |
| Breaking API change without a version bump | Yes |
| Mobile binary over budget | Yes |

### Deployment

| Environment | Trigger | Method |
|---|---|---|
| `dev` | Merge to `main` | Rolling |
| `staging` | Tag `rc-*` | Rolling, migrations applied |
| `prod` | Tag `v*` or manual approval | Rolling, canary, migrations first |

**Migration ordering.** Expand, migrate, contract:

1. **Expand** — additive migration, backward-compatible with the previous release. Deploy it.
2. **Migrate** — backfill, either in batches or a background job. Old and new code both work.
3. **Deploy** — new code that reads the new shape.
4. **Contract** — remove the old column or path, in a later release.

Never a destructive migration in the same deploy as the code that stops using the column. A failed
deploy with a dropped column is unrecoverable, and on a business where your data is the whole
business, unrecoverable is not a risk you take.

Rollback means rolling back the application, not the schema. Additive migrations are what make
that possible.

### Mobile release

| Channel | Purpose | Cadence |
|---|---|---|
| Play internal test | Team and pilot caregivers | Continuous |
| Play closed testing | Pilot cohort (5–15 caregivers) | Weekly |
| Play production | Public | Every 2–4 weeks |

Internal and closed testing first, always. A crash in a caregiver's app mid-visit is a failed
visit. Ship to pilot caregivers before shipping to everyone.

Android first: the market is Android, the Play Store is reachable, and iOS needs a developer
account and a review cycle. Ship Android well rather than both badly.

Staged rollout percentages, monitoring crash-free rate and ANR rate, with a halt threshold.

## 4. Observability

### Metrics (Prometheus or equivalent)

| Area | Metrics |
|---|---|
| API | Request rate, p50/p95/p99 latency, error rate by status and route |
| Database | Connection pool, slow query count, replication lag, table bloat, partition count |
| Cache | Hit rate, memory, evictions |
| Queue | Depth, age of oldest message, processing rate, failure count |
| Scheduler | Heartbeat, job duration, missed jobs, run time by job |
| Notifications | Sent/delivered/failed by event and channel, outbox age, PHI-allowlist rejections |
| Business | Requests by status, unassigned count, unassigned age, fill rate, caregiver utilisation |
| Mobile | Crash-free rate, ANR rate, cold start, sync failure rate, queue depth |
| Security | 403 rate, access-denial spike, unusual export volume, `PHI_ACCESS_DENIED` count |

### Logging

Structured JSON, `pino` on the API. Every line carries `request_id`, `actor_id`, `actor_role`, and
`route`. **PHI keys redacted before anything leaves the process**, per
[11-security](11-security.md) § 2. A CI test asserts this.

Log levels: `error` needs a response, `warn` needs attention within a day, `info` is business
events, `debug` off in production.

### Tracing

OpenTelemetry, trace context propagated from the mobile app through the API to the database and
out to workers. Sample at 5% normally, 100% for errors and slow requests.

Business entities carry a trace tag so you can answer "why did this booking take 8 seconds" without
guessing.

### Error tracking

Sentry or equivalent, with a **scrubbed context**. Send entity ids, never clinical content. The
mobile app's default breadcrumbs include screen names and route paths, which is fine; form field
values are not.

### Dashboards

| Dashboard | Audience | Content |
|---|---|---|
| Service health | Engineering | Uptime, latency, errors, queue depth, DB |
| Business operations | You | Requests, fill rate, unassigned age, caregiver utilisation |
| Notification delivery | Engineering and ops | Per-channel success, SMS spend |
| Security | Engineering and SA | Access denials, audit events, anomalies |
| Mobile | Engineering | Crash-free, ANR, sync, per-version adoption |

### Alerts, and the alert budget

Every page must be actionable at 3 a.m. If it is not, it is a ticket, not a page.

**Paging:**

| Condition | Threshold |
|---|---|
| API error rate | > 2% over 5 min |
| API p99 latency | > 3 s over 10 min |
| Database connections | > 90% of pool |
| Replication lag | > 60 s |
| Outbox age | > 5 min |
| Scheduler heartbeat | Missing 2 min |
| Push delivery failure | > 5% over 15 min |
| Crash-free rate | < 95% on any version above 10% rollout |
| Any PHI-allowlist rejection | 1 |
| Backup job | Failed |
| Disk | > 85% |

**Ticketing, not paging:** business metric degradation, slow query growth, certificate expiry
inside 14 days, licence-expiry digest, documentation-compliance breach.

## 5. Backups and disaster recovery

| Database | Continuous WAL archiving + daily full | 35 days | Monthly, rehearsed |
|---|---|---|---|
| Object storage | Provider versioning + cross-region | 90 days | Quarterly |
| Audit log | Immutable bucket, separate credentials | 7 years (confirm) | Quarterly |
| Secrets / KMS | Provider-managed | — | — |
| Config | Git, tagged per release | Indefinite | — |

**RPO 1 hour, RTO 4 hours.** Realistic for the volume and the cost. State it to yourself now,
because in an incident you will be asked.

Rules:

1. **Rehearse restores quarterly.** An untested backup is a hope
2. **Backups encrypted with a different key** from the primary, in a different security domain
3. **No production database restore into a non-production environment.** Ever. Restore into an
   isolated environment and export synthetic subsets
4. **Restoration test covers key paths**, not just a table count: a caregiver logs in, a clinical
   record decrypts, an invoice balances
5. **Database PITR** available for the clinical schema, for accidental deletion

## 6. Scaling

Realistic launch volumes: ~50 requests/day, ~10 caregivers, ~30 visits/day. Design for 10× on day
one (500 requests/day, 100 caregivers, 300 visits/day) and know where the next limits are.

| Component | Comfortable | First bottleneck | Next step |
|---|---|---|---|
| API pods | 2–8 | Database connection pool | PgBouncer, read replica |
| Postgres | 100k appointments, 10M audit rows | Table bloat on `audit.log` and `visit_location_pings` | Already partitioned |
| Redis | Cache and queue | Memory with cached clinical data | Cache TTLs, smaller payloads |
| Notifications | 50k SMS/day on a normal provider | Provider quota | Second provider, queue |
| Admin dashboard | 100k appointments | Aggregate queries | Pre-aggregated daily rollups |
| `visit_location_pings` | ~50k/day | Write volume | Already partitioned, retention job |
| Object storage | Wound photos, 2 MB each | — | Lifecycle rules for old photos |

Optimise when you measure a problem, not in advance. The realistic v1 load will not require any of
the next-step column.

## 7. Cost drivers

Roughly, per month at launch scale:

| Item | Driver |
|---|---|
| Compute (API, admin, workers) | Always-on baseline |
| Database | Storage, backups, I/O |
| SMS | Messages per month. Amharic costs 2–3× Latin per segment |
| Push (FCM) | Free within free-tier limits |
| Maps | Active users and requests, depending on the provider |
| Object storage | Wound photos and signatures. Small |
| Monitoring and logging | Metrics cardinality and log volume |
| Backups | Storage |
| Third-party: auth, email, error tracking | Volume |

The two that will surprise you: **SMS volume**, because the caregiver app sends several messages
per visit, and **maps**, because SDK use can be billed per request or per load. Check both before
launch and set spend alerts.

See [15](15-roadmap-and-budget.md) for total budget categories.

## 8. Operational runbooks

Written, not improvised. Each one page, with the exact dashboard link and the exact command.

| Runbook | Contents |
|---|---|
| Caregiver no-show | Identify → find a replacement → notify the customer → record it |
| Caregiver no-show mid-visit | Urgent: locate the caregiver, confirm the patient's safety, notify |
| Customer reports an unpaid payment | Check the claim queue, the invoice, the statement |
| Suspicious access report | Pull the clinical audit for that patient, contain access, assess notification |
| Data incident, suspected breach | Contain → preserve evidence → notify per the legal plan |
| Database outage | Failover, communication to staff, restoration path |
| SMS provider outage | Switch provider, fall back to push, alert |
| Bad notification template | Kill switch per event and channel, fix, re-enable |
| Caregiver licence lapse mid-series | Find affected appointments, reassign, notify customers |
| Mass reassignment, sub-city | Trigger the reassignment engine, coordinate by phone |
| Key compromise | Rotate, re-encrypt, review access logs, assess |
| Rollback | Application rollback, migration compatibility check |
| Staff departure | Revoke sessions, reassign visits, per [02](02-roles-and-permissions.md) § 7 |

The two that matter most on day one are **caregiver no-show mid-visit** and **bad notification
template**. Both are fast, both are embarrassing, and both need a decision tree written in advance
by someone who is not panicking.

## 9. Repository and branch strategy

```
main          production
develop       integration
release/*     release candidate
feature/*     feature branch
hotfix/*      production fix, merged to main then develop
```

Trunk-based with short-lived branches (under 3 days) rather than long-running ones. Given the
mobile release cycle, a mobile feature branch that lives for six weeks will drift from the API by
the time it ships.

**Monorepo** with the layout in [README](../README.md). One repository, three deployables, shared
contracts. The alternative — separate repositories for API, admin, and mobile — guarantees contract
drift and three sets of CI configuration to keep in sync.

Required repository configuration: branch protection, required reviews, required CI, signed
commits, CODEOWNERS on the clinical and security paths.

## 10. Documentation to keep current

| Document | Owner | Update trigger |
|---|---|---|
| This specification | Product owner | Any scope or design change |
| API reference (generated) | Engineering | Every deploy |
| Data dictionary | Engineering | Migration |
| Runbooks | Operations | Every incident and rehearsal |
| Decision log (ADR) | Engineering | Every significant decision |
| Amharic glossary | Clinical reviewer | Every clinical term added |
| Price list | Finance | Every price change |

**Architecture decision records** matter more than usual here, because a care platform accumulates
non-obvious decisions fast: why fees are manual, why clinical notes are withheld from customers,
why arrival codes exist, why the request and appointment are separate entities. Write the reason at
the time, or in six months you will be reading code and guessing.