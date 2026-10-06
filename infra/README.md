# infra

Not scaffolded. Terraform and Kubernetes manifests belong to Phase 1, exit gate "Foundation", and
until there is a running API to deploy, an infrastructure definition is an untested guess.

Everything below is a decision to make deliberately rather than inherit from a template. See
`docs/13-infrastructure.md` for the full rationale.

## Decisions that need an answer first

| Decision | Why it is not a default |
|---|---|
| Cloud provider | Latency to Addis Ababa varies a lot. Measure, do not assume |
| Managed Postgres vs self-hosted | Managed. Do not run your own database |
| Region | **May be constrained by law.** `docs/16-open-questions.md` asks whether Ethiopian rules permit processing patient data outside the country. If they do not, the region choice is a legal decision, not a latency one, and it is the one that can force a re-architecture |
| Redis | Required for rate limiting, token denylist, and the notification outbox. In-memory counters do not survive a restart or work across replicas |
| Object storage for uploads | Wound photos and credentials. Needs a documented retention policy and server-side encryption |
| Secrets and KMS | Field-level encryption keys must not sit in an env var. Rotation is a launch gate, see `docs/11-security.md § 8` |

## What must exist before launch, per `docs/13-infrastructure.md`

- Three environments: local, staging, production
- Automated database migrations, forward-only, with a tested rollback or a documented restore
- PITR backups **and a rehearsed restore**. A backup that has never been restored is a hypothesis.
- Separate credentials per environment, no shared secrets
- Structured logs with PHI scrubbing, and an alert when scrubbing fails
- OpenTelemetry traces carrying `X-Request-Id`
- Error tracking with scrubbed request contexts
- WAF and per-IP limits in front of the API

## Backups

Postgres point-in-time recovery plus daily snapshots, retained per the retention schedule in
`docs/11-security.md § 9`. Rehearse a restore quarterly and time it. The number that matters is not
whether backups exist but how long a full restore takes while visits are still being delivered.