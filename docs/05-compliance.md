# 05 — Compliance

This document captures the regulatory obligations that affect ProperData's product, code, and operational decisions. Read before adding a new data source, surfacing a new analytical output, or modifying any subscriber-facing AI generation.

**Disclaimer**: This is internal product documentation, not legal advice. Engage a solicitor (€500-1,000 budget pre-launch) to review the privacy policy, terms of service, and data processing register before commercial launch.

---

## 1. GDPR (highest operational priority)

### Lawful basis for processing

ProperData processes personal data from the Property Price Register (PPR), which contains addresses linked to property transactions. Addresses are personal data because they can identify individuals (homeowners, sellers, buyers).

**Lawful basis**: Article 6(1)(f) GDPR — legitimate interests, specifically:
- Research and journalistic purposes (Recital 153)
- Provision of analytical services to subscribers and the public

A **Legitimate Interest Assessment (LIA)** must be documented before launch. The LIA balances:
- **Purpose**: market transparency, informed buyer/investor decisions, public interest in property data
- **Necessity**: PPR data is the only authoritative source of completed sale prices in Ireland
- **Balancing test**: data is already public; we don't expand its reach materially; we anonymise specific addresses in subscriber-facing content (street + town only, no door numbers)

### Data minimisation

- Subscriber data: collect only email and tier; persona/intent are optional opt-ins
- PPR data: store full address in `address_raw` (required for deduplication and analysis) but never publish full addresses in subscriber content
- Computed fields: derive what we need (town, county, property type) and reference; don't enrich beyond necessity

### Data subject rights

Implement before public launch:
- **Right to access** (subscribers can request export of their account data)
- **Right to erasure** (subscribers can delete their account; PPR-derived data is not subscriber data and is retained as published public information)
- **Right to rectification** (corrections to subscriber data on request; PPR errors must be referred to the PSRA)
- **Right to object** to processing (subscribers can opt out of personalisation)

### Record of Processing Activities (ROPA)

Required under Article 30 GDPR. Maintain a document listing:
- Each processing activity (PPR ingestion, BER ingestion, subscriber email, etc.)
- Lawful basis for each
- Categories of data
- Retention period
- Recipients (Anthropic for AI inference, Sentry for error monitoring, etc.)
- Data transfers outside the EEA (e.g., Anthropic API processes in US — covered by SCCs)

### Subprocessors

Document and surface in privacy policy:
- **Anthropic** (US) — AI inference. Data processed: subscriber queries, derived analytical outputs.
- **Vercel** (US) — application hosting. Data processed: HTTP requests including any user-submitted data.
- **Neon** (EU) — database hosting (eu-west-2 region recommended for data residency).
- **Sentry** (US) — error monitoring. Data processed: error contexts may incidentally include user identifiers.
- **Upstash** (EU/Global) — caching layer. Data processed: cached query results.
- **Cloudflare R2** — storage. Data processed: generated PDFs, charts.
- **Substack** (US) — newsletter delivery (Phase 1-2). Data processed: subscriber email + content.
- **Stripe** (Phase 3) — payment processing. Data processed: payment-related personal data.
- **Clerk** (Phase 3) — authentication. Data processed: user account data.

### Data transfer mechanism

For transfers to non-EEA countries (US-based services), rely on:
- EU-US Data Privacy Framework (Anthropic, Vercel, Sentry, Stripe, Clerk are all certified or covered)
- Standard Contractual Clauses (SCCs) where DPF doesn't apply
- Data Processing Addendums in each subprocessor's terms

### Cookie / tracking compliance

Phase 1-2 (Substack-driven): minimal tracking on properdata.ie itself. No marketing cookies without explicit consent.

Phase 3+ (web app): full cookie banner with granular consent, including:
- Essential (auth, session) — no consent needed
- Analytics (PostHog) — opt-in
- Marketing — opt-in

---

## 2. EU AI Act (effective Aug 2026 for transparency provisions)

ProperData is a **limited-risk AI system** under the EU AI Act:
- AI generates content for human-facing newsletters and analytical responses
- Not a high-risk use case (not employment screening, not law enforcement, not credit scoring)
- Not a prohibited use case (no manipulation, no social scoring)

### Article 50 transparency obligations (apply from August 2026)

Required for limited-risk systems that interact with humans or generate content:

**For chatbots / interactive AI** (the AI analyst feature, Phase 3):
- Subscribers must be informed they are interacting with AI
- Notice should be displayed before the interaction begins, not buried in TOS

**For AI-generated content** (newsletters, analytical reports):
- Output must be flagged as AI-generated where it would otherwise be mistaken for human-authored
- Watermarking is recommended but not yet mandated for text outputs (different rules apply for synthetic image/audio/video)
- ProperData's compliance posture: footer notice on newsletters and inline notice on web app analytical outputs

The canonical disclaimer text is in `packages/shared/src/disclaimers.ts` as `DISCLAIMERS.aiTransparency`. Changes to this text need legal review.

---

## 3. Financial advice regulation (Central Bank of Ireland)

### The boundary

Providing financial advice in Ireland — including investment advice, mortgage advice, and insurance advice — requires authorisation by the Central Bank of Ireland.

**ProperData provides data analysis, not financial advice.** This is a deliberate, structural choice that affects every subscriber-facing output.

### What's permitted

- Stating market data: "The median 3-bed semi in Mullingar sold for €312,500"
- Computing yields from public data: "Based on RTB rents, gross yield is 5.8%"
- Surfacing comparable properties: "These 8 sales are most comparable to the target property"
- Calculating grant eligibility: "This buyer scenario qualifies for €73,150 in grants"
- Providing factual context: "The Vacant Property Grant requires 2+ years of vacancy"

### What's not permitted

- Recommending a specific property as a "good investment"
- Telling subscribers when to buy or sell
- Comparing investment options ("property is better than stocks")
- Predicting future prices or rents
- Specific tax positioning advice ("structure your investment as X to save tax")
- Mortgage product recommendations
- Insurance recommendations

### Implementation in code

- Every analytical agent prompt includes a "what you do not do" section that prohibits advisory verbs
- Every analytical output appends `DISCLAIMERS.general` (or `.yield`, `.grant`)
- The `compliance-reviewer` sub-agent flags any new content surface that lacks proper disclaimers

If a subscriber asks for advice (e.g., "should I buy this?"), the AI analyst must respond with data and refer them to a qualified advisor — not provide an answer.

---

## 4. Consumer protection (B2C subscriptions)

When ProperData moves to direct billing in Phase 3 (off Substack, onto Stripe), the following Irish/EU consumer protection rules apply:

- **14-day cooling-off period**: subscribers can cancel within 14 days for a full refund (unless they've consumed the service, e.g., received the newsletter)
- **Pre-contract information**: total price, billing frequency, cancellation method must be clearly disclosed before subscription
- **Automatic renewal disclosure**: upcoming renewals must be notified in advance
- **Easy cancellation**: cancellation must be at least as easy as subscribing (Article 16 EU Digital Services Act-adjacent)
- **VAT registration**: required at €42,500 turnover threshold for services

Substack handles this in Phase 1-2. In Phase 3, ProperData becomes the data controller and must implement the above.

---

## 5. Copyright and database rights

### Public data

- PPR, RTB, CSO, SEAI, OPW, EPA: government-published, generally permitted to use under their respective open data terms or "public sector information" rules
- Always verify the specific licence on the source page
- Attribution may be required for some sources (CSO requests attribution; OSM requires it)

### EU Database Directive

The 1996 EU Database Directive grants sui generis rights to creators of databases that involved "substantial investment". Daft and MyHome have potential claims under this directive over their listings databases — another reason the listing-site rule is non-negotiable.

### Our own outputs

ProperData's derived analyses, narratives, and signals are our intellectual property. The agent prompts in particular are confidential — they encode the product's voice and methodology. Don't open-source them without commercial review.

### Web fetches

When the AI analyst or other tools fetch web content, copyright rules apply:
- No reproducing more than 15 words verbatim from a single source
- One quote per source maximum
- Always paraphrase
- Cite sources where relevant

---

## 6. Company and trademark

### Company structure

A limited company (Ltd) is recommended for:
- Liability protection (separates personal and business assets)
- Tax efficiency at scale (12.5% corporation tax on trading income)
- Investor readiness (limited companies can issue equity)

Setup cost: ~€100-200 via CRO, plus ~€500-1,000 for solicitor on initial constitution and shareholder agreement.

### VAT

Threshold: €42,500 turnover for services. Below this, VAT registration is optional. Above, it's mandatory.

For a SaaS product selling primarily to Irish consumers, VAT registration is unavoidable past the threshold.

### Trademark

Recommended to file "ProperData" with the IPOI (Intellectual Property Office of Ireland):
- Cost: ~€230 for one class
- Class 9 (software) and Class 42 (SaaS) are most relevant
- File before national-scale launch to prevent passing-off claims

### Domain

`properdata.ie` (or alternative) should be registered before any public mention of the brand. The .ie registry requires demonstration of Irish connection — usually straightforward for a registered Irish company.

---

## 7. Pre-launch checklist

Before opening the product to paying customers:

- [ ] Privacy policy reviewed by solicitor (€500-1,000)
- [ ] Terms of service reviewed by solicitor
- [ ] LIA documented for PPR processing
- [ ] ROPA created and maintained
- [ ] Subprocessor list published in privacy policy
- [ ] Data Processing Agreements (DPAs) in place with all subprocessors
- [ ] AI transparency notice live (footer + web app)
- [ ] Disclaimers visible on all analytical outputs
- [ ] Cookie banner implemented (Phase 3)
- [ ] Limited company registered
- [ ] Trademark application filed
- [ ] VAT registered (or threshold-monitored)
- [ ] Bank account opened in company name
- [ ] Professional indemnity insurance in place (recommended)
- [ ] Cyber liability insurance in place (recommended)

---

## When to escalate to a solicitor

In addition to the pre-launch review, escalate when:

- Adding a new data source whose licensing isn't clear from the page
- A subscriber raises a GDPR complaint or right-of-access request
- A subscriber alleges the product gave them advice they relied on to their detriment
- A government body queries the data processing
- Anyone (data source operator, individual whose data appears) sends a takedown or cease-and-desist
- Considering a feature that approaches the financial advice boundary (e.g., portfolio recommendations)

The compliance-reviewer sub-agent in `.claude/agents/` provides first-pass review of code changes against this framework, but cannot substitute for legal advice on novel situations.
