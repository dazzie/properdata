# ProperData — Solo Operator Architecture and Build Plan

**Principle:** Maximum cloud services, minimum operational overhead, zero servers to manage.
**Date:** April 2026

---

## 1. Architecture philosophy for one person

You have one scarce resource: your time. Every hour spent managing infrastructure is an hour not spent writing analysis, building agents, or acquiring subscribers. The architecture must be:

1. **Fully managed** — no servers to SSH into, no Docker containers to restart at 3am, no OS patches to apply
2. **Scale-to-zero** — pay nothing when idle, scale automatically when busy
3. **Event-driven** — pipelines run on schedules or triggers, not on always-on compute
4. **Composable** — each component can be replaced independently without rewriting the system
5. **Observable** — when something breaks (it will), you find out immediately and can diagnose from your phone

---

## 2. Cloud architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│                    SUBSCRIBER INTERFACE                      │
│                                                             │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ Substack  │  │ Next.js app  │  │ MCP server            │ │
│  │ (Phase 1) │  │ (Phase 3)    │  │ (Phase 3)             │ │
│  │ Free      │  │ Vercel free  │  │ Vercel serverless     │ │
│  └───────────┘  └──────────────┘  └───────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────┐
│                    API LAYER                                │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Next.js API routes (Vercel serverless functions)    │   │
│  │  Auth: Clerk │ Payments: Stripe │ Rate limit: Upstash│   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────┐
│                    INTELLIGENCE LAYER                       │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Agent code  │  │  Scheduled   │  │  Anthropic API   │  │
│  │  (Vercel     │  │  pipelines   │  │  (Claude Haiku + │  │
│  │  serverless  │  │  (n8n Cloud  │  │   Sonnet)        │  │
│  │  or Vercel   │  │  or Trigger  │  │                  │  │
│  │  Cron)       │  │  .dev)       │  │                  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────┐
│                    DATA LAYER                               │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Neon Postgres (PostGIS + pgvector)                  │   │
│  │  Scale-to-zero, $5/month minimum                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Upstash     │  │  Cloudflare  │  │  Vercel Blob     │  │
│  │  Redis       │  │  R2          │  │  (or R2)         │  │
│  │  (cache)     │  │  (PDFs,      │  │  (images,        │  │
│  │  Free tier   │  │  reports)    │  │  charts)         │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────┐
│                    MONITORING + ALERTS                      │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Sentry      │  │  Vercel      │  │  Slack webhook   │  │
│  │  (errors)    │  │  Analytics   │  │  (pipeline       │  │
│  │  Free tier   │  │  Free        │  │  failures)       │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Service selection — every component justified

### 3.1 Database: Neon Postgres (PostGIS + pgvector)

**Why Neon over Railway/Supabase/RDS:**
- Scale-to-zero: when nobody is querying, compute cost is $0. Your ingestion runs a few times per day; the database is idle 95% of the time. This matters enormously for Phase 1-2 when traffic is low.
- PostGIS and pgvector both supported as extensions — no workarounds needed for spatial queries or future vector search
- Database branching for testing schema changes without touching production
- Serverless driver works natively with Vercel edge functions — no connection pooling headaches
- $5/month minimum on the Launch plan, $0.106/CU-hour compute, $0.35/GB-month storage

**Estimated cost:**
- Phase 1 (light usage, <1GB data, sporadic queries): $5-10/month
- Phase 2 (moderate usage, 2-5GB data, daily queries): $15-30/month
- Phase 3 (production, 5-20GB, concurrent subscribers): $40-80/month

**Schema setup:** Same as the architecture spec — sales, listings (when partnership secured), rentals (RTB-derived), planning, towns, grant_schemes, events, subscribers, with PostGIS geometry columns and materialised views for town_metrics.

### 3.2 Orchestration: n8n Cloud (Starter) or Vercel Cron

**The n8n decision:**

You already have n8n running locally with Docker. The question is: self-host in the cloud or use n8n Cloud?

**Option A: n8n Cloud Starter (€20/month)**
- 2,500 executions/month — enough for Phase 1 (daily scrapers × 10 towns = ~300 executions, plus weekly analysis workflows = ~350 total/month)
- Zero infrastructure management
- Visual workflow builder for non-code pipeline changes
- Managed OAuth for integrations

**Option B: Self-hosted n8n on a managed host ($3-7/month)**
- Unlimited executions
- Full control
- Requires a VPS or managed n8n host (PikaPods, InstaPods, or a $7/month DigitalOcean droplet)
- You manage updates and backups (minimal but non-zero time)

**Option C: Vercel Cron + serverless functions (no additional cost)**
- Use Vercel's built-in cron jobs to trigger serverless functions on a schedule
- Each function handles one pipeline (PPR ingest, BER refresh, planning scrape)
- No visual workflow builder — it's all code
- Free within Vercel's hobby/pro tier limits
- Simpler stack (one fewer service) but less flexible for ad-hoc workflows

**Recommendation for solo operator:** Start with **Option C (Vercel Cron)** for Phase 1 to minimise services. Your pipelines are well-defined and code-driven — you don't need a visual workflow builder yet. Move to **n8n Cloud** in Phase 2 when pipeline complexity grows and you want to iterate visually on workflows without deploying code.

### 3.3 Web app and API: Next.js on Vercel

**Why Next.js + Vercel:**
- App Router with server components means the API and web app are a single codebase
- API routes run as serverless functions — no always-on server
- Vercel's free tier is generous enough for Phase 1-2 (100GB bandwidth, serverless function invocations)
- Native integration with Neon (Vercel Postgres marketplace)
- Built-in cron jobs (vercel.json or via the dashboard)
- Edge functions for low-latency subscriber-facing queries
- Preview deployments for testing

**Estimated cost:**
- Phase 1-2: $0 (free tier)
- Phase 3: $20/month (Pro tier for more bandwidth, longer serverless execution times)

### 3.4 Authentication: Clerk

**Why Clerk:**
- Drop-in auth for Next.js with zero custom code
- Handles email/password, social login, magic links
- Built-in user management dashboard
- Webhook for syncing user data to your database
- Free for up to 10,000 monthly active users
- Stripe integration for billing

**Estimated cost:** $0 for Phase 1-2. $25/month at scale.

### 3.5 Payments: Stripe (via Substack initially)

**Phase 1-2:** Substack handles all payment processing. They take 10% of paid subscription revenue + Stripe's 2.9% + 30¢. You don't touch Stripe directly.

**Phase 3:** When you build the web app and need direct billing (Pro tier, Enterprise, API access), integrate Stripe directly via Clerk's billing integration or Stripe Checkout.

### 3.6 Cache: Upstash Redis

**Why Upstash:**
- Serverless Redis — scale-to-zero, pay-per-request
- Free tier: 10,000 requests/day, 256MB storage
- Perfect for caching town metrics, rate limiting API calls, and queuing events

**Estimated cost:** $0 for Phase 1-2. $10/month at scale.

### 3.7 Object storage: Cloudflare R2

**Why R2:**
- S3-compatible API
- Zero egress fees (this matters for serving PDFs and chart images to subscribers)
- Free tier: 10GB storage, 1M reads/month
- Use for: generated PDF reports, chart images, CSV data packs, archived newsletter content

**Estimated cost:** $0 for Phase 1. $5-15/month at scale.

### 3.8 Email: Substack (Phase 1-2) → Resend (Phase 3)

**Phase 1-2:** Substack handles all email delivery. No transactional email needed.

**Phase 3:** When you need personalised alerts, subscriber-specific weekly briefs, and transactional emails (password reset, payment receipts), use Resend.
- Free tier: 100 emails/day, 3,000/month
- $20/month for 50,000 emails/month
- React-native email templates via react-email
- Vercel integration

### 3.9 AI: Anthropic API (Claude Haiku + Sonnet)

**Model allocation:**
- Haiku: normalisation, classification, anomaly detection, orchestration, social content
- Sonnet: comparable analysis, yield calculation, grant assessment, newsletter drafting, subscriber agent

**Estimated cost:** $8-10/month for Phase 1-2 (see detailed breakdown in architecture spec). $40-60/month for Phase 3 with subscriber agent.

### 3.10 Monitoring: Sentry + Vercel Analytics

**Sentry** (free tier): Error tracking for serverless functions. Get Slack alerts when a pipeline fails.

**Vercel Analytics** (free): Basic web analytics. No need for a separate analytics tool in Phase 1.

**PostHog** (free tier, Phase 3): Product analytics when the web app launches — funnel analysis, feature usage, retention. Free for 1M events/month.

### 3.11 Scraping: Browserless.io or Playwright via serverless

For ePlanning portal scraping (the only scraping in the public-data stack), you need headless browser capability.

**Option A: Browserless.io** — managed headless Chrome API. Free tier: 1,000 sessions/month. $20/month for 10,000. You send a URL and a script, they run Playwright/Puppeteer and return results. Zero infrastructure.

**Option B: Playwright in Vercel serverless** — works for simple scrapes but Vercel's 10-second serverless function timeout (60 seconds on Pro) can be tight for slow council websites.

**Option C: Apify** — web scraping platform with scheduled actors. Free tier: $5/month of compute. Good for recurring scheduled scrapes.

**Recommendation:** Start with **Browserless.io** or **Apify** — both remove the operational burden of running headless browsers.

---

## 4. Total cloud cost by phase

### Phase 1 — Newsletter MVP (Months 1-3)

| Service | Purpose | Monthly cost |
|---|---|---|
| Neon Postgres | Database (PostGIS) | $5 |
| Vercel | Web app + API + cron jobs | $0 |
| Substack | Newsletter delivery + payments | $0 (10% of revenue) |
| Anthropic API | AI agents | $8 |
| Upstash Redis | Cache + rate limiting | $0 |
| Cloudflare R2 | PDF/chart storage | $0 |
| Sentry | Error monitoring | $0 |
| Browserless.io | ePlanning scraping | $0 |
| Clerk | Auth (Phase 3 prep) | $0 |
| Domain (properdata.ie) | DNS | $2 |
| **Total** | | **~$15/month** |

### Phase 2 — Paid subscriptions (Months 4-9)

| Service | Purpose | Monthly cost |
|---|---|---|
| Neon Postgres | Database (growing data) | $15 |
| Vercel | Web app + API + cron | $0 |
| Substack | Newsletter + payments | $0 + 10% of revenue |
| n8n Cloud Starter | Pipeline orchestration (upgrade from Vercel cron) | $20 |
| Anthropic API | More agent calls | $12 |
| Upstash Redis | Cache | $0 |
| Cloudflare R2 | Reports + exports | $5 |
| Sentry | Error monitoring | $0 |
| Browserless.io | Scraping | $20 |
| GeoDirectory licence (amortised) | Geocoding + vacancy data | $30 |
| Domain | DNS | $2 |
| **Total** | | **~$104/month** |

### Phase 3 — SaaS product (Months 10-18)

| Service | Purpose | Monthly cost |
|---|---|---|
| Neon Postgres | Production database | $50 |
| Vercel Pro | Web app + API + edge functions | $20 |
| n8n Cloud Pro | Complex pipelines | $50 |
| Anthropic API | Subscriber agent + all agents | $60 |
| Upstash Redis | Cache + rate limiting + queues | $10 |
| Cloudflare R2 | Reports + exports + images | $15 |
| Clerk | Auth + user management | $25 |
| Stripe | Payment processing | 2.9% + 30¢ per txn |
| Resend | Transactional + alert emails | $20 |
| Sentry | Error monitoring | $0 |
| PostHog | Product analytics | $0 |
| Browserless.io | Scraping | $20 |
| GeoDirectory | Geocoding + vacancy | $30 |
| Mapbox | Maps for town explorer | $20 |
| Domain | DNS | $2 |
| **Total** | | **~$322/month** |

---

## 5. Monorepo structure

One repo, one deployment platform (Vercel), everything in TypeScript except the chart renderer.

```
properdata/
├── package.json                    # Root monorepo config (pnpm workspaces)
├── turbo.json                      # Turborepo build config
├── .env.example
├── vercel.json                     # Cron job definitions
│
├── apps/
│   ├── web/                        # Next.js app (Vercel deployment)
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx            # Landing page / marketing
│   │   │   ├── (marketing)/        # Public pages (pricing, about, etc.)
│   │   │   ├── (app)/              # Authenticated app pages
│   │   │   │   ├── dashboard/page.tsx
│   │   │   │   ├── towns/
│   │   │   │   │   ├── page.tsx    # Town explorer + map
│   │   │   │   │   └── [slug]/page.tsx  # Town detail
│   │   │   │   ├── analyst/page.tsx     # AI analyst chat
│   │   │   │   ├── grants/page.tsx      # Grant calculator
│   │   │   │   ├── tools/
│   │   │   │   │   ├── yield/page.tsx
│   │   │   │   │   ├── comparables/page.tsx
│   │   │   │   │   └── cost-of-ownership/page.tsx
│   │   │   │   └── settings/page.tsx
│   │   │   └── api/
│   │   │       ├── v1/             # Public API routes
│   │   │       │   ├── towns/route.ts
│   │   │       │   ├── sales/route.ts
│   │   │       │   ├── grants/route.ts
│   │   │       │   └── ...
│   │   │       ├── internal/       # Agent-to-agent endpoints
│   │   │       │   ├── normalise/route.ts
│   │   │       │   ├── events/route.ts
│   │   │       │   └── ...
│   │   │       ├── cron/           # Vercel cron job handlers
│   │   │       │   ├── ppr-ingest/route.ts
│   │   │       │   ├── ber-refresh/route.ts
│   │   │       │   ├── eplanning-scrape/route.ts
│   │   │       │   ├── metrics-refresh/route.ts
│   │   │       │   ├── weekly-pulse/route.ts
│   │   │       │   └── regulatory-scan/route.ts
│   │   │       └── webhooks/
│   │   │           ├── clerk/route.ts
│   │   │           ├── stripe/route.ts
│   │   │           └── substack/route.ts
│   │   ├── components/
│   │   ├── lib/
│   │   └── next.config.ts
│   │
│   └── mcp/                        # MCP server (Phase 3)
│       ├── src/
│       │   ├── server.ts
│       │   ├── tools/
│       │   └── resources/
│       └── package.json
│
├── packages/
│   ├── db/                         # Database client + queries
│   │   ├── src/
│   │   │   ├── client.ts           # Neon serverless driver config
│   │   │   ├── schema.ts           # Drizzle ORM schema
│   │   │   ├── queries/
│   │   │   │   ├── sales.ts
│   │   │   │   ├── towns.ts
│   │   │   │   ├── planning.ts
│   │   │   │   ├── grants.ts
│   │   │   │   ├── metrics.ts
│   │   │   │   └── subscribers.ts
│   │   │   └── migrations/
│   │   └── package.json
│   │
│   ├── agents/                     # All AI agent implementations
│   │   ├── src/
│   │   │   ├── normalise-sales.ts
│   │   │   ├── comparable-analysis.ts
│   │   │   ├── yield-analysis.ts
│   │   │   ├── grant-calculator.ts
│   │   │   ├── anomaly-detector.ts
│   │   │   ├── planning-parser.ts
│   │   │   ├── draft-writer.ts
│   │   │   ├── social-writer.ts
│   │   │   ├── regulatory-monitor.ts
│   │   │   ├── orchestrator.ts
│   │   │   └── subscriber-agent.ts
│   │   ├── prompts/                # System prompts as markdown files
│   │   │   ├── normalise-sales.md
│   │   │   ├── comparable-analysis.md
│   │   │   ├── grant-calculator.md
│   │   │   ├── weekly-pulse.md
│   │   │   └── subscriber-agent.md
│   │   └── package.json
│   │
│   ├── scrapers/                   # Data ingestion logic
│   │   ├── src/
│   │   │   ├── ppr.ts              # PPR CSV download + parse
│   │   │   ├── ber.ts              # SEAI BER data download
│   │   │   ├── eplanning.ts        # Council planning scrape (Browserless)
│   │   │   ├── cso.ts              # CSO StatBank API client
│   │   │   ├── rtb.ts              # RTB data parser
│   │   │   ├── flood.ts            # OPW flood map data
│   │   │   ├── rzlt.ts             # RZLT map data
│   │   │   └── geocoder.ts         # Nominatim + Eircode cascade
│   │   └── package.json
│   │
│   ├── charts/                     # Chart generation
│   │   ├── src/
│   │   │   ├── price-trend.ts      # Uses chart.js or similar
│   │   │   ├── town-comparison.ts
│   │   │   ├── yield-chart.ts
│   │   │   └── renderer.ts
│   │   └── package.json
│   │
│   └── shared/                     # Shared types + utilities
│       ├── src/
│       │   ├── types.ts
│       │   ├── events.ts
│       │   ├── constants.ts
│       │   └── utils.ts
│       └── package.json
│
├── db/
│   ├── seed/
│   │   ├── towns.sql               # Seed covered towns with coordinates
│   │   ├── grant-schemes.sql       # Seed all grant eligibility rules
│   │   └── lpt-bands.sql           # LPT valuation bands + LA adjustments
│   └── migrations/
│
└── docs/
    ├── architecture.md
    ├── data-dictionary.md
    ├── agent-prompts.md
    └── runbook.md
```

### Why Turborepo monorepo

- Single `pnpm install` — all packages share dependencies
- `turbo run build` builds everything in dependency order
- Shared TypeScript config, shared types between packages
- One Vercel project deploys the web app; packages are imported directly
- Easy to add new packages (e.g., `packages/email-templates` for Resend)

---

## 6. Cron jobs — the heartbeat of the system

All scheduled work runs as Vercel Cron Jobs. Each cron triggers a serverless function in `/apps/web/app/api/cron/`.

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/ppr-ingest",
      "schedule": "0 2 * * 0"
    },
    {
      "path": "/api/cron/ber-refresh",
      "schedule": "0 3 1 * *"
    },
    {
      "path": "/api/cron/eplanning-scrape",
      "schedule": "0 8 * * 1"
    },
    {
      "path": "/api/cron/cso-refresh",
      "schedule": "0 4 15 * *"
    },
    {
      "path": "/api/cron/metrics-refresh",
      "schedule": "0 6 * * *"
    },
    {
      "path": "/api/cron/regulatory-scan",
      "schedule": "0 7 * * *"
    },
    {
      "path": "/api/cron/weekly-pulse",
      "schedule": "0 14 * * 0"
    },
    {
      "path": "/api/cron/anomaly-detect",
      "schedule": "0 6 * * 1"
    }
  ]
}
```

| Cron | Schedule | What it does | Duration |
|---|---|---|---|
| `ppr-ingest` | Sunday 02:00 UTC | Download PPR CSV, diff against existing, normalise new records via Haiku, geocode, insert | 2-5 min |
| `ber-refresh` | 1st of month 03:00 | Download SEAI BER Research Tool dataset, parse, upsert | 3-10 min |
| `eplanning-scrape` | Monday 08:00 | Scrape ePlanning portals via Browserless.io for covered councils, classify via Haiku | 5-15 min |
| `cso-refresh` | 15th of month 04:00 | Pull latest CSO StatBank data (RPPI, population, employment) | 1-2 min |
| `metrics-refresh` | Daily 06:00 | Refresh materialised views (town_metrics, derived signals) | 1-3 min |
| `regulatory-scan` | Daily 07:00 | Check government pages for policy changes, hash comparison | 1-2 min |
| `weekly-pulse` | Sunday 14:00 | Assemble data → draft writer agent → save draft → Slack notification to review | 3-5 min |
| `anomaly-detect` | Monday 06:00 | Run anomaly detection on refreshed metrics | 1-2 min |

**Important:** Vercel hobby tier has a 10-second function timeout. For longer-running pipelines (PPR ingest, ePlanning scrape), you need Vercel Pro ($20/month) which gives 60-second timeout, or break the work into smaller chunks with chained function calls. Alternatively, use **Trigger.dev** (free tier: 10,000 runs/month) for long-running background jobs that can run for up to 5 minutes.

---

## 7. Data flow — from source to subscriber

```
Source          →    Cron/Trigger    →    Agent           →    Database        →    Output
───────────────────────────────────────────────────────────────────────────────────────────
PPR CSV              ppr-ingest          Haiku normalise       sales table         Weekly pulse
SEAI BER Excel       ber-refresh         Parse + insert        ber_ratings          BER premium analysis
ePlanning HTML       eplanning-scrape    Haiku classify        planning table       Planning tracker
CSO API              cso-refresh         Direct insert         cso_stats            Macro context
RTB PDF              Manual quarterly    Parse + insert        rtb_rents            Yield calculations
OPW ArcGIS           Initial load +      GeoJSON parse         flood_zones          Flood risk scoring
                     periodic refresh
RZLT maps            Annual (Jan)        GeoJSON parse         rzlt_parcels         RZLT pressure index
Grant rules          regulatory-scan     Haiku extract         grant_schemes        Grant calculator
Revenue LPT          Annual              Scrape/parse          lpt_bands            Total cost of ownership
PSRA agents          Monthly             Download Excel        psra_agents          Agent finder tool
School data          Annual              CSV parse             schools              School proximity
Broadband maps       Quarterly           Coverage parse        broadband            Digital commuter score
Census data          Static (2022)       CSO API               census_areas         Demographics

                                         ┌──────────────────────────────────────────────┐
                                         │            MATERIALISED VIEWS                │
                                         │                                              │
                                         │  town_metrics    (refreshed daily)            │
                                         │  heat_score      (refreshed weekly)           │
                                         │  value_gap       (refreshed quarterly)        │
                                         │  supply_pressure (refreshed monthly)          │
                                         │  grant_opportunity (refreshed quarterly)      │
                                         │  vacancy_opportunity (refreshed quarterly)    │
                                         └──────────────────────────────────────────────┘
                                                           │
                                         ┌─────────────────┼─────────────────┐
                                         │                 │                 │
                                         ▼                 ▼                 ▼
                                    Substack          Web app           MCP server
                                    newsletter        dashboard         external agents
                                    (Phase 1-2)       (Phase 3)         (Phase 3)
```

---

## 8. Build sequence — 20 weeks as a solo operator

### Sprint 0 — Foundation (Week 1)

**Time estimate: 2-3 days**

- [ ] Create Turborepo monorepo with pnpm workspaces
- [ ] Set up Neon project with PostGIS + pgvector extensions
- [ ] Write database schema (Drizzle ORM) for core tables: sales, towns, events, grant_schemes
- [ ] Seed towns table with 3 launch towns (Mullingar, Athlone, Tullamore) + coordinates
- [ ] Seed grant_schemes table with all SEAI + Croí Cónaithe + Revenue schemes
- [ ] Deploy Next.js app to Vercel with basic health check route
- [ ] Set up Sentry for error tracking
- [ ] Configure environment variables in Vercel

**Deliverable:** Empty database with schema, deployed app, CI/CD working.

### Sprint 1 — PPR Pipeline (Week 2-3)

**Time estimate: 4-5 days**

- [ ] Build PPR ingestion cron: download CSV, parse, deduplicate by hash
- [ ] Build normalisation agent (Haiku): address parsing, town extraction, county validation
- [ ] Build geocoding cascade: Nominatim → town centroid fallback
- [ ] Load historical PPR data for covered towns (2020-present)
- [ ] Build materialised view: town_metrics (median price, sales count, YoY change)
- [ ] Build API route: GET /api/v1/towns/:slug/metrics
- [ ] Verify: query "What's the median price in Mullingar?" returns correct data

**Deliverable:** Working PPR pipeline, town metrics API, historical data loaded.

### Sprint 2 — Comparable Analysis Agent (Week 4-5)

**Time estimate: 5-6 days**

- [ ] Build PostGIS spatial query: find sales within radius of coordinates
- [ ] Build comparable analysis agent (Sonnet): rank comps, assess fair value, generate narrative
- [ ] Build API route: POST /api/v1/comparables
- [ ] Build grant calculator agent: total package computation with stacking rules
- [ ] Build API route: POST /api/v1/grants/calculate
- [ ] Test: "What are comps for a 3-bed in Mullingar at €345K?" returns ranked analysis
- [ ] Test: "What grants for a D-rated vacant semi built 1995?" returns full package

**Deliverable:** Core intelligence layer working — comps + grants.

### Sprint 3 — Content Pipeline + Substack Launch (Week 6-8)

**Time estimate: 8-10 days**

- [ ] Write launch piece 1: "What Mullingar houses actually sold for"
- [ ] Write launch piece 2: "The asking price illusion"
- [ ] Write launch piece 3: "Ireland's hidden property hotspot"
- [ ] Set up Substack with custom domain (properdata.substack.com → properdata.ie)
- [ ] Design branded chart template (for Python matplotlib or chart.js)
- [ ] Build draft writer agent: takes weekly data → generates newsletter markdown
- [ ] Build chart generation pipeline: town metrics → chart images → R2 storage
- [ ] Build weekly pulse cron: assembles data, runs draft writer, saves to staging
- [ ] Build Slack notification on draft ready for review
- [ ] Publish launch pieces. Begin weekly cadence.

**Deliverable:** Live Substack, 3 launch pieces published, automated weekly draft pipeline.

### Sprint 4 — Planning + BER + Enrichment (Week 9-11)

**Time estimate: 6-8 days**

- [ ] Build ePlanning scraper via Browserless.io (Westmeath, Offaly, Laois, Longford)
- [ ] Build planning classification agent (Haiku): extract units, type, decision
- [ ] Build BER data ingestion: SEAI Research Tool Excel → Postgres
- [ ] Build BER premium analysis: cross-reference BER ratings with PPR sales
- [ ] Build yield calculator agent: PPR prices + RTB rents + full cost model
- [ ] Build regulatory monitoring cron: daily hash check on key government pages
- [ ] Add planning + BER + yield sections to weekly pulse template
- [ ] Expand coverage to 6 towns

**Deliverable:** Planning tracker, BER analysis, yield calculator all operational.

### Sprint 5 — Paywall + Pro Tier (Week 12-14)

**Time estimate: 5-7 days**

- [ ] Activate Substack paid tier (Insider at €15/month or €129/year)
- [ ] Design paywall content split (free summary vs paid full analysis)
- [ ] Launch founding member programme (€89/year)
- [ ] Build PDF report generator (for Pro tier branded reports)
- [ ] Build CSV export pipeline (for Pro tier data packs)
- [ ] Begin professional outreach: email 50 Midlands auctioneers with sample report
- [ ] Add grant calculator as interactive tool on properdata.ie (ungated lead magnet)
- [ ] Social media writer agent: generate Twitter threads from weekly pulse

**Deliverable:** Revenue generating. Founding members onboarding. Pro tier available.

### Sprint 6 — Data Enrichment (Week 15-17)

**Time estimate: 6-8 days**

- [ ] Ingest OPW flood map data (GeoJSON into PostGIS flood_zones table)
- [ ] Build flood risk scoring: distance from flood extent → risk flag per property
- [ ] Ingest Census 2022 data for covered towns: demographics via CSO StatBank API
- [ ] Build commute time calculation: Google Maps / TFI Journey Planner API
- [ ] Ingest broadband coverage data for covered towns
- [ ] Build composite signals: heat score, digital commuter score, supply pressure
- [ ] Build "total cost of ownership" calculator
- [ ] Ingest PSRA agent register: build "Find a Licensed Agent" free tool
- [ ] Add school data for covered towns
- [ ] Expand coverage to 10 towns

**Deliverable:** Full enrichment layer operational. Town DNA profiles complete.

### Sprint 7 — Web App MVP (Week 18-20)

**Time estimate: 8-10 days**

- [ ] Build authenticated app shell with Clerk
- [ ] Build town explorer page with Mapbox map
- [ ] Build town detail page (metrics, charts, recent sales, planning, grants)
- [ ] Build interactive grant calculator (React component)
- [ ] Build interactive yield calculator
- [ ] Build subscriber dashboard (watched towns, alerts, saved searches)
- [ ] Integrate Stripe for Pro tier billing (bypass Substack for direct subscribers)
- [ ] Build MCP server with core tools (town metrics, search sales, calculate grants)
- [ ] Deploy MCP server to Vercel serverless

**Deliverable:** Web app live. MCP server operational. Phase 3 begun.

---

## 9. What you DON'T build (and why)

| Thing | Why not |
|---|---|
| **Custom auth system** | Clerk handles it. Your time is worth more than building login flows. |
| **Custom email delivery** | Substack in Phase 1-2, Resend in Phase 3. Never build email infrastructure. |
| **Custom payment processing** | Substack handles it. Stripe for Phase 3. |
| **Docker containers** | Vercel serverless eliminates container management entirely. |
| **CI/CD pipeline** | Vercel's GitHub integration is the CI/CD. Push to main = deploy. |
| **Custom monitoring dashboard** | Sentry + Vercel Analytics. Don't build what you can subscribe to. |
| **Mobile app** | The web app is responsive. A PWA is fine for Phase 3. Native app is a Phase 4 consideration. |
| **Custom CMS** | Substack IS the CMS for the newsletter. The web app's content comes from the database. |
| **Admin dashboard** | Use Drizzle Studio (built into Neon) or a simple protected page in the Next.js app for editorial review. |
| **Custom scraping infrastructure** | Browserless.io or Apify. Don't manage headless Chrome. |

---

## 10. Day-in-the-life of the solo operator

### Daily (15 minutes)
- Check Slack for pipeline failure alerts (Sentry → Slack webhook)
- Glance at Vercel deployment status
- Reply to any subscriber Q&A emails

### Weekly (3-4 hours, Sunday)
- Review automated weekly pulse draft (generated by Sunday 14:00)
- Edit for tone, add local colour, approve for publication
- Schedule Substack publish for Sunday evening
- Post Twitter data thread
- Review any anomaly alerts from the week

### Monthly (half day)
- Write monthly town deep-dive (the editor selects which town, the agent drafts, the editor polishes)
- Review subscriber metrics: growth, churn, open rate, conversion
- Update grant scheme data if any policy changes were flagged by regulatory monitor
- Expand to next coverage town (add to towns table, let pipelines auto-ingest)

### Quarterly (full day)
- Run town ranking index computation
- Write quarterly analysis report
- Review and adjust pricing if needed
- Professional outreach: contact 10 new auctioneers/brokers

The system runs itself 90% of the time. Your job is editorial quality, subscriber acquisition, and strategic direction — not infrastructure management.
