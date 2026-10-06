# 16 — Open Questions & Launch Checklist

## 1. How to use this document

Part 1 is the questions **you** must answer before the build starts. Part 2 is what **you and a
lawyer** must confirm before launch. Part 3 is the operational readiness gate.

A developer cannot answer Part 1. These are commercial, clinical, and legal decisions, and if
they are left open the build will guess, and the guesses will be baked into the code.

**Every question in Part 1 marked blocking must have an answer before Phase 1 starts.**

## 2. Part 1 — Decisions needed before the build

### Legal and regulatory (blocking, all of them)

| # | Question | Why it blocks the build |
|---|---|---|
| L1 | Is home health care provision licensable in Ethiopia, and under which authority? Ministry of Health, or the Addis Ababa City Administration health bureau? | Determines whether you need a licence to operate at all, and which body grants it |
| L2 | Does offering clinical services (nursing, wound care, medication administration) differ legally from offering non-clinical support (bathing, companionship)? | Determines the service scope you may build and sell. This is the largest single risk in the plan |
| L3 | Must a registered nurse be in place to operate, and what supervision is required? | Determines whether `CLINICAL_SUPERVISOR` is a legal role or a preference |
| L4 | What are the retention requirements for patient clinical records? | Sets `clinical.visit_records` retention. Getting this wrong is a compliance failure |
| L5 | What constitutes valid consent, and can it be captured in an app? Is written or witnessed consent required for any procedure? | Determines the consent flow in [03](03-customer-app-spec.md) C4 Step 2 and the booking consent checkbox |
| L6 | If a customer books for someone who did not consent, who carries the liability? Is there a mechanism to verify authority? | The platform cannot verify familial authority. This needs a documented policy |
| L7 | What are the data-protection obligations for health data specifically, beyond general personal data? | Determines encryption, retention, and breach-notification requirements |
| L8 | Is there a breach-notification deadline to a regulator? | Determines your incident response plan |
| L9 | Are there professional-liability insurance requirements? | Determines whether you can legally operate |
| L10 | Do caregiver background checks or health certificates have a legal requirement? | Determines the onboarding document list in [04](04-caregiver-app-spec.md) G1 |

### Commercial (blocking)

| # | Question | Default if unanswered |
|---|---|---|
| M1 | What is your cost per visit, all-in, including transport and idle time? | You cannot price or know your margin |
| M2 | What hourly rate will you pay caregivers? Above or below market? | Default ETB 150/h, but check locally |
| M3 | What should a wound-care visit cost the customer? | `catalog.service_prices` starts empty |
| M4 | What transport charge per sub-city? | ETB 0 until you have real numbers |
| M5 | What is your cancellation policy? Fees, and the window | 50% inside 24 h |
| M6 | Will you run monthly invoicing for recurring care? | Per visit |
| M7 | Do you want a minimum booking duration per service? | Per service default |
| M8 | Night, weekend, and urgent surcharge percentages | 20% / 10% / 15–25% |
| M9 | Do you require a deposit for bookings? | No. Consider it |
| M10 | What is your policy if a caregiver no-shows: refund, credit, or partial? | Full refund |
| M11 | Will you pay caregivers weekly or monthly? | Monthly |
| M12 | Is VAT or any other tax due on these services, and does it differ between clinical and non-clinical? | **Get this from an accountant before charging anyone** |

### Clinical (blocking for the clinical features)

| # | Question | Default |
|---|---|---|
| CL1 | Who is your Clinical Supervisor, and are they qualified? | Must exist before launch |
| CL2 | What care-checklist template does each service require? | `catalog.services.care_checklist` is empty without it |
| CL3 | What supplies does each service consume, and in what quantity? | Empty templates mean no costing |
| CL4 | Which vital signs are in scope, and what are the out-of-range thresholds? | `clinical.vitals` checks exist, thresholds do not |
| CL5 | When must a visit be escalated to a clinical supervisor? | Escalation matrix is config, but the clinical rule is yours |
| CL6 | What is your policy on photographing wounds? Consent basis per attachment? | Explicit patient consent |
| CL7 | Do you permit medication administration, and under what supervision? | Affects `MEDICATION` service and `requires_administration` |
| CL8 | What documentation standard must a visit record meet? | 100% completion, no exceptions |
| CL9 | Do caregivers have the authority to escalate to emergency services, and who pays? | Policy needed |

### Product (mostly blocking, but you can revise these later)

| # | Question | Default |
|---|---|---|
| P1 | Amharic first, English second, or fully bilingual on day one? | Fully bilingual |
| P2 | Do you serve all 11 Addis sub-cities at launch, or a subset? | All, but check [11](11-security.md) § 12 on address privacy |
| P3 | Android only, or iOS from launch? | Android first, Flutter covers both |
| P4 | Minimum Android version? | API 29 (Android 10). Check your caregivers' actual devices |
| P5 | Do customers need multi-patient household accounts? | Yes, in the booking flow. Family login is phase 2 |
| P6 | Do you want the "same caregiver" preference enforced or advisory? | Enforced, with dispatcher notification on failure |
| P7 | Arrival confirmation: app code, or post-visit checkbox? | Both. The code is the stronger control |
| P8 | Do caregivers rate each other internally? | No |
| P9 | Do you want the customer to see the caregiver's rating? | Yes, after a completed visit |

### Technical (non-blocking, defaults are fine)

| # | Question | Default |
|---|---|---|
| T1 | Which SMS provider? | Compare on cost, Amharic support, business requirements, and API quality |
| T2 | Which maps provider, and does address data retention satisfy you? | Review before committing. See [11](11-security.md) § 12 |
| T3 | Analytics: self-hosted, or none? | **None.** Never PHI |
| T4 | Which error-tracking service? | Any, with scrubbed contexts |
| T5 | Managed Postgres provider? | Any reputable one, with backups and PITR |
| T6 | Cloud provider? | Reputable, with a region that reduces latency for Ethiopia |
| T7 | Which push approach beyond FCM? | FCM only |

## 3. Part 2 — Confirm before launch

These need a professional answer, not an engineering decision. The framing below is what to ask,
not what the answer is.

### Licensing and clinical scope

1. What licence does a home health care business require in Ethiopia? Which authority issues it,
   and what are the fees, timelines, and premises requirements?
2. Does the City of Addis Ababa impose additional registration on health services?
3. What is the boundary between a "home care support service" and a "private healthcare provider"?
4. If we perform nursing, wound care, and medication administration, what clinical governance is
   required? Named supervisor? Referral arrangements? Records standards?
5. What must a caregiver's licence be, and how do we verify it against the issuing authority?
6. Are background checks or health certificates legally required for caregivers?
7. Are there restrictions on which services may be delivered in a patient's home?

### Data protection

8. Which Ethiopian data-protection law applies to health data, and what does it require?
9. What is the minimum set of personal data you must collect, and may you collect optional data at
   all?
10. What consent standard applies to processing health data? Can it be electronic? Must it be
    separately obtained?
11. Is there a data-protection registration or notification requirement?
12. What are the breach-notification obligations and deadlines?
13. What are the patient-record retention requirements, and do they differ by record type?
14. Can a customer's data be transferred to cloud infrastructure outside Ethiopia? Are there
    residency or cross-border transfer restrictions? **This may be the most consequential technical
    constraint in the whole project.**
15. What are the subject-access and erasure rights, and what limits apply to erasure of clinical
    records?
16. Do you need a Data Protection Officer or equivalent, and what are their duties?
17. Are vendors (SMS, maps, cloud, push) considered processors, and what contractual terms are
    required?
18. What does the patient need to be told about your processing? Review our privacy policy against
    it.

### Payments and finance

19. Do we need a licence to accept payment for healthcare services?
20. Telebirr and CBE Birr: what merchant-account requirements, fees, and settlement cycles apply to
    a business that has not yet traded?
21. Do healthcare services attract VAT or other taxes, and does the treatment differ between
    clinical and non-clinical services?
22. What is the correct invoicing requirement, and is a sequential invoice number with tax details
    mandatory?
23. Any restriction on receiving payment into a personal account rather than a business account?

### Employment and liability

24. Are caregivers employees, contractors, or a third-party service? This determines
    withholding, social security, and liability.
25. What does a caregiver confidentiality agreement need to contain?
26. What is your liability if a caregiver causes harm during a visit? What insurance is required?
27. What are the working-time, rest, and leave obligations for caregivers?
28. Are there restrictions on how much care one caregiver may provide to the same patient?

### The questions only you can answer

29. What is our written clinical escalation policy?
30. What is our written policy on notifying customers of incidents involving their relative?
31. What is our written policy on customers booking care for a non-consenting patient?
32. What is our written policy on caregiver refusal of a patient for non-clinical reasons? We
    record decline reasons; what do we do with a pattern of refusals about one customer?
33. What is our written policy on staff access to patient data, and how do we enforce it beyond
    technical controls?

## 4. Part 3 — Launch gate

Do not launch until every line is ticked with evidence.

### Legal and compliance

- [ ] Business registered
- [ ] Required licence obtained and current
- [ ] Legal sign-off on clinical scope, data protection, and payments
- [ ] Insurance in force: professional liability, public liability, employer
- [ ] Caregiver agreements signed, with confidentiality clauses
- [ ] Background checks completed where required
- [ ] Data-protection obligations met, including any registration
- [ ] Vendor data-processing terms signed
- [ ] Accountant confirmed the tax position
- [ ] Privacy policy and terms written, versioned, published
- [ ] Consent copy reviewed by a lawyer, health-data consent separate

### Clinical

- [ ] Clinical Supervisor appointed and their authority documented
- [ ] Care-checklist template written for every service
- [ ] Supplies template written for every service
- [ ] Vital-sign ranges configured and reviewed
- [ ] Escalation matrix configured and rehearsed
- [ ] Wound-photo consent basis decided and implemented
- [ ] Every caregiver's licence verified against the issuing authority, with the verification
      recorded
- [ ] Incident policy written, and the escalation path tested end to end
- [ ] Emergency contact number verified and current
- [ ] Urgent-care number verified, staffed, and labelled as not-an-emergency

### Security

- [ ] Every checklist item in [11-security](11-security.md) § 14 verified with evidence
- [ ] Independent penetration test passed, findings triaged
- [ ] Encryption verified by inspecting raw table data, not by reading code
- [ ] Key rotation tested
- [ ] Backup restore rehearsed and timed
- [ ] Audit log append-only enforced, hash chain verified
- [ ] Clinical read logging complete and queryable
- [ ] Admin 2FA enforced
- [ ] Rate limits verified, including the SMS spend cap
- [ ] Certificate pinning active
- [ ] `STRICT_CLINICAL_ACCESS` flag enabled, so gaps fail closed

### Operations

- [ ] Caregiver recruitment and onboarding process working
- [ ] Dispatcher trained on the queue, assignment, and the exception runbooks
- [ ] Finance trained on the claim queue and reconciliation
- [ ] Every runbook in [13](13-infrastructure.md) § 8 written and read by the person who will use it
- [ ] Caregiver no-show runbook rehearsed
- [ ] Bad-notification-template kill switch tested
- [ ] Support process defined: hours, channel, response expectations
- [ ] Office telephone, and a plan for when it is not answered
- [ ] Escalation contact list, current

### Commercial

- [ ] Price list approved and loaded, with effective dates
- [ ] Surcharges configured
- [ ] Transport charges per sub-city, from real data
- [ ] Cancellation and refund policy published in the app
- [ ] Overtime billing policy published
- [ ] Bank account and mobile-money accounts live
- [ ] Receipt template with your details
- [ ] Payment instruction text tested by someone who has never seen it

### Product quality

- [ ] Every release gate in [14](14-testing.md) § 11 passed
- [ ] Amharic reviewed by a fluent speaker, clinical copy by a clinician
- [ ] Accessibility pass complete on both apps and the dashboard
- [ ] Tested on the lowest-cost Android device your caregivers actually use, outdoors
- [ ] Offline flows tested with real network conditions
- [ ] Two consecutive weeks of beta with documentation compliance above 95%
- [ ] Two consecutive weeks with zero PHI incidents
- [ ] Crash-free rate above 99.5%
- [ ] Fill rate above 80%
- [ ] No unresolved severity-1 or severity-2 defects

### Measurement

- [ ] Business dashboard live: requests, fill rate, unassigned age, utilisation
- [ ] Documentation compliance monitored daily
- [ ] Notification delivery monitored per channel
- [ ] Finance reconciliation running daily
- [ ] Metrics from [01](01-product-scope.md) § 7 tracked from day one
- [ ] A weekly 30-minute review scheduled, with the metrics printed

## 5. Part 4 — First 30 days after launch

Watch these more closely than anything else in the first month, because they are the earliest
signals that something is structurally wrong.

| Week | Focus | Watch for |
|---|---|---|
| 1 | Reliability and support load | Crashes, support call volume and topic, any missed visit caused by a notification failure |
| 2 | Dispatch efficiency | Unassigned age, time-to-assign, assignment attempts per appointment |
| 3 | Documentation quality | Visit-record completion rate. If it is under 90%, the form is too long |
| 4 | Commercial reality | Revenue per visit hour against your estimate, fill rate, cancellation rate, outstanding balances |

Three early warnings worth naming specifically:

**Unassigned appointments age beyond 4 hours regularly.** You do not have enough caregiver capacity,
or your eligibility rules are too tight. Add capacity before you add features.

**Documentation compliance below 90%.** Caregivers are skipping the notes. Shorten the form before
you add anything to it. Missing documentation is a compliance failure, and it will surface in the
first audit or the first dispute.

**Support calls dominated by "where is my caregiver".** The status communication is not working.
Improve the timeline and the notifications before you assume customers are anxious by nature.

And one thing to do deliberately: **talk to ten caregivers and ten customers every week for the
first three months.** Not surveys. Conversations. The information you need is in what they say
unprompted, and no amount of analytics substitutes for it.

## 6. Open items log

Keep this in the repository as a living file. Every scope question that gets deferred belongs
here, with an owner and a date, so that "phase 2" is a plan rather than an excuse.

| Item | Owner | Target | Status |
|---|---|---|---|
| *(Add rows as questions are answered or deferred)* | | | |