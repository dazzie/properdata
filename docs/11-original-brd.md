# Irish Midlands Property Intelligence — Business Requirements Document

**Product working name:** MidlandsProperty.ie (or: The Midlands Property Analyst)
**Author:** Darren
**Version:** 0.1 — Draft
**Date:** March 2026

---

## 1. Vision and strategic context

### 1.1 Problem statement

Ireland's property market outside Dublin is experiencing the fastest price growth nationally (~15% YoY in the Midlands as of early 2026), yet there is no dedicated, data-driven research product covering this market segment. Existing coverage is either national/macro (Savills, JLL, ESRI), Dublin-centric (Daft reports, Irish Times property), or fragmented across local newspaper articles and auctioneer commentary. Buyers, investors, and property professionals in the Midlands corridor (Mullingar, Athlone, Tullamore, Longford, Carlow, Kilkenny) are making decisions worth hundreds of thousands of euros with poor market intelligence.

### 1.2 Opportunity

- **Midlands as fastest-growing Irish property region** — 15% house price growth, outpacing Dublin (6%) and national average (7.4%)
- **Commuter belt expansion** — remote/hybrid work driving Dublin workers to towns with 50-75 min M4/M6 access
- **Severe rental undersupply** — 8 listings in Mullingar at any given time; 50-60 applicants per property
- **Regulatory disruption** — March 2026 rent reset rules, RZLT (Residential Zoned Land Tax), HAP threshold pressure creating confusion and opportunity
- **Diaspora demand** — Irish abroad seeking investment opportunities at home, with poor visibility into regional markets
- **No incumbent** — no paid, recurring, data-driven property intelligence product exists for this segment

### 1.3 Product phases

| Phase | Model | Target | Timeline |
|-------|-------|--------|----------|
| **Phase 1 — Content MVP** | Free Substack + gated premium | Prove demand, build subscriber base | Months 1–3 |
| **Phase 2 — Paid newsletter** | €12/month or €99/year | 500+ subscribers, revenue validation | Months 4–9 |
| **Phase 3 — SaaS platform** | Tiered SaaS (consumer + professional) | Data product with automated intelligence | Months 10–18 |

This BRD covers Phase 1 and 2 requirements, with architecture decisions that enable Phase 3 without rework.

---

## 2. Target audience

### 2.1 Primary personas

**P1 — The Dublin escapee (first-time buyer)**
- Age 28–40, dual income €70–110k household
- Currently renting in Dublin, priced out of the Dublin market
- Evaluating commuter towns: Mullingar, Maynooth, Navan, Athlone, Tullamore
- Needs: town-by-town price comparisons, commute analysis, school/amenity mapping, new-build pipeline visibility
- Willingness to pay: moderate (€10–15/month during active search, 6–12 month lifecycle)

**P2 — The diaspora investor**
- Age 35–55, Irish abroad (US, UK, Australia, Middle East)
- Wants to acquire rental property or holiday home in Ireland
- Low local knowledge, high anxiety about market conditions and regulation
- Needs: yield analysis, regulatory updates (RPZ rules, tax treatment), agent/solicitor recommendations, portfolio tracking
- Willingness to pay: high (€15–25/month, ongoing)

**P3 — The Midlands property professional**
- Auctioneers, solicitors, mortgage brokers, small developers in Westmeath/Offaly/Laois/Longford
- Needs: comparable sales data, planning pipeline intelligence, market trend reports for client presentations
- Willingness to pay: high (€50–100/month for professional-tier intelligence)

**P4 — The existing landlord**
- Owns 1–5 properties in the Midlands
- Navigating regulatory changes, considering exit vs hold
- Needs: yield benchmarking, regulatory impact analysis, capital gains scenario modelling
- Willingness to pay: moderate (€10–15/month)

### 2.2 Addressable market estimate

| Persona | Estimated population | Realistic conversion | Revenue potential (annual) |
|---------|---------------------|----------------------|---------------------------|
| P1 — Dublin escapee | ~20,000 active searchers | 1–2% = 200–400 | €24k–€48k |
| P2 — Diaspora investor | ~10,000 interested | 1–2% = 100–200 | €18k–€60k |
| P3 — Professional | ~500 in Midlands | 10–20% = 50–100 | €30k–€120k |
| P4 — Existing landlord | ~5,000 in region | 2–3% = 100–150 | €12k–€18k |
| **Total addressable** | | **450–850 paid** | **€84k–€246k** |

---

## 3. Product requirements — Phase 1 and 2

### 3.1 Content product (newsletter/research)

#### 3.1.1 Free tier content

| Content type | Frequency | Description |
|---|---|---|
| Weekly market pulse | Weekly (Sunday) | 500-word summary: key sales from PPR, listing trends, one spotlight town |
| Monthly town profile | Monthly | Deep-dive on one Midlands town: prices, yields, development pipeline, amenities, commute |
| Regulatory alerts | As needed | Plain-English explainers when policy changes drop (RZLT, HAP, RPZ, tax) |

#### 3.1.2 Paid tier content (€12/month or €99/year)

| Content type | Frequency | Description |
|---|---|---|
| Full comparable analysis | Weekly | Every PPR sale in covered towns, with automated comp analysis and yield calc |
| Planning pipeline tracker | Fortnightly | New planning applications, grants, refusals across covered counties — sourced from ePlanning |
| Investment scenario models | Monthly | Interactive yield calculators, capital appreciation scenarios, tax-adjusted returns |
| Town ranking index | Quarterly | Composite score ranking covered towns on price momentum, yield, supply pipeline, amenity access, commute |
| Professional data pack | Monthly | PDF/CSV export of all data tables — designed for P3 persona to use in client presentations |
| Ask the analyst | Ongoing | Subscriber Q&A thread — curated responses to specific property questions |

#### 3.1.3 Geographic coverage (Phase 1–2)

**Launch towns (Month 1):** Mullingar, Athlone, Tullamore
**Expansion 1 (Month 3):** Longford, Portlaoise, Birr
**Expansion 2 (Month 6):** Carlow, Kilkenny, Navan, Maynooth, Enfield
**Expansion 3 (Month 9):** Full Midlands + commuter belt (all towns within 90 min of Dublin by road/rail)

### 3.2 Data requirements

#### 3.2.1 Core data sources

| Source | Data | Access method | Update frequency | Cost |
|---|---|---|---|---|
| Property Price Register | All residential sales (price, date, address, new/second-hand) | Public CSV download / API | Quarterly lag | Free |
| Daft.ie | Listings (asking prices, time on market, sold prices via Daft Advantage) | Web scraping / potential API partnership | Daily | Free (scraping) or commercial |
| MyHome.ie | Listings, price changes, sold prices | Web scraping | Daily | Free (scraping) |
| Rent.ie / Daft rentals | Rental listings, asking rents | Web scraping | Daily | Free |
| ePlanning.ie | Planning applications, decisions, conditions | Web scraping per local authority | Weekly | Free |
| CSO | RPPI, population, employment, housing completions | StatBank API | Monthly/quarterly | Free |
| RTB | Rent index, tenancy registrations | Published reports | Quarterly | Free |
| Eircode / GeoDirectory | Address-level geocoding, building use | Commercial API | On-demand | €€ (commercial license) |
| BER Register | Energy ratings per property | SEAI public register | On-demand | Free |
| Google Maps / OSM | Commute times, amenity mapping | API | On-demand | Free tier + commercial |

#### 3.2.2 Derived data products

| Derived product | Inputs | Calculation | Output |
|---|---|---|---|
| Town median price | PPR sales | Rolling 12-month median by town, beds, property type | Time series |
| Asking vs sold delta | Daft sold prices + Daft asking prices | % over/under asking by town | Distribution |
| Rental yield estimate | Daft rental asking + PPR median price | Annual rent / purchase price by town and beds | Yield % |
| Supply pipeline score | ePlanning grants + commencement notices | Weighted count of approved units, by town | Index (0–100) |
| Affordability index | CSO income data + mortgage rates + PPR median | Max affordable price at 3.5x LTI, 90% LTV | €k threshold |
| Price momentum | PPR 3-month rolling vs 12-month rolling | Acceleration metric | +/- indicator |
| BER premium | BER register + PPR matched sales | Price premium for A/B rated vs C/D rated | % premium |

---

## 4. Architecture — designed for Phase 2, built to evolve to Phase 3

### 4.1 Architecture principles

1. **Data layer is the product** — every architectural decision must make the data layer richer, cleaner, and more queryable. The newsletter is a rendering of the data; the future SaaS product is a different rendering of the same data.
2. **Automate ingestion first** — manual research doesn't scale. Every data source gets an automated pipeline from day one, even if the analysis layer is initially human-written.
3. **AI as co-analyst, not author** — Claude/LLM generates draft analyses from structured data; human editor reviews and publishes. This preserves quality while scaling coverage.
4. **Subscriber-aware from day one** — even if the MVP is a Substack, track subscriber engagement, preferences (which towns they follow), and conversion events. This data feeds Phase 3 personalisation.
5. **Composable for SaaS** — backend services are API-first. The newsletter is one consumer of the API. The future SaaS dashboard is another. MCP tools are a third.

### 4.2 High-level architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                       │
│                                                             │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ Substack  │  │ Web app      │  │ MCP server            │ │
│  │ (Phase 1) │  │ (Phase 3)    │  │ (Phase 3 — agent      │ │
│  │           │  │ Next.js/React│  │  access to data)      │ │
│  └─────┬─────┘  └──────┬───────┘  └───────────┬───────────┘ │
│        │               │                      │             │
└────────┼───────────────┼──────────────────────┼─────────────┘
         │               │                      │
┌────────┼───────────────┼──────────────────────┼─────────────┐
│        ▼               ▼                      ▼             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              API GATEWAY / BFF                      │    │
│  │         (Node.js — Express or Hono)                 │    │
│  │  Auth (Clerk/Auth.js) │ Rate limiting │ Billing     │    │
│  └─────────────────────────┬───────────────────────────┘    │
│                            │                                │
│          INTELLIGENCE LAYER                                 │
│  ┌─────────────────────────┼───────────────────────────┐    │
│  │                         ▼                           │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │    │
│  │  │ Analysis     │  │ AI draft     │  │ Report    │ │    │
│  │  │ engine       │  │ generator    │  │ renderer  │ │    │
│  │  │ (Python)     │  │ (Claude API) │  │ (MD/PDF)  │ │    │
│  │  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘ │    │
│  └─────────┼────────────────┼─────────────────┼────────┘    │
│            │                │                 │             │
│            ▼                ▼                 ▼             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              DATA LAYER (PostgreSQL + PostGIS)      │    │
│  │                                                     │    │
│  │  sales │ listings │ rentals │ planning │ towns │     │    │
│  │  subscribers │ engagement │ derived_metrics          │    │
│  └─────────────────────────┬───────────────────────────┘    │
│                            │                                │
│          INGESTION LAYER                                    │
│  ┌─────────────────────────┼───────────────────────────┐    │
│  │                         ▼                           │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │    │
│  │  │ PPR      │  │ Daft/    │  │ ePlanning│          │    │
│  │  │ ingester │  │ MyHome   │  │ ingester │          │    │
│  │  │          │  │ scraper  │  │          │          │    │
│  │  └──────────┘  └──────────┘  └──────────┘          │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │    │
│  │  │ CSO      │  │ RTB      │  │ BER      │          │    │
│  │  │ StatBank │  │ reports  │  │ register │          │    │
│  │  └──────────┘  └──────────┘  └──────────┘          │    │
│  │                                                     │    │
│  │  Orchestrator: n8n (existing Docker Compose setup)  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│                    INFRASTRUCTURE                           │
│  Docker Compose (dev) → Railway/Fly.io (prod)              │
│  PostgreSQL + PostGIS │ Redis (cache) │ S3 (reports/PDFs)  │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Component detail

#### 4.3.1 Ingestion layer — n8n orchestrated pipelines

Leverage the existing n8n + Docker Compose + Postgres setup as the ingestion backbone.

| Pipeline | Source | Method | Schedule | n8n workflow |
|---|---|---|---|---|
| `ppr-ingest` | propertypriceregister.ie | CSV download, parse, dedupe, geocode | Weekly (Sunday AM) | HTTP GET → CSV parse → Postgres upsert |
| `daft-listings` | daft.ie | Headless browser scrape (Playwright) | Daily 6am | n8n Code node → Playwright → extract → Postgres |
| `daft-sold` | daft.ie/sold-properties | Headless browser scrape | Daily 6am | Same as listings, sold endpoint |
| `rental-listings` | rent.ie / daft.ie rentals | Headless browser scrape | Daily 6am | Parallel scrape → normalise → Postgres |
| `eplanning` | Per-county ePlanning portals | HTTP requests per local authority | Weekly | Loop over counties → parse results → Postgres |
| `cso-stats` | CSO StatBank API | JSON API calls | Monthly | HTTP GET → JSON parse → Postgres |
| `ber-register` | SEAI BER public register | CSV bulk download | Monthly | Download → parse → Postgres |
| `derived-metrics` | Internal Postgres | SQL-based computation | Daily (after ingestion) | Postgres function calls → materialised views |

**Key n8n design decisions:**
- Each pipeline is an independent workflow with error handling and Slack notification on failure
- Deduplication at write time using composite natural keys (address hash + date for PPR; listing ID for Daft)
- Raw data stored in `raw_*` schema; cleaned/normalised data in `clean_*` schema; derived metrics in `analytics_*` schema
- Change detection: hash previous scrape output, skip if unchanged (reduces noise and compute)

#### 4.3.2 Data layer — PostgreSQL with PostGIS

**Why Postgres + PostGIS:** Every property question is inherently spatial. "What sold near Lough Owel?" is a geo query. Commute analysis, amenity proximity, catchment mapping — all spatial. PostGIS from day one avoids a painful migration later.

**Core schema (simplified):**

```sql
-- Raw sales from PPR
CREATE TABLE sales (
    id              SERIAL PRIMARY KEY,
    date_of_sale    DATE NOT NULL,
    address         TEXT NOT NULL,
    county          TEXT NOT NULL,
    town            TEXT,
    eircode         TEXT,
    price           NUMERIC(12,2) NOT NULL,
    not_full_price  BOOLEAN DEFAULT FALSE,
    is_new          BOOLEAN,
    property_type   TEXT, -- house / apartment
    beds            SMALLINT,
    geom            GEOMETRY(POINT, 4326),
    source_hash     TEXT UNIQUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Active and historical listings
CREATE TABLE listings (
    id              SERIAL PRIMARY KEY,
    source          TEXT NOT NULL, -- daft / myhome
    source_id       TEXT NOT NULL,
    address         TEXT NOT NULL,
    town            TEXT,
    county          TEXT NOT NULL,
    asking_price    NUMERIC(12,2),
    beds            SMALLINT,
    baths           SMALLINT,
    property_type   TEXT,
    floor_area_sqm  NUMERIC(8,2),
    ber_rating      TEXT,
    first_listed    DATE,
    last_seen       DATE,
    status          TEXT DEFAULT 'active', -- active / sold / withdrawn
    sold_price      NUMERIC(12,2),
    sold_date       DATE,
    geom            GEOMETRY(POINT, 4326),
    source_hash     TEXT UNIQUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Rental listings
CREATE TABLE rentals (
    id              SERIAL PRIMARY KEY,
    source          TEXT NOT NULL,
    source_id       TEXT NOT NULL,
    address         TEXT NOT NULL,
    town            TEXT,
    county          TEXT NOT NULL,
    monthly_rent    NUMERIC(8,2),
    beds            SMALLINT,
    property_type   TEXT,
    first_listed    DATE,
    last_seen       DATE,
    status          TEXT DEFAULT 'active',
    geom            GEOMETRY(POINT, 4326),
    source_hash     TEXT UNIQUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Planning applications
CREATE TABLE planning (
    id              SERIAL PRIMARY KEY,
    authority       TEXT NOT NULL,
    reference       TEXT NOT NULL,
    applicant       TEXT,
    description     TEXT,
    address         TEXT,
    town            TEXT,
    decision        TEXT, -- granted / refused / pending / appealed
    decision_date   DATE,
    units_proposed  INTEGER,
    application_date DATE,
    geom            GEOMETRY(POINT, 4326),
    source_hash     TEXT UNIQUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Covered towns (reference data)
CREATE TABLE towns (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    county          TEXT NOT NULL,
    population      INTEGER,
    geom            GEOMETRY(POINT, 4326),
    coverage_tier   SMALLINT DEFAULT 1, -- 1=launch, 2=expansion, 3=full
    commute_dublin_min INTEGER,
    commute_method  TEXT -- road / rail / both
);

-- Derived: town-level metrics (materialised view refreshed daily)
CREATE MATERIALIZED VIEW town_metrics AS
SELECT
    t.id AS town_id,
    t.name,
    t.county,
    COUNT(DISTINCT s.id) FILTER (WHERE s.date_of_sale >= CURRENT_DATE - INTERVAL '12 months') AS sales_12m,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.price) FILTER (WHERE s.date_of_sale >= CURRENT_DATE - INTERVAL '12 months') AS median_price_12m,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.price) FILTER (WHERE s.date_of_sale >= CURRENT_DATE - INTERVAL '3 months') AS median_price_3m,
    COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'active') AS active_listings,
    COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'active') AS active_rentals,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY r.monthly_rent) FILTER (WHERE r.status = 'active') AS median_rent,
    COUNT(DISTINCT p.id) FILTER (WHERE p.decision = 'granted' AND p.decision_date >= CURRENT_DATE - INTERVAL '12 months') AS planning_grants_12m,
    SUM(p.units_proposed) FILTER (WHERE p.decision = 'granted' AND p.decision_date >= CURRENT_DATE - INTERVAL '12 months') AS units_approved_12m
FROM towns t
LEFT JOIN sales s ON ST_DWithin(s.geom, t.geom, 0.05) -- ~5km radius
LEFT JOIN listings l ON ST_DWithin(l.geom, t.geom, 0.05)
LEFT JOIN rentals r ON ST_DWithin(r.geom, t.geom, 0.05)
LEFT JOIN planning p ON ST_DWithin(p.geom, t.geom, 0.05)
GROUP BY t.id, t.name, t.county;

-- Subscribers (even if Substack is primary, mirror here for analytics)
CREATE TABLE subscribers (
    id              SERIAL PRIMARY KEY,
    email           TEXT UNIQUE NOT NULL,
    source          TEXT DEFAULT 'substack', -- substack / direct / referral
    tier            TEXT DEFAULT 'free', -- free / paid / professional
    towns_following TEXT[], -- which towns they're interested in
    persona         TEXT, -- P1/P2/P3/P4 classification
    subscribed_at   TIMESTAMPTZ DEFAULT NOW(),
    churned_at      TIMESTAMPTZ
);
```

#### 4.3.3 Intelligence layer — analysis engine + AI co-analyst

**Analysis engine (Python):**
- pandas/geopandas for data manipulation
- Runs as scheduled jobs (triggered by n8n after ingestion completes)
- Computes all derived metrics, refreshes materialised views
- Generates structured JSON "analysis packets" per town per week

**AI draft generator (Claude API):**
- Takes structured analysis packets as input
- Generates draft newsletter sections using a templated system prompt
- Prompt includes: town metrics JSON, recent notable sales, planning decisions, regulatory context
- Output: Markdown draft per section, with inline data references
- Human editor reviews, adjusts tone, adds local colour, publishes

**Example prompt template:**

```
You are an Irish property market analyst writing for {publication_name}.

Here is this week's data for {town_name}, Co. {county}:

<town_metrics>
{metrics_json}
</town_metrics>

<notable_sales>
{sales_json}
</notable_sales>

<planning_activity>
{planning_json}
</planning_activity>

Write a 300-word market pulse for this town. Include:
- Lead with the most newsworthy data point
- Compare to the same period last year
- Note any planning approvals that will affect supply
- Flag any asking-vs-sold price patterns
- End with a forward-looking statement

Tone: authoritative but accessible. No jargon. Write as if
explaining to an informed friend considering buying here.
```

**Report renderer:**
- Markdown → HTML (for Substack/email)
- Markdown → PDF (for professional tier downloads)
- Uses a consistent branded template
- Charts generated via Python matplotlib/plotly, embedded as images

#### 4.3.4 Presentation layer

**Phase 1–2: Substack as primary channel**
- Free and paid tiers managed natively by Substack
- Substack handles: email delivery, payment processing, subscriber management, archive/SEO
- Custom domain: midlandsproperty.substack.com → midlandsproperty.ie (Substack supports custom domains)
- Supplement with: Twitter/X for distribution, LinkedIn for professional audience

**Phase 2 bridge: Simple web companion**
- Static site (Astro or Next.js static export) at midlandsproperty.ie
- Town pages with key metrics (pulled from API)
- Free content acts as SEO funnel to Substack subscription
- Interactive yield calculator (React component) as lead magnet

**Phase 3 evolution: Full SaaS web app**
- Next.js with App Router
- Authenticated dashboard (Clerk or Auth.js)
- Town explorer with map view (Mapbox/Leaflet + PostGIS)
- Personalised watchlists (save towns, get alerts)
- Interactive comparable analysis tool
- Professional tier: API access + CSV/PDF export
- MCP server exposure: allow AI agents to query the property database

#### 4.3.5 API gateway (Phase 2 onward)

```
Base URL: api.midlandsproperty.ie

GET  /v1/towns                           → List covered towns with summary metrics
GET  /v1/towns/:id/metrics               → Full metrics for a town
GET  /v1/towns/:id/sales?period=12m      → Recent sales in a town
GET  /v1/towns/:id/listings              → Active listings
GET  /v1/towns/:id/rentals               → Active rental listings
GET  /v1/towns/:id/planning              → Planning pipeline
GET  /v1/towns/:id/yield                 → Calculated yield metrics
GET  /v1/compare?towns=mullingar,athlone → Side-by-side town comparison
GET  /v1/search?q=lakepoint+mullingar    → Full-text property search
POST /v1/analysis/comparable             → Run comparable analysis for an address
GET  /v1/reports/weekly/:date            → Published weekly report content
GET  /v1/alerts                          → Subscriber alert preferences
```

**Auth:** API key for professional tier; JWT session for web app.
**Rate limits:** Free = 100 req/day; Paid = 1,000 req/day; Professional = 10,000 req/day.

### 4.4 Infrastructure and deployment

#### 4.4.1 Development environment

```yaml
# docker-compose.yml (extends existing n8n setup)
services:
  postgres:
    image: postgis/postgis:16-3.4
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: property_intel
      POSTGRES_USER: property
      POSTGRES_PASSWORD: ${PG_PASSWORD}
    ports:
      - "5432:5432"

  n8n:
    image: n8nio/n8n
    depends_on:
      - postgres
    environment:
      DB_TYPE: postgresdb
      DB_POSTGRESDB_HOST: postgres
      DB_POSTGRESDB_DATABASE: n8n
      DB_POSTGRESDB_USER: property
      DB_POSTGRESDB_PASSWORD: ${PG_PASSWORD}
    ports:
      - "5678:5678"
    volumes:
      - n8n_data:/home/node/.n8n

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api:
    build: ./api
    depends_on:
      - postgres
      - redis
    environment:
      DATABASE_URL: postgresql://property:${PG_PASSWORD}@postgres:5432/property_intel
      REDIS_URL: redis://redis:6379
      CLAUDE_API_KEY: ${CLAUDE_API_KEY}
    ports:
      - "3001:3001"

  analysis:
    build: ./analysis
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgresql://property:${PG_PASSWORD}@postgres:5432/property_intel

volumes:
  pgdata:
  n8n_data:
```

#### 4.4.2 Production deployment (Phase 2)

| Component | Service | Cost estimate |
|---|---|---|
| PostgreSQL + PostGIS | Railway or Neon (managed Postgres) | €20–40/month |
| n8n | Self-hosted on Railway (Docker) | €10–20/month |
| API server | Railway or Fly.io | €10–20/month |
| Redis | Railway managed Redis | €5–10/month |
| Static site / web app | Vercel (free tier for Phase 2) | €0–20/month |
| Object storage (PDFs, reports) | Cloudflare R2 or AWS S3 | €2–5/month |
| Claude API (AI co-analyst) | Anthropic API (Haiku for drafts, Sonnet for analysis) | €20–50/month |
| Substack | Platform (handles payments, email delivery) | Free (Substack takes 10% of paid subs) |
| Domain | midlandsproperty.ie | €15/year |
| **Total infrastructure** | | **€70–170/month** |

---

## 5. Revenue model

### 5.1 Pricing tiers

| Tier | Price | Includes | Target persona |
|---|---|---|---|
| **Free** | €0 | Weekly pulse (Sunday), monthly town profiles, regulatory alerts | All — top of funnel |
| **Insider** | €12/month or €99/year | Full comparable analysis, planning tracker, investment scenarios, town ranking index, ask the analyst | P1, P2, P4 |
| **Professional** | €79/month or €749/year | Everything in Insider + data pack exports (PDF/CSV), API access, priority Q&A, early access to tools | P3 |

### 5.2 Revenue projections

| Milestone | Timeline | Free subs | Paid subs | MRR | ARR |
|---|---|---|---|---|---|
| MVP launch | Month 1 | 200 | 0 | €0 | €0 |
| Paid launch | Month 4 | 800 | 30 | €360 | €4,320 |
| Traction | Month 9 | 2,000 | 150 | €1,800 | €21,600 |
| Scale | Month 15 | 5,000 | 500 | €6,000 | €72,000 |
| Mature (Phase 3) | Month 24 | 10,000 | 1,200 | €16,000 | €192,000 |

Assumptions: 5–8% free-to-paid conversion (industry benchmark for niche B2C newsletters); Professional tier represents ~10% of paid base.

### 5.3 Phase 3 additional revenue streams

| Stream | Model | Potential |
|---|---|---|
| **Auctioneer dashboard** | White-label town reports for estate agents | €200–500/month per agency |
| **Developer intelligence** | Pre-planning site assessment reports | €500–2,000 per report |
| **API access (commercial)** | Fintech/proptech integrations | Usage-based pricing |
| **Sponsored content** | Mortgage broker, solicitor, surveyor partners | €500–1,000/placement |
| **MCP server access** | AI agents querying property data on behalf of end users | Per-query pricing |

---

## 6. Go-to-market strategy

### 6.1 Phase 1 — Build audience (Months 1–3)

1. **Launch Substack** with 3 free town profiles (Mullingar, Athlone, Tullamore) as the anchor content
2. **Twitter/X thread strategy** — weekly data threads pulling from PPR and Daft data with charts; Irish property Twitter is active and engaged
3. **Reddit r/irishpersonalfinance** — this subreddit has 100k+ members and property investment is a top topic; share free analysis (not promotional)
4. **LinkedIn** — target property professionals, share regulatory analysis and planning insights
5. **Cross-promote with existing Irish property accounts** — Ronan Lyons (TCD), John McCartney (BNP Paribas), David Duffy (BPFI) regularly engage with quality property data
6. **SEO play** — town-specific landing pages rank well because nobody else is writing "Mullingar property market 2026" content with data

### 6.2 Phase 2 — Monetise (Months 4–9)

1. **Turn on Substack paid tier** after 500+ free subscribers
2. **Soft paywall model** — free readers get the headline and first paragraph; full analysis behind paywall
3. **Annual pricing incentive** — €99/year (17% discount vs monthly) to improve retention
4. **Professional tier launch** — direct outreach to Westmeath/Offaly auctioneers and solicitors with sample data pack
5. **Referral programme** — "Give a month, get a month" subscriber referral

### 6.3 Phase 3 — Product (Months 10–18)

1. **Launch web app** with town explorer and interactive tools
2. **Migrate highest-value features from newsletter to app** (comparables tool, yield calculator, planning tracker map)
3. **API launch** for professional tier
4. **MCP server** — expose property data as tools for AI agents
5. **White-label partnerships** with estate agencies

---

## 7. Phase 3 evolution — SaaS product architecture

### 7.1 What changes from Phase 2 to Phase 3

| Component | Phase 2 | Phase 3 |
|---|---|---|
| **Presentation** | Substack + static site | Full Next.js web app with auth |
| **User management** | Substack handles | Clerk/Auth.js with Stripe billing |
| **Data access** | Newsletter embeds | Interactive dashboard + API |
| **Personalisation** | Same content for all | Watchlists, alerts, saved searches |
| **AI** | Draft generation for editor | User-facing AI analyst chat |
| **MCP** | None | Full MCP server for agent access |
| **Mobile** | Email (responsive) | PWA or React Native app |

### 7.2 MCP server design (Phase 3)

The property data becomes accessible to AI agents via MCP, following the same patterns as the EIS Broker DXP MCP work.

```
MCP Server: property-intelligence

Tools:
  get_town_metrics       → Town-level summary (price, yield, supply)
  search_sales           → Query PPR sales by location, date, price range
  search_listings        → Query active listings with filters
  get_comparable_sales   → Automated comp analysis for a given address
  get_planning_pipeline  → Planning applications by town/county
  get_yield_estimate     → Calculate estimated rental yield for a property
  compare_towns          → Side-by-side town comparison
  get_market_pulse       → AI-generated summary of recent market activity

Resources:
  property://towns/{town_id}/metrics
  property://towns/{town_id}/sales
  property://reports/weekly/{date}
```

### 7.3 AI-powered features (Phase 3)

| Feature | Description | Implementation |
|---|---|---|
| **AI property analyst chat** | Natural language questions about the market: "What's the best yield town within 60 min of Dublin?" | Claude + MCP tools + structured data |
| **Automated comparable reports** | Enter an address, get a full comp analysis with AI narrative | Claude API with structured comp data as context |
| **Alert summarisation** | Weekly personalised email summarising activity in your watched towns | Claude Haiku generating per-subscriber summaries |
| **Investment scenario modelling** | "What if interest rates drop 0.5%? What happens to Mullingar yields?" | Parameterised model + Claude narrative |

---

## 8. Risks and mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| **Scraping blocked by Daft/MyHome** | Loss of listings data | Medium | Build partnership pipeline early; Daft has a commercial data offering. Fall back to PPR (public) as core. |
| **Low subscriber conversion** | Revenue below projections | Medium | Validate with 3 months of free content first. Pivot to professional-only if consumer demand is weak. |
| **Data quality issues** | Inaccurate analysis undermines credibility | Medium | Multi-source validation; human QA on every published report; error correction process |
| **Regulatory changes to PPR access** | Core data source affected | Low | PPR is a statutory register with public access provisions; unlikely to restrict |
| **Competitor enters market** | Daft or Irish Times launches similar product | Low-Medium | First-mover advantage in Midlands niche; deeper local knowledge; AI-augmented speed of coverage |
| **Claude API cost scaling** | AI generation costs grow with coverage | Low | Haiku for routine drafts; Sonnet only for complex analysis; cache common queries |
| **Single-person dependency** | Founder capacity limits growth | High | Automate maximally in Phase 1-2; hire part-time editor/researcher at €6k+ MRR |

---

## 9. Success metrics

### 9.1 Phase 1 KPIs (Months 1–3)

- 500 free subscribers by end of Month 3
- 40%+ email open rate (benchmark for niche newsletters)
- 3 complete town profiles published
- All core data pipelines running automatically
- 10+ Twitter threads with 50+ engagements each

### 9.2 Phase 2 KPIs (Months 4–9)

- 2,000 free subscribers
- 150 paid subscribers (7.5% conversion)
- €1,800 MRR
- Churn rate below 5%/month
- 10 towns with full coverage
- Professional tier: 10 paying agencies/firms

### 9.3 Phase 3 KPIs (Months 10–18)

- 500 paid subscribers (across tiers)
- €6,000+ MRR
- Web app launched with 1,000+ registered users
- API serving 3+ external integrations
- MCP server operational with demo agent workflow
- Net Promoter Score 50+

---

## 10. Appendix: Technology stack summary

| Layer | Technology | Rationale |
|---|---|---|
| **Database** | PostgreSQL 16 + PostGIS 3.4 | Spatial queries are core; mature, scalable, free |
| **Ingestion orchestration** | n8n (self-hosted) | Already set up; visual workflow builder; good for scraping pipelines |
| **Scraping** | Playwright (headless Chromium) | Handles JS-rendered property sites; robust selectors |
| **Analysis** | Python 3.12 (pandas, geopandas, scipy) | Standard data science stack; PostGIS integration via SQLAlchemy + GeoAlchemy2 |
| **AI co-analyst** | Claude API (Haiku for drafts, Sonnet for deep analysis) | Best quality for structured→narrative generation |
| **API server** | Node.js (Hono or Express) | Lightweight, fast; consistent with Phase 3 Next.js backend |
| **Web app (Phase 3)** | Next.js 15 + React 19 | App Router, server components, API routes; Vercel deployment |
| **Auth (Phase 3)** | Clerk | Drop-in auth with Stripe billing integration |
| **Payments** | Substack (Phase 1–2) → Stripe (Phase 3) | Substack handles early payments; Stripe for SaaS flexibility |
| **Email delivery** | Substack (Phase 1–2) → Resend (Phase 3) | Transactional + marketing emails when migrating off Substack |
| **Mapping** | Mapbox GL JS or Leaflet + OpenStreetMap | Interactive maps for town explorer; PostGIS backend |
| **Charts** | Chart.js (web) / matplotlib (PDF reports) | Lightweight, good-looking, well-documented |
| **Infrastructure** | Docker Compose (dev) → Railway (prod) | Simple, affordable, Postgres-native |
| **CDN / static** | Vercel or Cloudflare Pages | Free tier sufficient for Phase 2 |
| **Object storage** | Cloudflare R2 | S3-compatible, no egress fees |
| **Monitoring** | Sentry (errors) + PostHog (product analytics) | Free tiers sufficient for Phase 1–2 |
| **MCP server (Phase 3)** | TypeScript MCP SDK | Consistent with EIS MCP work; expose data to AI agents |
