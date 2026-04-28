# Irish Property Intelligence — Agentic Architecture Specification

**Document:** Full agentic build plan
**Version:** 1.0
**Date:** March 2026
**Parent:** property-research-product-brd.md

---

## 1. Architecture philosophy

### 1.1 What "agentic" means for this product

This is not a chatbot bolted onto a database. The entire product — from data ingestion through analysis to subscriber delivery — is orchestrated by a network of specialised AI agents, each with clearly scoped tools, responsibilities, and quality gates. Human oversight is layered at the right points (editorial review, anomaly triage) rather than bottlenecking every step.

The architecture follows three principles borrowed from the EIS AgentCore pattern:

1. **Agents are specialists, not generalists.** Each agent has a narrow mandate, a constrained tool set, and a system prompt that encodes domain expertise. The ingestion agent doesn't write newsletters. The analyst agent doesn't scrape websites.

2. **Orchestration is event-driven, not command-driven.** Agents react to data events (new PPR data available, listing price changed, planning decision published) rather than being invoked on a fixed schedule. n8n is the event bus; agents are subscribers.

3. **Tools are the interface contract.** Every agent interacts with the system through MCP tools — the same tools that will be exposed to external consumers in Phase 3. Agents are the first users of their own API.

### 1.2 Agent taxonomy

```
┌─────────────────────────────────────────────────────────────────┐
│                     ORCHESTRATOR AGENT                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Decides what needs to happen based on system events     │   │
│  │  Routes work to specialist agents                        │   │
│  │  Monitors quality gates and escalates to human           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            │                                    │
│          ┌─────────────────┼─────────────────┐                  │
│          ▼                 ▼                  ▼                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐      │
│  │  INGESTION   │  │  ANALYSIS    │  │  EDITORIAL        │      │
│  │  AGENTS      │  │  AGENTS      │  │  AGENTS           │      │
│  │              │  │              │  │                    │      │
│  │  • PPR       │  │  • Comp      │  │  • Draft writer   │      │
│  │  • Listings  │  │  • Yield     │  │  • Chart maker    │      │
│  │  • Rentals   │  │  • Planning  │  │  • Alert composer  │      │
│  │  • Planning  │  │  • Anomaly   │  │  • Report builder  │      │
│  │  • Stats     │  │  • Ranking   │  │  • Social writer   │      │
│  └──────┬───────┘  └──────┬───────┘  └────────┬──────────┘      │
│         │                 │                    │                 │
│         ▼                 ▼                    ▼                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  SUBSCRIBER AGENT                        │   │
│  │  • Handles user queries against the data layer           │   │
│  │  • Personalised alerts and summaries                     │   │
│  │  • Exposed via MCP in Phase 3                            │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Ingestion agents — automated data pipeline

### 2.1 Design pattern: n8n workflow → agent validation → Postgres

Every data source follows the same pattern:

```
[Trigger]          [Extract]          [Agent QA]         [Load]
 Schedule or   →   n8n fetches    →   Claude Haiku   →   Postgres
 webhook           raw data           validates,         upsert
                   (HTTP/scrape)      normalises,
                                      flags anomalies
```

The critical insight: raw scraping is deterministic (n8n handles it), but normalisation is messy (addresses are inconsistent, property types are described differently across sources, geocoding is ambiguous). This is where a lightweight agent adds value over regex/rule-based cleaning.

### 2.2 PPR ingestion pipeline

**Trigger:** Weekly (Sunday 02:00 UTC) — PPR publishes quarterly but we check weekly for updates.

**n8n workflow: `ppr-ingest`**

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  HTTP GET     │    │  CSV parse   │    │  Deduplicate │
│  PPR CSV      │───▶│  Extract     │───▶│  Against     │
│  download     │    │  columns     │    │  existing    │
└──────────────┘    └──────────────┘    └──────┬───────┘
                                               │
                                        ┌──────▼───────┐
                                        │  New records  │
                                        │  only         │
                                        └──────┬───────┘
                                               │
                    ┌──────────────┐    ┌──────▼───────┐
                    │  Postgres    │◀───│  Agent:      │
                    │  bulk insert │    │  normalise   │
                    │  raw_sales   │    │  & geocode   │
                    └──────────────┘    └──────────────┘
                                               │
                                        ┌──────▼───────┐
                                        │  Emit event: │
                                        │  ppr.new_    │
                                        │  sales       │
                                        └──────────────┘
```

**n8n node configuration:**

```json
{
  "workflow_name": "ppr-ingest",
  "nodes": [
    {
      "type": "n8n-nodes-base.scheduleTrigger",
      "parameters": {
        "rule": { "interval": [{ "field": "weeks", "weeksInterval": 1 }] },
        "hour": 2,
        "minute": 0
      }
    },
    {
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "GET",
        "url": "https://www.propertypriceregister.ie/website/npsra/ppr/npsra-ppr.nsf/Downloads/PPR-ALL.csv/$FILE/PPR-ALL.csv",
        "responseFormat": "file"
      }
    },
    {
      "type": "n8n-nodes-base.spreadsheetFile",
      "parameters": {
        "operation": "fromFile",
        "options": { "headerRow": true }
      }
    },
    {
      "type": "n8n-nodes-base.code",
      "parameters": {
        "language": "javaScript",
        "code": "// Deduplicate against last ingest checkpoint\n// Hash: address + date + price\nconst crypto = require('crypto');\nconst items = $input.all();\nconst hashed = items.map(item => {\n  const d = item.json;\n  const hash = crypto.createHash('sha256')\n    .update(`${d['Address']}|${d['Date of Sale (dd/mm/yyyy)']}|${d['Price (€)']}`)\n    .digest('hex');\n  return { json: { ...d, source_hash: hash } };\n});\nreturn hashed;"
      }
    },
    {
      "type": "n8n-nodes-base.postgres",
      "parameters": {
        "operation": "executeQuery",
        "query": "SELECT source_hash FROM sales WHERE source_hash = ANY($1::text[])",
        "note": "Filter to new records only by comparing hashes"
      }
    },
    {
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "http://api:3001/internal/agents/normalise-sales",
        "note": "Sends batch to normalisation agent endpoint"
      }
    },
    {
      "type": "n8n-nodes-base.postgres",
      "parameters": {
        "operation": "insert",
        "table": "sales",
        "note": "Bulk insert normalised records"
      }
    },
    {
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "http://api:3001/internal/events",
        "body": { "event": "ppr.new_sales", "count": "={{$json.count}}" },
        "note": "Emit event for downstream agents"
      }
    }
  ]
}
```

**Normalisation agent (Claude Haiku):**

This agent handles the messy work that regex fails at — parsing Irish addresses, inferring town from address strings, classifying property types, and flagging data anomalies.

```typescript
// agents/normalise-sales.ts

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

interface RawSale {
  address: string;
  date_of_sale: string;
  price: string;
  not_full_price: string;
  description: string;
  source_hash: string;
}

interface NormalisedSale {
  address: string;
  town: string | null;
  county: string;
  eircode: string | null;
  price: number;
  not_full_price: boolean;
  is_new: boolean;
  property_type: 'house' | 'apartment' | 'duplex' | 'site' | 'other';
  beds: number | null;
  latitude: number | null;
  longitude: number | null;
  source_hash: string;
  confidence: number; // 0-1, agent's confidence in normalisation
  flags: string[];    // anomalies or uncertainties
}

const SYSTEM_PROMPT = `You are a data normalisation agent for Irish property sales records.

Your job is to take raw Property Price Register records and normalise them into a clean, structured format.

RULES:
1. Extract the TOWN from the address. Irish addresses follow patterns like:
   - "10 The Park, Lakepoint, MULLINGAR, Westmeath" → town: "Mullingar"
   - "WALSHESTOWN, MULLINGAR, WESTMEATH" → town: "Mullingar"
   - Rural addresses may not have a town — use the nearest village/town from the address components.

2. Extract EIRCODE if present (format: A65 F4E2 or similar).

3. Classify PROPERTY TYPE:
   - "Second-Hand Dwelling house /Apartment" → infer from address context
   - Addresses containing "Apt", "Apartment", "Unit" → apartment
   - Most others in Midlands towns → house
   - "Site" in description → site

4. Infer BED COUNT only if confident (e.g., "3 Bed Semi" in description). Otherwise null.

5. Flag ANOMALIES:
   - Price < €50,000 for a house (possible site or partial sale)
   - Price > €1,000,000 in a Midlands town (verify — could be commercial)
   - "Not Full Market Price" = true (family transfer, likely not representative)
   - Address appears to be commercial property

6. Set CONFIDENCE:
   - 0.9+ if town, type, and price all parse cleanly
   - 0.7-0.9 if one field required inference
   - Below 0.7 if significant ambiguity — flag for human review

Respond with ONLY a JSON array of normalised records. No commentary.`;

export async function normaliseSalesBatch(
  records: RawSale[]
): Promise<NormalisedSale[]> {
  // Process in batches of 50 to stay within token limits
  const BATCH_SIZE = 50;
  const results: NormalisedSale[] = [];

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Normalise these ${batch.length} PPR records:\n\n${JSON.stringify(batch, null, 2)}`
        }
      ]
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    results.push(...parsed);
  }

  return results;
}
```

### 2.3 Listings scraper pipeline

**Trigger:** Daily at 06:00 UTC

**n8n workflow: `daft-listings-ingest`**

The listings scraper is more complex than PPR because Daft.ie is JavaScript-rendered and requires headless browser scraping. We use Playwright running in a Docker sidecar.

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Schedule     │    │  Code node:  │    │  Code node:  │
│  trigger      │───▶│  Generate    │───▶│  Playwright  │
│  06:00 UTC    │    │  town URLs   │    │  scrape loop │
└──────────────┘    └──────────────┘    └──────┬───────┘
                                               │
                    ┌──────────────┐    ┌──────▼───────┐
                    │  Agent:      │◀───│  Raw listing │
                    │  normalise   │    │  JSON array  │
                    │  & classify  │    │              │
                    └──────┬───────┘    └──────────────┘
                           │
                    ┌──────▼───────┐    ┌──────────────┐
                    │  Postgres    │───▶│  Detect      │
                    │  upsert      │    │  changes:    │
                    │  listings    │    │  price drops, │
                    └──────────────┘    │  sold, new   │
                                       └──────┬───────┘
                                              │
                                       ┌──────▼───────┐
                                       │  Emit events │
                                       │  per change  │
                                       │  type        │
                                       └──────────────┘
```

**Playwright scraper (runs in n8n Code node or sidecar):**

```typescript
// scrapers/daft-listings.ts

import { chromium, Browser, Page } from 'playwright';

interface RawListing {
  source: 'daft';
  source_id: string;
  url: string;
  address: string;
  asking_price: number | null;
  beds: number | null;
  baths: number | null;
  property_type: string;
  floor_area_sqm: number | null;
  ber_rating: string | null;
  agent: string | null;
  description_snippet: string;
  image_count: number;
  scraped_at: string;
}

const TOWN_SEARCH_URLS: Record<string, string> = {
  mullingar: 'https://www.daft.ie/property-for-sale/mullingar-westmeath',
  athlone: 'https://www.daft.ie/property-for-sale/athlone-westmeath',
  tullamore: 'https://www.daft.ie/property-for-sale/tullamore-offaly',
  longford: 'https://www.daft.ie/property-for-sale/longford-longford',
  portlaoise: 'https://www.daft.ie/property-for-sale/portlaoise-laois',
  birr: 'https://www.daft.ie/property-for-sale/birr-offaly',
};

const RENTAL_SEARCH_URLS: Record<string, string> = {
  mullingar: 'https://www.daft.ie/property-for-rent/mullingar-westmeath',
  athlone: 'https://www.daft.ie/property-for-rent/athlone-westmeath',
  // ... same pattern
};

export async function scrapeDaftListings(
  townUrls: Record<string, string>
): Promise<RawListing[]> {
  const browser: Browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const allListings: RawListing[] = [];

  for (const [town, url] of Object.entries(townUrls)) {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ...',
      viewport: { width: 1280, height: 720 }
    });
    const page: Page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // Accept cookies if prompted
      const cookieBtn = page.locator('[data-testid="cookie-popup-accept"]');
      if (await cookieBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await cookieBtn.click();
      }

      // Scroll to load all listings (Daft uses infinite scroll)
      let previousHeight = 0;
      let retries = 0;
      while (retries < 10) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1500);
        const currentHeight = await page.evaluate(() => document.body.scrollHeight);
        if (currentHeight === previousHeight) retries++;
        else retries = 0;
        previousHeight = currentHeight;
      }

      // Extract listing cards
      const listings = await page.evaluate(() => {
        const cards = document.querySelectorAll('[data-testid="result-card"]');
        return Array.from(cards).map(card => {
          const priceEl = card.querySelector('[data-testid="price"]');
          const addressEl = card.querySelector('[data-testid="address"]');
          const metaEls = card.querySelectorAll('[data-testid="meta-info"] span');
          const berEl = card.querySelector('[data-testid="ber-rating"]');
          const linkEl = card.querySelector('a[href*="/for-sale/"]') ||
                         card.querySelector('a[href*="/for-rent/"]');

          const priceText = priceEl?.textContent?.trim() || '';
          const price = parseInt(priceText.replace(/[€,\s]/g, ''), 10) || null;

          let beds = null;
          let baths = null;
          let propertyType = '';
          let floorArea = null;

          metaEls.forEach(el => {
            const text = el.textContent?.trim() || '';
            if (text.match(/\d+\s*bed/i)) beds = parseInt(text);
            if (text.match(/\d+\s*bath/i)) baths = parseInt(text);
            if (text.match(/m²/)) floorArea = parseFloat(text);
            if (text.match(/(house|apartment|duplex|semi|detached|terrace|bungalow)/i)) {
              propertyType = text;
            }
          });

          return {
            source: 'daft',
            source_id: linkEl?.getAttribute('href')?.split('/').pop() || '',
            url: linkEl?.getAttribute('href') || '',
            address: addressEl?.textContent?.trim() || '',
            asking_price: price,
            beds,
            baths,
            property_type: propertyType,
            floor_area_sqm: floorArea,
            ber_rating: berEl?.textContent?.trim() || null,
            description_snippet: '',
            image_count: card.querySelectorAll('img').length,
            scraped_at: new Date().toISOString()
          };
        });
      });

      allListings.push(...listings as RawListing[]);
    } catch (err) {
      console.error(`Failed to scrape ${town}: ${err}`);
      // Emit error event for monitoring
    } finally {
      await context.close();
    }

    // Rate limiting: 3-5 second delay between towns
    await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));
  }

  await browser.close();
  return allListings;
}
```

**Sold listings scraper** follows the same pattern against `daft.ie/sold-properties/{town}`. The key additional logic is matching sold records to previously seen active listings to calculate asking-vs-sold delta.

### 2.4 Planning applications pipeline

**Trigger:** Weekly (Monday 08:00 UTC)

ePlanning portals are per local authority and have inconsistent HTML structures. We use an agent-assisted approach where Claude extracts structured data from semi-structured HTML.

```typescript
// scrapers/eplanning.ts

const LOCAL_AUTHORITIES = [
  {
    name: 'Westmeath County Council',
    code: 'westmeath',
    url: 'https://www.eplanning.ie/WestmeathCC/searchtypes/gensearch/searchresults',
    params: { /* search params for last 7 days */ }
  },
  {
    name: 'Offaly County Council',
    code: 'offaly',
    url: 'https://www.eplanning.ie/OffalyCC/searchtypes/gensearch/searchresults',
    params: {}
  },
  // Laois, Longford, etc.
];

// After raw HTML extraction, we use Claude to parse the messy results
const PLANNING_PARSE_PROMPT = `You are a planning application data extraction agent.

Given raw HTML or text from an Irish local authority ePlanning portal search result,
extract structured planning application records.

For each application, extract:
- reference: The planning reference number (e.g., "25/7234")
- applicant: Name of applicant
- description: What is being proposed (verbatim from the record)
- address: Site address
- application_date: Date filed
- decision: "granted" | "refused" | "pending" | "withdrawn" | "appealed"
- decision_date: If available
- units_proposed: INFER the number of residential units from the description.
  - "construction of 18 residential units" → 18
  - "construction of dwelling house" → 1
  - "extension to existing dwelling" → 0 (not new supply)
  - "change of use from commercial to 4 apartments" → 4
  - Non-residential applications → 0

Flag any applications that appear to involve 10+ residential units — these are
strategically significant for supply pipeline analysis.

Respond with ONLY a JSON array. No commentary.`;
```

### 2.5 Geocoding agent

All ingestion pipelines feed addresses through a geocoding step. We use a cascading strategy:

```
1. Eircode lookup (if present) → exact coordinates
2. Address string → Nominatim/OpenStreetMap geocoder (free, rate-limited)
3. Fallback → town centroid from towns reference table
4. Unresolvable → flag for human review
```

```typescript
// agents/geocoder.ts

interface GeoResult {
  latitude: number;
  longitude: number;
  confidence: 'exact' | 'street' | 'town' | 'county';
  source: 'eircode' | 'nominatim' | 'centroid' | 'manual';
}

export async function geocodeAddress(
  address: string,
  town: string | null,
  county: string,
  eircode: string | null
): Promise<GeoResult> {

  // Tier 1: Eircode (most accurate)
  if (eircode) {
    const result = await lookupEircode(eircode);
    if (result) return { ...result, confidence: 'exact', source: 'eircode' };
  }

  // Tier 2: Nominatim geocoding
  const nominatimQuery = `${address}, ${county}, Ireland`;
  const nominatim = await fetch(
    `https://nominatim.openstreetmap.org/search?` +
    `q=${encodeURIComponent(nominatimQuery)}&format=json&limit=1&countrycodes=ie`,
    { headers: { 'User-Agent': 'MidlandsPropertyIntel/1.0' } }
  );

  const results = await nominatim.json();
  if (results.length > 0) {
    return {
      latitude: parseFloat(results[0].lat),
      longitude: parseFloat(results[0].lon),
      confidence: results[0].type === 'house' ? 'exact' : 'street',
      source: 'nominatim'
    };
  }

  // Tier 3: Town centroid fallback
  if (town) {
    const centroid = await getTownCentroid(town, county);
    if (centroid) return { ...centroid, confidence: 'town', source: 'centroid' };
  }

  // Tier 4: County centroid (last resort)
  const countyCentroid = await getCountyCentroid(county);
  return { ...countyCentroid, confidence: 'county', source: 'centroid' };
}
```

**Rate limiting:** Nominatim allows 1 request/second. We batch geocoding with delays and cache results aggressively (address → coordinates mapping stored in a `geocode_cache` table).

### 2.6 Change detection and event emission

Every ingestion pipeline ends by comparing current data to previous state and emitting typed events. These events drive the analysis and editorial agents.

```typescript
// events/types.ts

type PropertyEvent =
  | { type: 'ppr.new_sales'; payload: { count: number; town_counts: Record<string, number>; date_range: string } }
  | { type: 'listing.new'; payload: { listing_id: number; town: string; price: number; beds: number } }
  | { type: 'listing.price_change'; payload: { listing_id: number; old_price: number; new_price: number; direction: 'up' | 'down' } }
  | { type: 'listing.sold'; payload: { listing_id: number; asking_price: number; sold_price: number; days_on_market: number } }
  | { type: 'listing.withdrawn'; payload: { listing_id: number; town: string; days_on_market: number } }
  | { type: 'rental.new'; payload: { rental_id: number; town: string; monthly_rent: number; beds: number } }
  | { type: 'planning.new_application'; payload: { planning_id: number; town: string; units: number; description: string } }
  | { type: 'planning.decision'; payload: { planning_id: number; town: string; decision: string; units: number } }
  | { type: 'metrics.refresh_complete'; payload: { towns_updated: string[] } }
  | { type: 'anomaly.detected'; payload: { source: string; description: string; severity: 'low' | 'medium' | 'high'; data: any } };
```

**Event store:** PostgreSQL table with JSONB payload. Lightweight — no need for Kafka at this scale.

```sql
CREATE TABLE events (
    id          SERIAL PRIMARY KEY,
    type        TEXT NOT NULL,
    payload     JSONB NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    consumed_by TEXT[], -- which agents have processed this event
    INDEX idx_events_type_created (type, created_at DESC)
);
```

---

## 3. Analysis agents — turning data into intelligence

### 3.1 Comparable analysis agent

The most valuable analytical capability. Given a property (by address or listing), find the most relevant comparable sales and generate a narrative assessment.

```typescript
// agents/comparable-analysis.ts

const COMPARABLE_SYSTEM_PROMPT = `You are a chartered surveyor's comparable analysis agent
specialising in Irish Midlands residential property.

You will receive:
1. A TARGET property (address, beds, type, asking price)
2. A set of COMPARABLE SALES from the PPR within the same area

Your job:
1. RANK the comparables by relevance (proximity + recency + similarity)
2. ASSESS whether the target's asking price is:
   - Below market (likely to sell over asking)
   - At market (likely to sell near asking)
   - Above market (likely to need a price reduction)
3. ESTIMATE a realistic selling price range (low, mid, high)
4. NOTE any adjustments needed:
   - BER rating differential (A/B rated commands ~12% premium over D/E)
   - New vs second-hand (new commands ~15-20% premium in Midlands)
   - Garden/site size differential
   - Condition (if inferable from description)
5. FLAG if comparable evidence is thin (fewer than 3 relevant comps within
   12 months and 3km radius)

Be precise with numbers. State your reasoning. Irish property professionals
will read this — it must withstand scrutiny.

Respond in JSON format:
{
  "target_summary": "...",
  "comparables_ranked": [
    {
      "address": "...",
      "sold_price": 0,
      "sold_date": "...",
      "distance_km": 0,
      "relevance_score": 0.0,
      "adjustments": ["..."],
      "adjusted_comp_value": 0
    }
  ],
  "assessment": "below_market | at_market | above_market",
  "estimated_range": { "low": 0, "mid": 0, "high": 0 },
  "confidence": 0.0,
  "narrative": "...",
  "flags": ["..."]
}`;

export async function runComparableAnalysis(
  target: {
    address: string;
    town: string;
    beds: number;
    property_type: string;
    asking_price: number;
    ber_rating?: string;
    is_new?: boolean;
    latitude: number;
    longitude: number;
  }
): Promise<ComparableResult> {

  // Step 1: Query PostGIS for nearby sales
  const comparables = await db.query(`
    SELECT
      s.address, s.price, s.date_of_sale, s.beds, s.is_new,
      s.property_type,
      ST_Distance(
        s.geom::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      ) / 1000 AS distance_km
    FROM sales s
    WHERE s.date_of_sale >= CURRENT_DATE - INTERVAL '18 months'
      AND ST_DWithin(
        s.geom::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        5000  -- 5km radius
      )
      AND s.not_full_price = false
      AND s.beds BETWEEN $3 - 1 AND $3 + 1
    ORDER BY s.date_of_sale DESC
    LIMIT 20
  `, [target.longitude, target.latitude, target.beds]);

  // Step 2: Enrich with BER data where available
  const enriched = await enrichWithBER(comparables.rows);

  // Step 3: Send to Claude for analysis
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',  // Sonnet for quality on analysis
    max_tokens: 2048,
    system: COMPARABLE_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: JSON.stringify({
        target,
        comparables: enriched,
        market_context: {
          town_median_12m: await getTownMedian(target.town, 12),
          town_median_3m: await getTownMedian(target.town, 3),
          active_listings_count: await getActiveListingsCount(target.town),
          yoy_price_change: await getYoYChange(target.town)
        }
      })
    }]
  });

  return parseResponse(response);
}
```

### 3.2 Yield analysis agent

Calculates and contextualises rental yield for any property or town.

```typescript
// agents/yield-analysis.ts

const YIELD_SYSTEM_PROMPT = `You are a rental yield analysis agent for Irish property.

Given a property (or town summary) with purchase price data and rental comparables,
calculate and contextualise the rental yield.

CALCULATIONS:
1. Gross yield = (Annual rent / Purchase price) × 100
2. Net yield = ((Annual rent - Annual costs) / Purchase price) × 100

ANNUAL COSTS to deduct for net yield:
- Management fee (if apartment): typically €1,200-€2,400/year in Midlands
- Insurance: ~€400-€600/year
- Maintenance reserve: 1% of property value/year
- Void periods: assume 4 weeks/year (7.7% of rent)
- RTB registration: €40/year
- LPT (Local Property Tax): varies, estimate from property value band
- Income tax on rental income: 20-40% marginal rate + PRSI 4% + USC
  (Note: do NOT deduct tax from yield — show pre-tax net yield.
   Flag the tax position separately.)

CONTEXT:
- Irish residential gross yields typically range 3-7%
- Midlands towns tend to yield 5-7% (higher than Dublin at 3-4%)
- A yield above 6% in a growth town is attractive
- Below 4% suggests capital appreciation play, not income

Respond in JSON with clear calculation breakdown and narrative assessment.`;
```

### 3.3 Anomaly detection agent

Runs after every metrics refresh. Looks for statistically unusual patterns that are editorially interesting.

```typescript
// agents/anomaly-detector.ts

const ANOMALY_SYSTEM_PROMPT = `You are a market anomaly detection agent for Irish Midlands property.

You will receive this week's town-level metrics alongside historical baselines.

Flag any of the following:
1. PRICE SPIKES: Town median moved >5% in a single week (check if driven by
   one outlier sale or genuine shift)
2. SUPPLY SHOCKS: Active listings count dropped >20% week-on-week (mass sales?)
   or jumped >30% (developer release?)
3. RENTAL ANOMALIES: New rental listing at >30% above/below town median
   (luxury entry? Below-market social let?)
4. PLANNING SIGNALS: Large residential scheme (50+ units) granted or refused
5. ASKING VS SOLD DIVERGENCE: Town showing consistent pattern of selling
   >15% over asking (bidding war indicator) or >10% under asking (correction signal)
6. VELOCITY CHANGE: Average days-on-market shifted significantly vs 3-month average
7. INVESTOR EXIT SIGNALS: Cluster of BTL properties appearing for sale in same area

For each anomaly:
- Severity: low (interesting note), medium (worth reporting), high (lead story)
- Narrative: one sentence explaining what happened and why it matters
- Verification: what data would confirm or deny this signal

Respond in JSON array. If no anomalies detected, return empty array.`;
```

### 3.4 Town ranking agent

Quarterly computation that produces the flagship "Midlands Town Index" — a composite ranking of covered towns.

```typescript
// agents/town-ranking.ts

const RANKING_SYSTEM_PROMPT = `You are a property investment ranking agent.

Given town-level metrics for all covered Midlands towns, compute a composite
ranking index (0-100) based on these weighted factors:

FACTORS AND WEIGHTS:
1. Price momentum (25%): 3-month price trend relative to 12-month trend.
   Accelerating growth scores higher.
2. Yield attractiveness (20%): Gross rental yield vs regional average.
   Higher relative yield scores higher.
3. Supply pipeline (15%): Approved residential units per capita in planning pipeline.
   Moderate supply is positive (market depth); extreme supply is negative (oversupply risk).
4. Affordability (15%): Median price relative to median regional household income.
   More affordable scores higher (larger buyer pool).
5. Amenity access (10%): Composite of school quality, healthcare, retail, leisure.
   Pre-scored in the input data.
6. Commute connectivity (10%): Time to Dublin by road and rail.
   Shorter commute scores higher.
7. Market liquidity (5%): Sales volume per capita relative to national average.
   Higher liquidity scores higher (easier to exit).

RULES:
- Normalise each factor to 0-100 before applying weights.
- Towns with fewer than 10 sales in 12 months get a -10 penalty for thin evidence.
- New-to-coverage towns (< 3 months of data) are flagged as "provisional".

Output: JSON array of towns sorted by composite score, with per-factor breakdowns
and a 50-word narrative per town explaining the score.`;
```

---

## 4. Editorial agents — content generation pipeline

### 4.1 Content generation workflow

```
[Events accumulated]     [Analysis complete]     [Agent drafts]
  over the week      →    Metrics refreshed  →    content sections
                          Anomalies flagged       per template
                                │
                        ┌───────▼────────┐
                        │  Draft writer  │
                        │  agent         │
                        │  (Sonnet)      │
                        └───────┬────────┘
                                │
                        ┌───────▼────────┐
                        │  Chart maker   │
                        │  agent         │
                        │  (Code exec)   │
                        └───────┬────────┘
                                │
                        ┌───────▼────────┐
                        │  Assembled     │
                        │  draft in      │
                        │  staging DB    │
                        └───────┬────────┘
                                │
                        ┌───────▼────────┐
                        │  HUMAN REVIEW  │
                        │  (editor)      │
                        │  Approve /     │
                        │  edit / reject │
                        └───────┬────────┘
                                │
                        ┌───────▼────────┐
                        │  Publish to    │
                        │  Substack +    │
                        │  web + social  │
                        └────────────────┘
```

### 4.2 Draft writer agent

The core editorial agent. Produces newsletter sections from structured data.

```typescript
// agents/draft-writer.ts

const WEEKLY_PULSE_PROMPT = `You are an Irish property market analyst writing
"The Midlands Property Analyst" — a weekly newsletter for property buyers,
investors, and professionals covering Ireland's Midlands corridor.

VOICE:
- Authoritative but accessible. You know this market deeply.
- No jargon without explanation. A schoolteacher in Tullamore should understand it.
- Occasional dry Irish wit is welcome. Never forced.
- Data-first: lead with numbers, contextualise with narrative.
- Opinionated where the data supports it. "This is overpriced" is fine if the comps say so.
- Never use "market remains resilient" or any other empty estate-agent speak.

STRUCTURE for the weekly pulse:
1. HEADLINE (8-12 words, specific, numbers if possible)
   Bad: "Another busy week in the Midlands"
   Good: "Mullingar 3-beds breach €350k average as Athlone rental stock hits zero"

2. LEAD (2-3 sentences, the single most important development this week)

3. TOWN SPOTLIGHTS (one paragraph per town with notable activity)
   - Always ground in specific transactions, not generalities
   - Compare to recent history: "up from €295k three months ago"
   - Note asking-vs-sold patterns if available

4. PLANNING WATCH (2-3 sentences on significant planning decisions)

5. WHAT TO WATCH (1-2 sentences, forward-looking)

CONSTRAINTS:
- Total length: 600-800 words for free tier; 1,200-1,500 words for paid tier
  (paid section includes the detailed comparable tables and yield analysis)
- Include specific addresses and prices from the data — readers want granularity
- If a sale looks anomalous (family transfer, below-market), note it rather than
  letting it distort the narrative
- Never fabricate or round aggressively. €343,612 is €343,612, not "around €350k"

You will receive a structured JSON payload with this week's data. Write the
newsletter section. Output as Markdown.`;

interface WeeklyPulseInput {
  week_ending: string;
  towns: Array<{
    name: string;
    county: string;
    metrics: {
      median_price_12m: number;
      median_price_3m: number;
      yoy_change_pct: number;
      active_listings: number;
      active_rentals: number;
      median_rent: number;
      gross_yield_pct: number;
    };
    notable_sales: Array<{
      address: string;
      price: number;
      date: string;
      beds: number;
      is_new: boolean;
      not_full_price: boolean;
    }>;
    price_changes: Array<{
      address: string;
      old_price: number;
      new_price: number;
      direction: string;
    }>;
    new_listings: Array<{
      address: string;
      asking_price: number;
      beds: number;
      property_type: string;
    }>;
    sold_this_week: Array<{
      address: string;
      asking_price: number;
      sold_price: number;
      days_on_market: number;
    }>;
  }>;
  planning_decisions: Array<{
    authority: string;
    reference: string;
    description: string;
    decision: string;
    units: number;
    town: string;
  }>;
  anomalies: Array<{
    description: string;
    severity: string;
    town: string;
  }>;
  regulatory_context: string; // any regulatory changes this week
}

export async function generateWeeklyPulse(
  input: WeeklyPulseInput
): Promise<{ markdown: string; suggested_subject: string }> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: WEEKLY_PULSE_PROMPT,
    messages: [{
      role: 'user',
      content: `Generate this week's newsletter (week ending ${input.week_ending}):\n\n${JSON.stringify(input, null, 2)}`
    }]
  });

  const markdown = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  // Extract first line as subject
  const subject = markdown.split('\n')[0]?.replace(/^#+\s*/, '') || 'This week in Midlands property';

  return { markdown, suggested_subject: subject };
}
```

### 4.3 Chart generation agent

Generates static chart images for embedding in newsletters and reports. Uses Python matplotlib/plotly as the rendering engine, with Claude deciding what charts to produce.

```typescript
// agents/chart-maker.ts

const CHART_PLANNING_PROMPT = `You are a data visualisation planning agent.

Given a weekly property data payload, decide which charts would best
illustrate the key stories this week.

CHART TYPES AVAILABLE:
1. line_chart: Price trends over time (good for showing momentum)
2. bar_chart: Town comparisons (good for ranking/comparing)
3. scatter_plot: Asking vs sold prices (good for over/under asking patterns)
4. heatmap: Geographic price distribution (good for spatial stories)
5. small_multiples: Same metric across all towns (good for overview)

RULES:
- Maximum 3 charts per weekly newsletter (don't overwhelm)
- Always include a price trend chart if any town's 3-month momentum diverges
  from 12-month trend
- Include a bar chart if comparing towns on any metric
- Include a scatter if we have 5+ sold-vs-asking data points this week
- Every chart must have a 1-sentence caption that tells the reader
  what to look at

Output: JSON array of chart specifications with type, data references, title,
and caption. The Python renderer will handle the actual drawing.`;

// Chart renderer (Python sidecar or subprocess)
// charts/renderer.py

const CHART_RENDERER_PY = `
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
import json
import sys
from pathlib import Path

# Brand colours
COLOURS = {
    'primary': '#1D9E75',    # teal
    'secondary': '#534AB7',  # purple
    'accent': '#D85A30',     # coral
    'neutral': '#888780',    # gray
    'bg': '#FFFFFF',
    'text': '#2C2C2A',
    'grid': '#D3D1C7'
}

plt.rcParams.update({
    'font.family': 'sans-serif',
    'font.size': 11,
    'axes.labelsize': 12,
    'axes.titlesize': 14,
    'axes.titleweight': 500,
    'axes.edgecolor': COLOURS['grid'],
    'axes.grid': True,
    'grid.alpha': 0.3,
    'grid.color': COLOURS['grid'],
    'figure.facecolor': COLOURS['bg'],
    'axes.facecolor': COLOURS['bg'],
    'text.color': COLOURS['text']
})

def render_chart(spec: dict, output_path: str):
    """Render a chart from a specification dict."""
    chart_type = spec['type']

    if chart_type == 'line_chart':
        render_line(spec, output_path)
    elif chart_type == 'bar_chart':
        render_bar(spec, output_path)
    elif chart_type == 'scatter_plot':
        render_scatter(spec, output_path)

def render_line(spec, output_path):
    fig, ax = plt.subplots(figsize=(8, 4.5))
    for series in spec['series']:
        ax.plot(series['x'], series['y'],
                label=series['label'],
                linewidth=2,
                color=series.get('color', COLOURS['primary']))
    ax.set_title(spec['title'])
    ax.legend(frameon=False)
    ax.yaxis.set_major_formatter(
        ticker.FuncFormatter(lambda x, p: f"€{x:,.0f}")
    )
    fig.tight_layout()
    fig.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close(fig)

# ... render_bar, render_scatter similarly

if __name__ == '__main__':
    spec = json.loads(sys.argv[1])
    output = sys.argv[2]
    render_chart(spec, output)
`;
```

### 4.4 Social media writer agent

Generates Twitter/X threads and LinkedIn posts from the newsletter content.

```typescript
// agents/social-writer.ts

const TWITTER_THREAD_PROMPT = `You are a social media content agent for
"The Midlands Property Analyst".

Given a newsletter section, create a Twitter/X thread (5-8 tweets) that:
1. Opens with a hook stat or surprising fact (this week's headline number)
2. Walks through 2-3 key data points with context
3. Includes one "unpopular opinion" or contrarian take grounded in data
4. Ends with a CTA to subscribe (but not salesy — "full analysis in this week's issue")

RULES:
- Each tweet max 280 characters
- Use numbers liberally — property Twitter loves specific data
- No hashtags (they look desperate)
- No emojis except 📊 or 🏠 sparingly
- Tag relevant accounts only if genuinely relevant (don't spam)
- Include "Thread 🧵" on the first tweet

Output: JSON array of tweet strings.`;
```

---

## 5. Subscriber agent — the Phase 3 AI analyst

### 5.1 Architecture

The subscriber-facing agent is the Phase 3 killer feature: subscribers can ask natural language questions about the property market and get data-backed answers.

```
┌─────────────────────────────────────────────────┐
│              SUBSCRIBER AGENT                    │
│                                                  │
│  System prompt: Irish property analyst persona   │
│  Model: Claude Sonnet                            │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │            MCP TOOL SET                    │  │
│  │                                            │  │
│  │  get_town_metrics(town, period)            │  │
│  │  search_sales(filters)                     │  │
│  │  search_listings(filters)                  │  │
│  │  search_rentals(filters)                   │  │
│  │  get_comparable_sales(address, radius_km)  │  │
│  │  get_planning_pipeline(town, status)       │  │
│  │  calculate_yield(purchase_price, beds, town)│  │
│  │  compare_towns(town_a, town_b)             │  │
│  │  get_affordability(household_income, town)  │  │
│  │  get_commute_time(town, destination)        │  │
│  │  get_market_pulse(town, weeks_back)         │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  Guardrails:                                     │
│  - Never give specific investment advice          │
│  - Always caveat with "this is data analysis,     │
│    not financial advice"                          │
│  - Rate-limited per subscriber tier              │
│  - Responses cite specific data points           │
└─────────────────────────────────────────────────┘
```

### 5.2 MCP server — full tool definitions

```typescript
// mcp/property-intelligence-server.ts

import { Server } from '@modelcontextprotocol/sdk/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';

const server = new Server({
  name: 'property-intelligence',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {},
    resources: {}
  }
});

// ─── TOOL DEFINITIONS ───

server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'get_town_metrics',
      description: `Get summary property market metrics for an Irish Midlands town.
Returns: median price (12m and 3m), YoY change, active listings count,
active rentals count, median rent, gross yield, sales volume, and
supply pipeline (approved units).`,
      inputSchema: {
        type: 'object',
        properties: {
          town: {
            type: 'string',
            description: 'Town name (e.g., "mullingar", "athlone", "tullamore")'
          },
          period_months: {
            type: 'number',
            description: 'Lookback period in months (default 12)',
            default: 12
          }
        },
        required: ['town']
      }
    },

    {
      name: 'search_sales',
      description: `Search Property Price Register sales records with filters.
Returns: list of sales with address, price, date, beds, property type,
and distance from a reference point if coordinates provided.`,
      inputSchema: {
        type: 'object',
        properties: {
          town: { type: 'string', description: 'Filter by town' },
          county: { type: 'string', description: 'Filter by county' },
          min_price: { type: 'number', description: 'Minimum sale price' },
          max_price: { type: 'number', description: 'Maximum sale price' },
          beds: { type: 'number', description: 'Number of bedrooms' },
          property_type: {
            type: 'string',
            enum: ['house', 'apartment', 'any'],
            description: 'Property type filter'
          },
          is_new: { type: 'boolean', description: 'New builds only' },
          date_from: { type: 'string', description: 'Sales from date (YYYY-MM-DD)' },
          date_to: { type: 'string', description: 'Sales to date (YYYY-MM-DD)' },
          near_lat: { type: 'number', description: 'Latitude for proximity search' },
          near_lng: { type: 'number', description: 'Longitude for proximity search' },
          radius_km: { type: 'number', description: 'Search radius in km (default 5)', default: 5 },
          limit: { type: 'number', description: 'Max results (default 20)', default: 20 },
          sort: {
            type: 'string',
            enum: ['date_desc', 'date_asc', 'price_desc', 'price_asc', 'distance'],
            default: 'date_desc'
          }
        }
      }
    },

    {
      name: 'search_listings',
      description: `Search active property listings from Daft.ie and MyHome.ie.
Returns: list of active for-sale listings with address, asking price,
beds, baths, property type, BER rating, days on market, and agent.`,
      inputSchema: {
        type: 'object',
        properties: {
          town: { type: 'string' },
          min_price: { type: 'number' },
          max_price: { type: 'number' },
          beds: { type: 'number' },
          property_type: { type: 'string', enum: ['house', 'apartment', 'any'] },
          min_ber: { type: 'string', description: 'Minimum BER rating (e.g., "B2")' },
          sort: { type: 'string', enum: ['price_asc', 'price_desc', 'newest', 'oldest'] },
          limit: { type: 'number', default: 20 }
        }
      }
    },

    {
      name: 'search_rentals',
      description: `Search active rental listings.
Returns: rental listings with address, monthly rent, beds, property type.`,
      inputSchema: {
        type: 'object',
        properties: {
          town: { type: 'string' },
          min_rent: { type: 'number' },
          max_rent: { type: 'number' },
          beds: { type: 'number' },
          limit: { type: 'number', default: 20 }
        }
      }
    },

    {
      name: 'get_comparable_sales',
      description: `Run a full comparable analysis for a specific property or address.
Uses PostGIS proximity search + AI assessment to find and rank the most
relevant comparable sales, then estimates a realistic value range.
This is the most compute-intensive tool — use when a user asks
"what is X worth?" or "is this good value?".`,
      inputSchema: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Full property address' },
          town: { type: 'string' },
          beds: { type: 'number' },
          property_type: { type: 'string', enum: ['house', 'apartment'] },
          asking_price: { type: 'number', description: 'Current asking price if known' },
          is_new: { type: 'boolean', default: false },
          ber_rating: { type: 'string' },
          radius_km: { type: 'number', default: 5 }
        },
        required: ['address', 'town', 'beds', 'property_type']
      }
    },

    {
      name: 'get_planning_pipeline',
      description: `Get planning applications and decisions for a town or area.
Returns: list of planning applications with reference, description,
decision status, units proposed, and dates.`,
      inputSchema: {
        type: 'object',
        properties: {
          town: { type: 'string' },
          county: { type: 'string' },
          status: {
            type: 'string',
            enum: ['granted', 'refused', 'pending', 'appealed', 'all'],
            default: 'all'
          },
          min_units: { type: 'number', description: 'Minimum residential units (filter out small extensions)' },
          date_from: { type: 'string' },
          limit: { type: 'number', default: 20 }
        }
      }
    },

    {
      name: 'calculate_yield',
      description: `Calculate estimated rental yield for a property investment.
Takes purchase price and property details, finds comparable rental
evidence, and returns gross and net yield estimates with full
cost breakdown.`,
      inputSchema: {
        type: 'object',
        properties: {
          purchase_price: { type: 'number', description: 'Purchase price in euros' },
          town: { type: 'string' },
          beds: { type: 'number' },
          property_type: { type: 'string', enum: ['house', 'apartment'] },
          is_new: { type: 'boolean', default: false },
          management_fee_annual: { type: 'number', description: 'Annual management fee (apartments)' }
        },
        required: ['purchase_price', 'town', 'beds', 'property_type']
      }
    },

    {
      name: 'compare_towns',
      description: `Side-by-side comparison of two or more Midlands towns across
all key metrics: price, yield, supply pipeline, affordability,
amenities, commute, and market liquidity.`,
      inputSchema: {
        type: 'object',
        properties: {
          towns: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of town names to compare (2-5 towns)',
            minItems: 2,
            maxItems: 5
          }
        },
        required: ['towns']
      }
    },

    {
      name: 'get_affordability',
      description: `Calculate what a household can afford in a given town, based on
Central Bank mortgage rules (3.5x LTI for FTBs, 90% LTV for FTBs /
80% LTV for non-FTBs). Compares against current median prices
and active listings to show what's actually available within budget.`,
      inputSchema: {
        type: 'object',
        properties: {
          household_income: { type: 'number', description: 'Combined gross annual household income' },
          deposit: { type: 'number', description: 'Available deposit in euros' },
          is_first_time_buyer: { type: 'boolean', default: true },
          town: { type: 'string' },
          beds_needed: { type: 'number' }
        },
        required: ['household_income', 'town']
      }
    },

    {
      name: 'get_commute_time',
      description: `Get estimated commute time from a Midlands town to a destination
(typically Dublin city centre or another major employer hub).
Returns drive time, public transport time, and rail options if available.`,
      inputSchema: {
        type: 'object',
        properties: {
          from_town: { type: 'string' },
          to: {
            type: 'string',
            description: 'Destination (e.g., "dublin_city", "dublin_airport", "galway", or a specific address)',
            default: 'dublin_city'
          },
          departure_time: {
            type: 'string',
            description: 'Departure time for traffic estimation (e.g., "08:00")',
            default: '08:00'
          }
        },
        required: ['from_town']
      }
    },

    {
      name: 'get_market_pulse',
      description: `Get an AI-generated summary of recent market activity for a town.
Returns the most recent published analysis plus any events since then.
Good for answering "what's happening in Mullingar right now?".`,
      inputSchema: {
        type: 'object',
        properties: {
          town: { type: 'string' },
          weeks_back: { type: 'number', default: 4, description: 'How many weeks of history to include' }
        },
        required: ['town']
      }
    }
  ]
}));

// ─── TOOL HANDLERS ───

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'get_town_metrics':
      return handleGetTownMetrics(args);
    case 'search_sales':
      return handleSearchSales(args);
    case 'search_listings':
      return handleSearchListings(args);
    case 'search_rentals':
      return handleSearchRentals(args);
    case 'get_comparable_sales':
      return handleComparableAnalysis(args);
    case 'get_planning_pipeline':
      return handlePlanningPipeline(args);
    case 'calculate_yield':
      return handleYieldCalculation(args);
    case 'compare_towns':
      return handleCompareTowns(args);
    case 'get_affordability':
      return handleAffordability(args);
    case 'get_commute_time':
      return handleCommuteTime(args);
    case 'get_market_pulse':
      return handleMarketPulse(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// ─── RESOURCE DEFINITIONS ───

server.setRequestHandler('resources/list', async () => ({
  resources: [
    {
      uri: 'property://towns',
      name: 'Covered towns',
      description: 'List of all towns in the coverage area with basic info',
      mimeType: 'application/json'
    },
    {
      uri: 'property://reports/weekly/latest',
      name: 'Latest weekly report',
      description: 'Most recent published weekly market pulse',
      mimeType: 'text/markdown'
    }
  ]
}));

// ─── START SERVER ───

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
```

### 5.3 Subscriber agent system prompt

```typescript
// agents/subscriber-agent.ts

const SUBSCRIBER_AGENT_PROMPT = `You are the AI property analyst for
"The Midlands Property Analyst" — Ireland's data-driven property
intelligence service covering the Midlands corridor.

YOUR IDENTITY:
- You are an experienced property analyst, not a chatbot
- You have deep knowledge of the Irish property market, particularly
  the Midlands region (Westmeath, Offaly, Laois, Longford, and the
  commuter belt)
- You are direct, data-driven, and willing to give an opinion when
  the data supports it
- You know the local landscape: the developments, the agents, the
  planning pipeline, the commute realities

YOUR TOOLS:
You have access to a comprehensive property database via MCP tools.
Use them aggressively — never guess when you can query. For every
claim you make, there should be data behind it.

APPROACH:
1. When asked about a property or town, always start by pulling
   current metrics with get_town_metrics
2. For valuation questions, always run get_comparable_sales
3. For investment questions, always run calculate_yield
4. For "where should I buy?" questions, use compare_towns with
   the relevant candidates, then get_affordability if income is known
5. Cross-reference multiple data points — don't rely on a single metric

TONE:
- Authoritative but warm. You're talking to someone making a major
  life decision.
- Use specific numbers. "Mullingar 3-beds are at €328k median"
  beats "prices have risen"
- Be honest about data limitations. If you have thin evidence,
  say so.
- Occasional local colour is welcome — "the Lakepoint end of
  Mullingar has always commanded a premium" — but only if grounded
  in data

GUARDRAILS:
- You provide data analysis, not financial advice. Include a brief
  caveat when giving investment-related analysis.
- Never recommend a specific property to buy — present the data
  and let the subscriber decide
- If asked about areas outside your coverage, say so and offer to
  analyse the data you do have
- Never fabricate data. If a tool returns no results, say
  "I don't have data on that" rather than estimating

SUBSCRIBER CONTEXT:
The subscriber's profile is provided in the conversation context.
Use their watched towns, persona type, and previous questions to
personalise responses. Don't explicitly reference their profile —
just naturally orient toward their interests.`;
```

---

## 6. Orchestrator agent — the conductor

### 6.1 Event routing logic

The orchestrator agent runs continuously (or is triggered by new events) and decides what actions to take.

```typescript
// agents/orchestrator.ts

interface OrchestratorDecision {
  action: string;
  agent: string;
  priority: 'immediate' | 'batch' | 'deferred';
  payload: any;
}

const ORCHESTRATOR_PROMPT = `You are the orchestrator agent for a property
intelligence platform. You receive system events and decide what actions
to take.

EVENT → ACTION MAPPING:

ppr.new_sales
  → IMMEDIATE: Run anomaly detection on new sales
  → BATCH: Queue metrics refresh for affected towns
  → BATCH: Queue comparable re-analysis for active listings in affected towns

listing.new
  → IMMEDIATE: Run comparable analysis (is this fairly priced?)
  → BATCH: Update active listings count for town
  → DEFERRED: If 5+ new listings in same development, flag as "developer release"

listing.price_change (direction: down)
  → IMMEDIATE: Flag as potential story (price reduction = market signal)
  → BATCH: Update asking price distributions

listing.sold
  → IMMEDIATE: Calculate asking-vs-sold delta, update metrics
  → IMMEDIATE: If sold significantly over asking (>10%), flag as anomaly
  → BATCH: Re-run yield calculations for town

planning.decision (granted, units > 10)
  → IMMEDIATE: Flag as editorial story
  → BATCH: Update supply pipeline score for town

anomaly.detected (severity: high)
  → IMMEDIATE: Send Slack notification to editor for human review
  → IMMEDIATE: Queue draft of anomaly explainer

metrics.refresh_complete
  → BATCH: Queue weekly newsletter draft generation (if Sunday)
  → BATCH: Queue town ranking refresh (if end of quarter)
  → DEFERRED: Queue social media content generation

For each event, output a JSON array of decisions with action, target agent,
priority, and payload. Immediate actions are executed now. Batch actions
are queued for the next processing window. Deferred actions are scheduled
for a specific future time.`;
```

### 6.2 n8n orchestration workflow

```
┌──────────────┐
│  Event poll   │  Polls events table every 5 minutes
│  (Schedule)   │  for unconsumed events
└──────┬───────┘
       │
┌──────▼───────┐
│  Filter:     │  Skip events already consumed by orchestrator
│  unconsumed  │
└──────┬───────┘
       │
┌──────▼───────┐
│  Orchestrator│  Claude Haiku decides actions
│  agent call  │
└──────┬───────┘
       │
┌──────▼───────┐
│  Route by    │  Switch node on priority
│  priority    │
└──┬───┬───┬───┘
   │   │   │
   ▼   ▼   ▼
 IMM BATCH DEF
   │   │   │
   ▼   ▼   ▼
 Execute  Queue in    Schedule
 agent    Redis       for later
 now      (process    (n8n cron)
          at next
          window)
```

---

## 7. Quality gates and human-in-the-loop

### 7.1 Where humans are required

| Gate | Trigger | Human action | SLA |
|---|---|---|---|
| **Editorial review** | Draft newsletter generated | Approve, edit, or reject before publish | 4 hours before publish time |
| **Anomaly triage** | High-severity anomaly detected | Confirm or dismiss; decide if it's a story | 24 hours |
| **Data quality** | Normalisation confidence < 0.7 | Review and correct classification | Weekly batch |
| **Comparable override** | Comp analysis confidence < 0.6 | Review comparable selection, adjust if needed | Before subscriber delivery |
| **New town launch** | Town added to coverage | Review first week's data for completeness | One-time |

### 7.2 Editor interface

A simple admin dashboard (React + Tailwind) for the human editor:

```
┌─────────────────────────────────────────────────────┐
│  EDITORIAL DASHBOARD                                │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  PENDING REVIEW (3)                         │    │
│  │                                             │    │
│  │  📝 Weekly Pulse — Week ending 29 Mar 2026 │    │
│  │     Status: DRAFT  │  ✅ Approve  │ ✏ Edit │    │
│  │                                             │    │
│  │  ⚠️ Anomaly: €620k sale at Lynn Ave        │    │
│  │     Status: UNREVIEWED │ ✅ Confirm │ ❌     │    │
│  │                                             │    │
│  │  📊 Town Ranking Q1 2026                   │    │
│  │     Status: DRAFT  │  ✅ Approve  │ ✏ Edit │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  DATA QUALITY                               │    │
│  │  12 records pending review (confidence < 0.7)│    │
│  │  [Review batch →]                           │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  PIPELINE STATUS                            │    │
│  │  PPR: ✅ Last run 23 Mar │ 4 new records   │    │
│  │  Daft: ✅ Last run today │ 61 listings      │    │
│  │  Rentals: ✅ Last run today │ 8 listings    │    │
│  │  ePlanning: ✅ Last run 24 Mar │ 3 new apps │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

---

## 8. Infrastructure — complete Docker Compose

```yaml
# docker-compose.yml — full agentic stack

version: '3.8'

services:

  # ─── DATA LAYER ───

  postgres:
    image: postgis/postgis:16-3.4
    restart: unless-stopped
    environment:
      POSTGRES_DB: property_intel
      POSTGRES_USER: property
      POSTGRES_PASSWORD: ${PG_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./db/init:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U property -d property_intel"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

  # ─── INGESTION LAYER ───

  n8n:
    image: n8nio/n8n:latest
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DB_TYPE: postgresdb
      DB_POSTGRESDB_HOST: postgres
      DB_POSTGRESDB_PORT: 5432
      DB_POSTGRESDB_DATABASE: n8n_workflows
      DB_POSTGRESDB_USER: property
      DB_POSTGRESDB_PASSWORD: ${PG_PASSWORD}
      N8N_BASIC_AUTH_ACTIVE: true
      N8N_BASIC_AUTH_USER: ${N8N_USER}
      N8N_BASIC_AUTH_PASSWORD: ${N8N_PASSWORD}
      WEBHOOK_URL: http://n8n:5678/
      GENERIC_TIMEZONE: Europe/Dublin
    ports:
      - "5678:5678"
    volumes:
      - n8n_data:/home/node/.n8n

  playwright:
    build:
      context: ./scrapers
      dockerfile: Dockerfile.playwright
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://property:${PG_PASSWORD}@postgres:5432/property_intel
    # No exposed ports — called internally by n8n via HTTP

  # ─── INTELLIGENCE LAYER ───

  api:
    build:
      context: ./api
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    environment:
      DATABASE_URL: postgresql://property:${PG_PASSWORD}@postgres:5432/property_intel
      REDIS_URL: redis://redis:6379
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      CLAUDE_MODEL_FAST: claude-haiku-4-5-20251001
      CLAUDE_MODEL_QUALITY: claude-sonnet-4-20250514
      JWT_SECRET: ${JWT_SECRET}
      SUBSTACK_WEBHOOK_SECRET: ${SUBSTACK_WEBHOOK_SECRET}
      SLACK_WEBHOOK_URL: ${SLACK_WEBHOOK_URL}
      NODE_ENV: production
      PORT: 3001
    ports:
      - "3001:3001"

  analysis:
    build:
      context: ./analysis
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://property:${PG_PASSWORD}@postgres:5432/property_intel
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    # Runs as a worker — no exposed ports
    # Triggered by n8n webhooks or Redis queue

  mcp-server:
    build:
      context: ./mcp
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://property:${PG_PASSWORD}@postgres:5432/property_intel
      MCP_SERVER_PORT: 3002
    ports:
      - "3002:3002"

  # ─── PRESENTATION LAYER (Phase 3) ───

  web:
    build:
      context: ./web
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      - api
    environment:
      NEXT_PUBLIC_API_URL: http://api:3001
      NEXT_PUBLIC_MAPBOX_TOKEN: ${MAPBOX_TOKEN}
    ports:
      - "3000:3000"

  # ─── ADMIN ───

  admin:
    build:
      context: ./admin
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      - api
    environment:
      API_URL: http://api:3001
    ports:
      - "3003:3003"

volumes:
  pgdata:
  redisdata:
  n8n_data:
```

**Playwright Dockerfile:**

```dockerfile
# scrapers/Dockerfile.playwright
FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

EXPOSE 3010
CMD ["node", "server.js"]
```

---

## 9. API internal endpoints (agent communication)

```typescript
// api/routes/internal.ts
// These endpoints are NOT exposed publicly — internal service-to-service only

import { Hono } from 'hono';

const internal = new Hono();

// n8n calls this to trigger normalisation
internal.post('/agents/normalise-sales', async (c) => {
  const { records } = await c.req.json();
  const normalised = await normaliseSalesBatch(records);
  return c.json({ normalised, count: normalised.length });
});

// n8n calls this to trigger normalisation of listings
internal.post('/agents/normalise-listings', async (c) => {
  const { records } = await c.req.json();
  const normalised = await normaliseListingsBatch(records);
  return c.json({ normalised, count: normalised.length });
});

// n8n calls this to emit events
internal.post('/events', async (c) => {
  const event = await c.req.json();
  await db.query(
    'INSERT INTO events (type, payload) VALUES ($1, $2)',
    [event.type, JSON.stringify(event.payload)]
  );
  return c.json({ ok: true });
});

// Orchestrator polls this
internal.get('/events/unconsumed', async (c) => {
  const events = await db.query(`
    SELECT * FROM events
    WHERE NOT ('orchestrator' = ANY(consumed_by))
    ORDER BY created_at ASC
    LIMIT 50
  `);
  return c.json(events.rows);
});

// Mark events as consumed
internal.post('/events/consume', async (c) => {
  const { event_ids, consumer } = await c.req.json();
  await db.query(`
    UPDATE events
    SET consumed_by = array_append(consumed_by, $1)
    WHERE id = ANY($2::int[])
  `, [consumer, event_ids]);
  return c.json({ ok: true });
});

// Trigger comparable analysis
internal.post('/agents/comparable-analysis', async (c) => {
  const target = await c.req.json();
  const result = await runComparableAnalysis(target);
  return c.json(result);
});

// Trigger weekly pulse generation
internal.post('/agents/generate-weekly-pulse', async (c) => {
  const { week_ending } = await c.req.json();
  const data = await assembleWeeklyPulseData(week_ending);
  const draft = await generateWeeklyPulse(data);
  await saveDraft('weekly_pulse', week_ending, draft);
  await notifyEditor('weekly_pulse', week_ending);
  return c.json({ ok: true, subject: draft.suggested_subject });
});

// Trigger anomaly detection
internal.post('/agents/detect-anomalies', async (c) => {
  const { town, data } = await c.req.json();
  const anomalies = await detectAnomalies(town, data);
  for (const anomaly of anomalies) {
    await db.query(
      'INSERT INTO events (type, payload) VALUES ($1, $2)',
      ['anomaly.detected', JSON.stringify(anomaly)]
    );
  }
  return c.json({ anomalies });
});

export default internal;
```

---

## 10. Cost model — agent compute budget

### 10.1 Claude API usage estimates (monthly)

| Agent | Model | Calls/month | Avg tokens/call | Monthly tokens | Cost estimate |
|---|---|---|---|---|---|
| PPR normalisation | Haiku | 4 | 8,000 in + 4,000 out | 48,000 | ~€0.10 |
| Listings normalisation | Haiku | 30 | 6,000 in + 3,000 out | 270,000 | ~€0.50 |
| Planning parser | Haiku | 8 | 10,000 in + 5,000 out | 120,000 | ~€0.25 |
| Anomaly detection | Haiku | 30 | 4,000 in + 1,000 out | 150,000 | ~€0.30 |
| Orchestrator | Haiku | 300 | 2,000 in + 500 out | 750,000 | ~€1.50 |
| Comparable analysis | Sonnet | 60 | 6,000 in + 2,000 out | 480,000 | ~€3.60 |
| Yield analysis | Sonnet | 30 | 4,000 in + 1,500 out | 165,000 | ~€1.25 |
| Weekly pulse draft | Sonnet | 4 | 12,000 in + 4,000 out | 64,000 | ~€0.50 |
| Town ranking | Sonnet | 1 | 15,000 in + 5,000 out | 20,000 | ~€0.15 |
| Chart planning | Haiku | 4 | 3,000 in + 1,000 out | 16,000 | ~€0.03 |
| Social writer | Haiku | 8 | 4,000 in + 2,000 out | 48,000 | ~€0.10 |
| Subscriber agent (Phase 3) | Sonnet | 500 | 8,000 in + 3,000 out | 5,500,000 | ~€41.00 |
| **Total (Phase 2, no subscriber agent)** | | | | **~2.1M tokens** | **~€8.30/month** |
| **Total (Phase 3, with subscriber agent)** | | | | **~7.6M tokens** | **~€49.30/month** |

### 10.2 Total monthly infrastructure cost

| Component | Phase 2 | Phase 3 |
|---|---|---|
| PostgreSQL (managed) | €25 | €50 |
| n8n (self-hosted) | €15 | €15 |
| API server | €15 | €30 |
| Redis | €5 | €10 |
| Web app hosting | €0 | €20 |
| Object storage | €3 | €10 |
| Claude API | €8 | €50 |
| Playwright (scraping) | €5 | €5 |
| Mapbox (Phase 3) | €0 | €20 |
| Monitoring (Sentry + PostHog) | €0 | €0 |
| Domain + DNS | €2 | €2 |
| **Total** | **~€78/month** | **~€212/month** |

Break-even at Phase 2 pricing (€12/month): **7 paid subscribers.**
Break-even at Phase 3 blended pricing: **~18 paid subscribers.**

---

## 11. Development roadmap — build sequence

### Sprint 0 — Foundation (Week 1-2)

- [ ] Set up monorepo structure (`/api`, `/analysis`, `/scrapers`, `/mcp`, `/web`, `/admin`, `/db`)
- [ ] Docker Compose with Postgres + PostGIS + n8n + Redis
- [ ] Database schema: `sales`, `listings`, `rentals`, `planning`, `towns`, `events`
- [ ] Seed `towns` table with launch towns (Mullingar, Athlone, Tullamore) + coordinates
- [ ] Basic API server (Hono) with health check and internal routes
- [ ] Environment variable management (`.env` + Docker secrets)

### Sprint 1 — PPR Pipeline (Week 3-4)

- [ ] n8n workflow: PPR CSV download + parse
- [ ] Deduplication logic (source_hash)
- [ ] Normalisation agent (Claude Haiku): address parsing, town extraction
- [ ] Geocoding cascade (Nominatim + town centroid fallback)
- [ ] Event emission: `ppr.new_sales`
- [ ] Materialised view: `town_metrics`
- [ ] Verify: load historical PPR data for covered towns (2020-present)

### Sprint 2 — Listings Pipeline (Week 5-6)

- [ ] Playwright scraper for Daft.ie listings (for-sale)
- [ ] Playwright scraper for Daft.ie sold properties
- [ ] Playwright scraper for Daft.ie rentals
- [ ] n8n workflow: daily scrape → normalise → upsert
- [ ] Change detection: price changes, new, sold, withdrawn
- [ ] Event emission: `listing.*`, `rental.*`
- [ ] Rate limiting and error handling for scrapers

### Sprint 3 — Analysis Agents (Week 7-8)

- [ ] Comparable analysis agent (Sonnet)
- [ ] Yield analysis agent (Sonnet)
- [ ] Anomaly detection agent (Haiku)
- [ ] Metrics refresh pipeline (n8n → SQL → materialised views)
- [ ] Orchestrator agent: event routing logic
- [ ] Slack notifications for high-severity anomalies

### Sprint 4 — Editorial Pipeline (Week 9-10)

- [ ] Draft writer agent: weekly pulse template
- [ ] Chart generation (matplotlib renderer)
- [ ] Social media writer agent
- [ ] Editor admin dashboard (React): review/approve/edit drafts
- [ ] Substack API integration: publish approved drafts
- [ ] End-to-end test: full week cycle from ingestion to published newsletter

### Sprint 5 — Planning + Enrichment (Week 11-12)

- [ ] ePlanning scraper (Westmeath, Offaly, Laois, Longford)
- [ ] Planning parser agent (Haiku)
- [ ] BER register ingestion
- [ ] Town ranking agent: quarterly composite index
- [ ] Professional tier: PDF/CSV data pack generation
- [ ] Expand coverage to Tier 2 towns

### Sprint 6 — Phase 3 Foundations (Week 13-16)

- [ ] MCP server: full tool definitions and handlers
- [ ] Subscriber agent: system prompt + MCP tool bindings
- [ ] Public API (authenticated): `/v1/towns`, `/v1/sales`, etc.
- [ ] Web app: Next.js with town explorer + map
- [ ] Auth (Clerk) + billing (Stripe)
- [ ] Subscriber chat interface (AI analyst)

### Sprint 7 — Phase 3 Polish (Week 17-20)

- [ ] Personalisation: watched towns, custom alerts
- [ ] Interactive yield calculator (React component)
- [ ] Interactive comparable tool
- [ ] Commute time integration (Google Maps / OSM)
- [ ] Professional tier: API key management, usage dashboard
- [ ] Performance optimisation: query caching, CDN for static assets
- [ ] Load testing: subscriber agent under concurrent query load

---

## 12. Repo structure

```
midlands-property-intel/
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── README.md
│
├── db/
│   ├── init/
│   │   ├── 001_extensions.sql          # PostGIS, pg_trgm
│   │   ├── 002_schema.sql              # Core tables
│   │   ├── 003_views.sql               # Materialised views
│   │   └── 004_seed_towns.sql          # Reference data
│   └── migrations/                     # Incremental migrations
│
├── api/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                    # Hono app entry
│   │   ├── routes/
│   │   │   ├── internal.ts             # Agent-to-agent endpoints
│   │   │   ├── public.ts               # Public API v1
│   │   │   └── webhooks.ts             # Substack, Stripe webhooks
│   │   ├── db/
│   │   │   ├── client.ts               # Postgres pool
│   │   │   └── queries.ts              # Typed query functions
│   │   ├── middleware/
│   │   │   ├── auth.ts                 # JWT validation
│   │   │   └── rate-limit.ts           # Per-tier rate limiting
│   │   └── utils/
│   │       └── geocoder.ts             # Geocoding cascade
│   └── tests/
│
├── agents/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── normalise-sales.ts
│   │   ├── normalise-listings.ts
│   │   ├── comparable-analysis.ts
│   │   ├── yield-analysis.ts
│   │   ├── anomaly-detector.ts
│   │   ├── town-ranking.ts
│   │   ├── orchestrator.ts
│   │   ├── draft-writer.ts
│   │   ├── chart-planner.ts
│   │   ├── social-writer.ts
│   │   ├── planning-parser.ts
│   │   └── subscriber-agent.ts
│   ├── prompts/
│   │   ├── normalise-sales.md
│   │   ├── comparable-analysis.md
│   │   ├── weekly-pulse.md
│   │   ├── anomaly-detection.md
│   │   ├── town-ranking.md
│   │   ├── subscriber-agent.md
│   │   └── social-writer.md
│   └── tests/
│
├── scrapers/
│   ├── Dockerfile.playwright
│   ├── package.json
│   ├── src/
│   │   ├── server.ts                   # HTTP server for n8n to call
│   │   ├── daft-listings.ts
│   │   ├── daft-sold.ts
│   │   ├── daft-rentals.ts
│   │   ├── eplanning.ts
│   │   ├── ppr-download.ts
│   │   └── ber-register.ts
│   └── tests/
│
├── analysis/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── src/
│   │   ├── metrics.py                  # Derived metrics computation
│   │   ├── charts/
│   │   │   ├── renderer.py             # matplotlib chart generation
│   │   │   └── templates.py            # Chart style templates
│   │   └── exports/
│   │       ├── pdf_report.py           # PDF generation
│   │       └── csv_export.py           # Data pack CSVs
│   └── tests/
│
├── mcp/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── server.ts                   # MCP server entry
│   │   ├── tools/
│   │   │   ├── town-metrics.ts
│   │   │   ├── search-sales.ts
│   │   │   ├── search-listings.ts
│   │   │   ├── search-rentals.ts
│   │   │   ├── comparable-analysis.ts
│   │   │   ├── planning-pipeline.ts
│   │   │   ├── yield-calculator.ts
│   │   │   ├── compare-towns.ts
│   │   │   ├── affordability.ts
│   │   │   ├── commute-time.ts
│   │   │   └── market-pulse.ts
│   │   └── resources/
│   │       ├── towns.ts
│   │       └── reports.ts
│   └── tests/
│
├── web/                                # Phase 3
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.js
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # Landing page
│   │   ├── towns/
│   │   │   ├── page.tsx                # Town explorer with map
│   │   │   └── [slug]/
│   │   │       └── page.tsx            # Town detail page
│   │   ├── analyst/
│   │   │   └── page.tsx                # AI analyst chat interface
│   │   ├── tools/
│   │   │   ├── yield-calculator/page.tsx
│   │   │   └── comparables/page.tsx
│   │   └── api/                        # Next.js API routes (BFF)
│   └── components/
│
├── admin/
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   │   ├── App.tsx                     # Editor dashboard
│   │   ├── pages/
│   │   │   ├── DraftReview.tsx
│   │   │   ├── AnomalyTriage.tsx
│   │   │   ├── DataQuality.tsx
│   │   │   └── PipelineStatus.tsx
│   │   └── components/
│   └── tests/
│
├── n8n-workflows/
│   ├── ppr-ingest.json
│   ├── daft-listings-ingest.json
│   ├── daft-sold-ingest.json
│   ├── daft-rentals-ingest.json
│   ├── eplanning-ingest.json
│   ├── cso-stats-ingest.json
│   ├── ber-register-ingest.json
│   ├── metrics-refresh.json
│   ├── orchestrator-poll.json
│   ├── weekly-pulse-generate.json
│   └── alert-dispatch.json
│
└── docs/
    ├── architecture.md                 # This document
    ├── brd.md                          # Business requirements
    ├── data-dictionary.md              # Schema documentation
    ├── agent-prompts.md                # All agent system prompts
    ├── runbook.md                      # Operational procedures
    └── adr/                            # Architecture decision records
        ├── 001-postgis-from-day-one.md
        ├── 002-n8n-as-orchestrator.md
        ├── 003-haiku-for-normalisation.md
        ├── 004-sonnet-for-analysis.md
        └── 005-mcp-first-api.md
