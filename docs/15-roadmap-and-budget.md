# 15 — Roadmap, Team & Budget

## 1. What you are buying

You are buying a working MVP: three apps, one database, the workflows to run a home-care business
in Addis Ababa, and enough documentation that a new developer can join without a week of
questions. You are **not** buying a finished company, a proven business model, or a system that
needs no further work.

Two things follow from that, and they should shape every conversation you have with a developer or
an agency:

1. **Build the smallest thing that delivers a visit safely.** Every feature you add before you have
   customers is a feature you are funding with your own money and validating with guesses.
2. **The software is maybe half the cost.** Registration, licensing, insurance, clinical
   governance, caregiver recruitment, training, price research, and the first three months of
   running the business before it pays for itself are all real, and mostly not engineering.

## 2. Phases and timeline

Indicative calendar time for a competent team. A single experienced developer will take roughly
2.5×. Adjust by adding parallel work, not by compressing review.

### Phase 0 — Discovery and legal groundwork (2–4 weeks, runs in parallel)

Not engineering, and it gates everything. Start it on day one.

- Legal entity registered
- Legal advice on licensing for home health care provision in Ethiopia and Addis Ababa
- Data-protection and health-data compliance position
- Insurance: professional liability, public liability, employer
- Payment accounts opened: bank, Telebirr merchant, CBE Birr merchant
- SMS and push provider accounts, with business verification
- Clinical governance written: supervision model, escalation policy, record-keeping standard
- Recruitment of 5 pilot caregivers, with licence verification
- Price research: competitor rates, caregiver pay, cost per visit
- Domain, Play Store developer account, Apple Developer account

**Exit gate:** you can legally and contractually provide the service, and you know your cost per
visit. No phase below should start until this is settled, because changing the service model after
building it is the most expensive mistake available.

### Phase 1 — Foundation (4–6 weeks)

- Repository, monorepo, CI/CD, environments
- Database schema, migrations, RLS, roles
- Authentication: OTP, password, sessions, 2FA for staff
- Permission framework and guards, with tests
- Encryption service, KMS integration, key rotation
- Audit logging, append-only, hash-chained
- Design system, tokens, i18n framework
- Service catalogue and pricing data model with the admin UI to manage it
- Notification service: outbox, templates, FCM, SMS

**Exit gate:** a staff user can log in, a caregiver can register, and every endpoint has a
permission test. Nothing visible to a customer yet.

### Phase 2 — Customer app (5–7 weeks)

- Registration, verification, consent
- Profile, addresses, emergency contacts, patients
- Booking wizard, all six steps, resumable drafts
- Request list and detail with the status tracker
- Quote display
- Upcoming visits, visit detail, arrival code
- Messages
- Billing view, payment instructions, payment claims
- Reviews
- Emergency screen
- Notifications centre
- Amharic throughout

**Exit gate:** a customer can book a request end to end and see it waiting for an admin.

### Phase 3 — Caregiver app (5–7 weeks)

- Onboarding, credentials, document upload with resumable transfer
- Approval status screen
- Availability template and exceptions
- Offer inbox, accept, decline with reasons
- Today screen, schedule
- Visit detail with the care brief
- En route, arrival with GPS and code
- Active visit: vitals, checklist, notes
- Complete visit: documentation, supplies, signature, photos
- Offline queue and sync
- Earnings
- Incident reporting with escalation

**Exit gate:** a caregiver can complete a visit with no signal and it syncs correctly.

### Phase 4 — Admin dashboard (5–7 weeks)

- Authentication with 2FA, role-based navigation
- Dashboard
- Request queue with bulk actions
- Schedule board, day and week
- Active visits map
- Customer management
- Caregiver management, approval, qualification verification
- Services, prices, surcharges, supplies
- Invoices, payments, payment claims
- Clinical records and amendment
- Incidents and follow-ups
- Reviews moderation
- Reports
- Audit log viewer
- Notification templates and broadcasts
- Settings and feature flags

**Exit gate:** an operator can run the whole business from the dashboard with no support from
developers.

### Phase 5 — Integration and hardening (4–6 weeks)

- End-to-end flows across all three surfaces
- Notification matrix complete in both languages
- Scheduled jobs: reminders, escalation, retention, licence expiry, reconciliation
- Security hardening: SAST, DAST, penetration test, fixes
- Accessibility pass, Amharic review
- Performance testing and optimisation
- Real-device testing on low-end Android
- Offline durability testing under real network conditions
- Backup and restore rehearsal
- Documentation and runbooks

**Exit gate:** the full [14](14-testing.md) § 11 release gates pass.

### Phase 6 — Beta (6–10 weeks)

- Internal test, then closed beta with 5–10 caregivers and 10–20 customers
- Real visits, real payments
- Weekly caregiver and customer feedback sessions
- Defect fixing, usability iteration
- Amharic copy refinement from real usage
- Pricing calibration from real data

### Phase 7 — Public launch and phase 2

- Public launch, staged rollout
- Telebirr and CBE Birr integration
- WhatsApp Business
- Family multi-user accounts
- Full offline-first app
- Subscription packages
- Multi-city, when Addis is stable

### Summary

| Phase | Weeks | Cumulative |
|---|---|---|
| 0. Discovery and legal | 2–4 | 4 |
| 1. Foundation | 4–6 | 10 |
| 2. Customer app | 5–7 | 17 |
| 3. Caregiver app | 5–7 | 24 |
| 4. Admin dashboard | 5–7 | 31 |
| 5. Hardening | 4–6 | 37 |
| 6. Beta | 6–10 | 47 |
| **Public launch** | | **~9–11 months** |

~37 weeks of engineering before beta. Phases 2, 3 and 4 can overlap once the foundation is solid,
which could compress the total to about 30 weeks with a team large enough to parallelise. Do not
assume that parallelism; put it in the contract as a milestone commitment only if the team is
genuinely staffed for it.

## 3. Team

### Core team

| Role | Count | What they own |
|---|---|---|
| Technical lead / backend | 1 | Architecture, API, permission framework, code review |
| Flutter developer | 1–2 | Both mobile apps, offline sync |
| Frontend developer | 1 | Admin dashboard |
| DevOps / infrastructure | 0.5–1 | CI/CD, environments, monitoring, security posture |
| QA engineer | 1 | Test plan, automation, device testing, release gates |
| Product owner | 0.5–1 | **You.** Requirements, priorities, acceptance. Non-delegable in phase 0 and 6 |
| Clinical supervisor | 0.5 | Care quality, clinical copy, incident review. Also operational, per [02](02-roles-and-permissions.md) |

**The product owner cannot be you alone, part-time, while you are also running the business.** The
most common failure mode in a project like this is not technical; it is that nobody is accountable
for a decision on Tuesday, so it waits until Friday, and the team builds the wrong version. If you
cannot commit real hours to this, fund a part-time PM.

### Optional

| Role | When | Why |
|---|---|---|
| Designer | Phase 1–2, part-time | Amharic layout and the caregiver UX need more than defaults. Worth it |
| Amharic translator / reviewer | Phase 1–6, part-time | Clinical copy. Not optional if you want the Amharic to be right |
| Penetration tester | Phase 5 | Before real patient data |
| DevOps contractor | Phase 5, if not in-house | Infrastructure is not where to economise right before launch |
| Legal counsel | Phase 0 and 5–6 | Licensing, data protection, patient authority |

### Working with a team in Ethiopia versus offshore

| | Local (Ethiopia) | Regional remote | Offshore |
|---|---|---|---|
| Timezone overlap with your working day | Full | Partial | Limited |
| Understanding the market | Strong | Moderate | Weak |
| Cost | Moderate to high | Moderate | Low |
| Turnover | Lower | Moderate | Higher |
| Onsite access for user testing | Easy | Hard | Very hard |

If the budget is tight, a hybrid works: one senior local developer who owns the product and does
the user testing, plus offshore capacity for well-specified work. The failure mode of fully
offshore is that the errors are in the things nobody specified — what a caregiver actually needs on
that screen — and no amount of testing finds them.

## 4. Budget categories

Indicative figures. **Actual costs depend on your team, your city, and how much you negotiate. Get
three written quotes.** These are order-of-magnitude guides for deciding whether to proceed, not
bids.

### Development

| Model | Typical range | Notes |
|---|---|---|
| Freelancer, senior | USD 25–60 / hour | Fast to start, variable quality, no capacity guarantee |
| Small local agency | USD 60k–150k for the MVP | Verify references in healthcare specifically |
| Mid-size agency | USD 120k–300k | More process, less flexibility, higher overhead |
| Dedicated team, offshore | USD 15–30 / hour | Efficient with strong specs and a reliable PM |
| Team in Ethiopia, 6 people | USD 40k–90k | Realistic local rate range for a competent mixed-seniority team |
| Team in Ethiopia, 8–10 people | USD 70k–150k | Full coverage including QA and DevOps |

At ~37 weeks and 6 people, roughly 1,100 person-weeks, budget in the region of
**USD 60k–120k** for a competent local or hybrid team, **USD 100k–200k** through an agency, and
**USD 25k–60k** for a single strong developer taking twice as long. Expect the low end to cost more
in revisions than it saves upfront.

### Non-development costs before launch

These are frequently forgotten, and several of them are prerequisites for the software being
usable at all.

| Item | Typical | Notes |
|---|---|---|
| Business registration and licensing | USD 500–3,000 | Varies. Confirm with a lawyer |
| Legal advice | USD 1,500–6,000 | Licensing, data protection, patient authority |
| Professional liability insurance | USD 1,000–5,000 / year | **Not optional in healthcare.** Before launch |
| Accountant, VAT and tax advice | USD 500–2,000 | Confirm the tax treatment before charging |
| SMS credits | USD 200–800 / month | Amharic costs 2–3× Latin per message |
| Cloud hosting | USD 300–1,200 / month | Scales with volume |
| Domain, certificates | USD 20–100 / year | |
| Play Store developer account | USD 25 once | |
| Apple developer account | USD 100 / year | Optional if Android-first |
| Device testing lab | USD 500–2,000 | Buy 3–4 real low-end Androids. Cheaper and better than a lab |
| Translation and Amharic review | USD 300–1,500 | Plus clinical review |
| User testing incentives | USD 200–1,000 | Pay caregivers and customers for their time |
| Beta customer onboarding | USD 500–2,000 | Training, materials, support |
| Amharic clinical templates and policies | USD 500–2,000 | If you do not have them internally |
| Penetration test | USD 2,000–8,000 | Before real patient data |
| Operational insurance and legal retainer, year 1 | USD 3,000–10,000 | |

### Running cost, first 6 months after launch

| Item | Monthly |
|---|---|
| Cloud, database, backups, monitoring | USD 300–1,200 |
| SMS and push | USD 200–800 |
| Maps, if billed per use | USD 0–300 |
| Support and maintenance retainer | USD 500–3,000 |
| Operations staff (dispatcher, Finance) | The largest line, and it is payroll |
| Legal and compliance retainer | USD 200–800 |

## 5. Unit economics

Worked example, not a forecast. Replace the numbers with your own research.

**Caregiver pay:** ETB 150 / hour, minimum 2 hours.

**Wound care, 2 hours:**
```
Caregiver:      2 × 150        = ETB   300
Transport cost:                = ETB    50   (real, from your data)
Platform/ops overhead: 10%     = ETB    35
                                              ─────
Total cost                     = ETB   385
```

**Customer price:**
```
Wound care 2h (band)           = ETB  1,000
Transport recovery (Bole)      = ETB   200
                                      ─────
Customer pays                 = ETB  1,200
Gross margin                   = ETB   815   (68%)
```

At ETB 1,200 per visit and 30 visits per day, 20 working days:

```
Revenue:    30 × 20 × 1,200  = ETB 720,000 / month
Gross margin at 68%          = ETB 490,000 / month
```

Then subtract the costs that are easy to forget: dispatcher salaries, your own time, insurance,
software, cloud, SMS, rent, and the visits that get cancelled or unpaid. Take 25% off for
administrative and operational load and you get roughly **ETB 360,000** before fixed costs.

**The finding that matters from that arithmetic: this is a labour business, not a software
business.** Software is a fixed cost you pay once. Caregivers and dispatchers scale with every
visit. That is fine — it is what you are building — but it means the app's job is to reduce
dispatch cost and increase caregiver utilisation, because those are the only two levers that
compound. Filling every available caregiver hour is worth more than any feature.

**Therefore measure utilisation and fill rate weekly from launch.** From
[01](01-product-scope.md) § 7. A platform with 40% caregiver utilisation is a staffing problem, and
no amount of software fixes it.

Also worth checking: ETB 150/hour for a licensed nurse is above the going rate for many of these
roles in Addis. Pay above market and you will get better caregivers, lower turnover, better
documentation, and better reviews — which compounds too. Worth a deliberate decision rather than
accident.

## 6. Build, buy, or borrow

| Component | Recommendation | Why |
|---|---|---|
| Customer and caregiver apps | **Build** | Your core differentiator and your workflow. Everything else is generic |
| Admin dashboard | **Build** | Tightly coupled to your workflows and permissions |
| Auth and OTP | **Build** or managed provider | Phone OTP is easy. A managed provider (Firebase Auth, Auth0) saves weeks but costs per MAU and adds a dependency |
| Database and infrastructure | **Buy** (managed Postgres) | Do not run your own Postgres |
| SMS | **Buy** | No reason to build |
| Push | **Buy** (FCM) | Free at this scale |
| Payments | **Buy, phase 2** | Merchant onboarding is the cost, not engineering |
| Maps | **Buy** | Verify data handling, see [11](11-security.md) § 12 |
| Analytics | **Build nothing** | Either privacy-first self-hosted or nothing. No PHI, ever |
| Error tracking | **Buy** | With scrubbed contexts |
| Design system | **Build** | Shared across both apps |
| Scheduling and dispatch | **Build** | Your core logic |
| E-signature | **Build minimal** | A stroke-captured signature, not a full platform |
| Document upload | **Build** | Object storage plus validation is easy |
| Email | **Buy** | |
| Clinical record standard (DICOM, FHIR) | **Defer** | Not needed for v1. Revisit if you integrate with hospitals |

**Total cost of ownership over three years** should decide between an agency and freelancers, not
the hourly rate. An agency costs more per hour and less per year, if the build is right. The
failure mode is paying agency rates for something that does not work, which is why the reference
checks and the acceptance criteria in this document matter more than the quote.

## 7. Managing the project

### Before you start

- [ ] This specification frozen as v1.0, and a change process agreed (below)
- [ ] Three written quotes against this document, not a vague brief
- [ ] References checked in healthcare specifically, not just "apps we built"
- [ ] A named person on their side who is accountable, not a sales contact
- [ ] Weekly demo, not just status reports. You see working software or you have not built it
- [ ] Source code in a repository you own, with you as the owner. If they hold it, you do not own it
- [ ] Acceptance criteria per phase from [14](14-testing.md) § 11
- [ ] Payment terms: on acceptance, not on schedule. Milestones fund progress
- [ ] IP assignment in writing
- [ ] Confidentiality, including for patient data

### During

- Weekly demo against the phase exit gate, not a progress narrative
- A written change log with a reason and an impact estimate for every change
- A decision log ([ADR](13-infrastructure.md) § 10) for anything non-obvious
- Track scope changes and their cost explicitly. Untracked scope creep is how budgets die
- You own the product decisions. The team advises; you decide, and you decide fast

### Change control

Scope changes are normal; unpriced ones are dangerous.

1. Small changes (copy, a field, a colour) — team decides, tells you
2. Medium (a field on a screen, a new report) — you approve, absorbed in the budget
3. Large (a new service type, a new role, a new integration) — a written change request with an
   estimate and a timeline impact. You decide whether to fund it now or later
4. Anything touching the clinical schema or the permission model is Large, always, and gets a
   security review

Keep a written deferral list. "Phase 2" items that are never written down turn into arguments
later.

## 8. Realistic expectations

What this build will not give you, no matter what anyone promises:

- **It will not find customers.** Marketing, partnerships with hospitals and churches, and referrals
  are a separate budget and a separate effort
- **It will not fix supply.** If there are not enough licensed nurses in Addis, software cannot
  conjure them
- **It will not guarantee documentation quality.** A caregiver who skips the notes because they are
  in a hurry will still skip them. You need supervision, not just a form
- **It will not be perfect.** There will be defects at launch. Design the beta to find them
- **It will need ongoing work.** Expect 15–25% of development capacity per month after launch for
  maintenance, support, and iteration. Budget it. A platform with nobody maintaining it degrades
  into a liability
- **Regulatory requirements may change the design.** Especially on patient data and clinical
  records. Build so that a change is possible: encrypt at the field level, keep the schema
  modular, keep the audit trail honest

What it will give you:

- A defensible record of what care was delivered, by whom, when, and with what consent
- The ability to run more caregivers without linearly more dispatch effort
- Data to price properly and identify which services actually make money
- Repeat business, because the customer knows exactly who is arriving
- A foundation for phase 2 that does not need rewriting

## 9. Decision checkpoints

| Checkpoint | When | Decide |
|---|---|---|
| **After phase 0** | ~4 weeks | Proceed? Licensing settled, cost per visit known |
| **After phase 1** | ~10 weeks | Architecture sound? If not, stop. Everything after is built on it |
| **After phase 4** | ~31 weeks | Does the dashboard let you operate the business? If not, do not launch |
| **After beta, week 4** | ~41 weeks | Documentation compliance above 95%? If not, fix the form before anything else |
| **Before public launch** | ~47 weeks | All of [11](11-security.md) § 14 ticked. No exceptions |
| **At 90 days live** | +13 weeks | Revenue per visit hour, caregiver utilisation, repeat rate. Price again with real data |

The phase 1 checkpoint matters most. Everything after it is built on the foundation, and a
permission model or a database design you have to change later costs multiples of what fixing it
now costs.