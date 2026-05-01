# Sprint 4 — Data Enrichment: BER, Planning, RTB, Anomalies

**Goal**: Enrich the database with three new data pipelines (BER ratings, RTB rents, regulatory monitoring) and wire up the anomaly detector. This gives the weekly pulse richer content, enables BER premium analysis, and makes yield calculations work against real rent data. Expand coverage from 3 to 6 towns.

**Estimated time**: 6–8 days.

**Prerequisites**: Sprint 3 complete. Weekly pulse pipeline running. PPR data loaded nationally. Agent prompts for planning parser, anomaly detector, and regulatory monitor already exist in `packages/agents/prompts/operational-agents.md`.

---

## Task 4.1 — BER data ingestion pipeline

Ingest SEAI BER Research Tool data into the `ber_ratings` table. The SEAI publishes anonymised BER data as a bulk CSV download, updated nightly.

Create `packages/scrapers/src/ber.ts`:

```typescript
export async function ingestBer(): Promise<{ inserted: number; skipped: number }>;
```

Pipeline:
1. Download the BER CSV from the SEAI Research Tool (publicly accessible, CSV format)
2. Parse the CSV — key columns: BER number, issue date, rating (A1–G), energy value (kWh/m²/yr), dwelling type, year built, floor area, heating type, wall type, county, eircode routing key
3. Map to `ber_ratings` schema
4. Upsert with `ON CONFLICT (ber_number) DO UPDATE` for refreshed ratings
5. Link to `town_id` where eircode routing key matches a covered town

Cron: monthly (`/api/cron/ber-refresh`, already in vercel.json at 03:00 on the 1st).

**Test**: Ingest a sample BER CSV, verify records land in `ber_ratings` with correct typing.

---

## Task 4.2 — BER premium analysis query

Create `packages/db/src/queries/ber-analysis.ts` that cross-references BER ratings with PPR sales to surface the BER premium — how much more an A-rated home sells for vs a D-rated one in the same town.

```typescript
export async function berPremiumByTown(townId: number): Promise<{
  rating: string;
  medianPrice: number;
  saleCount: number;
  premiumVsD: number | null;
}[]>;
```

Logic:
- Join `sales` (via eircode routing key or town_id) with `ber_ratings`
- Group by BER rating band (A, B, C, D, E+)
- Compute median price per band
- Calculate premium as percentage vs D-rated baseline
- Only include bands with 5+ sales for statistical relevance

This powers a "BER premium" section in the weekly pulse and property analysis.

**Test**: For a town with BER data, returns meaningful premium differentials.

---

## Task 4.3 — RTB Rent Index ingestion

Ingest RTB/ESRI Rent Index quarterly data into the `rtb_rents` table. The RTB publishes standardised rents by county, property type, bedroom count, and tenancy type.

Create `packages/scrapers/src/rtb.ts`:

```typescript
export async function ingestRtbRents(): Promise<{ inserted: number; skipped: number }>;
```

Pipeline:
1. Download the RTB Rent Index data (published quarterly as Excel/CSV on rtb.ie)
2. Parse quarterly data: county, property type, bedrooms, new/existing tenancy, standardised monthly rent, sample size
3. Upsert into `rtb_rents` with `ON CONFLICT (quarter, county) DO UPDATE`

This enables the yield analysis agent (Sprint 2) to work against real rent data rather than requiring manual input.

Cron: quarterly (manual trigger or as part of CSO refresh cron).

**Test**: After ingestion, `findRentBenchmark({ county: 'Westmeath' })` returns a real RTB figure.

---

## Task 4.4 — Regulatory monitor cron

Build the daily regulatory monitoring pipeline. The system checks key government pages for content changes and, when a change is detected, uses the Regulatory Monitor Agent to determine if it's material.

Create `packages/scrapers/src/regulatory.ts`:

```typescript
export async function checkRegulatoryPages(): Promise<{
  checked: number;
  changed: number;
  material: number;
}>;
```

Pipeline:
1. Maintain a list of monitored URLs (SEAI grants page, Croí Cónaithe page, Revenue HTB page, etc.) — store in a config table or hardcoded initially
2. Fetch each page, compute SHA-256 hash of the main content (strip nav/footer/boilerplate)
3. Compare against the last stored hash (in `events` table or a dedicated `page_hashes` table)
4. If changed: extract the old and new content, call the Regulatory Monitor Agent (Haiku)
5. If the agent returns `is_material: true`: store as an event, optionally notify via Slack

Cron: daily at 07:00 UTC (`/api/cron/regulatory-scan`, already in vercel.json).

Wire the agent wrapper:
```typescript
// in packages/agents/src/index.ts
export async function checkRegulatoryChange(input: {
  url: string;
  old_content: string;
  new_content: string;
}): Promise<RegulatoryChangeResult>;
```

**Test**: With fixture HTML showing a grant amount change, the agent correctly flags `is_material: true`.

---

## Task 4.5 — Anomaly detector agent + cron

Wire the anomaly detector agent and its weekly cron trigger.

Agent wrapper in `packages/agents/src/index.ts`:
```typescript
export async function detectAnomalies(input: {
  town: string;
  current_metrics: TownMetric;
  baseline_metrics: TownMetric;
}): Promise<AnomalyDetectionResult>;
```

Build `packages/db/src/queries/anomalies.ts`:
- Query current and baseline (same period last year) town metrics
- Pass to the anomaly detector agent
- Store flagged anomalies in the `events` table

Cron: weekly on Monday at 06:00 UTC (`/api/cron/anomaly-detect`, already in vercel.json).

The cron handler:
1. For each active town: fetch current metrics and YoY baseline
2. Call `detectAnomalies()` for each town
3. Store any `high` significance anomalies as events
4. Notify via Slack if high-severity anomalies detected

**Test**: With fixture metrics showing a 15% YoY price spike on 20+ sales, the agent flags it as `high`.

---

## Task 4.6 — Expand coverage to 6 towns

Add 3 new towns to the `towns` table. Per the docs, the initial Midlands focus includes:
- Mullingar (existing)
- Athlone (existing)
- Tullamore (existing)
- **Longford** (new — Longford county, €185K median, strong grant-stacking potential)
- **Portlaoise** (new — Laois county, €308K median, M7 motorway corridor)
- **Carrick-on-Shannon** (new — Leitrim county, different market dynamic, low median)

Implementation:
1. Insert new towns into `towns` table with correct centroids, eircode routing keys, and radii
2. The PPR data is already national — new towns will automatically appear in the weekly pulse and analysis queries
3. Verify `town_metrics` MV refreshes correctly with 6 towns
4. Update the seed script if needed

**Test**: After insertion, `assembleWeeklyPulseData()` returns data for all 6 towns.

---

## Task 4.7 — Enrich weekly pulse with new data sources

Update the `assembleWeeklyPulseData()` function and the draft writer input to include:
- BER premium summary per town (from task 4.2)
- Any anomalies detected this week (from task 4.5)
- Any material regulatory changes (from task 4.4)

Update the `WeeklyPulseInput` type in the agents package to include optional `ber_premium`, `anomalies`, and `regulatory_changes` fields. The draft writer prompt already has sections for grant intelligence and "The number" — these new data sources feed into those sections naturally.

**Test**: Weekly pulse draft references BER data and anomalies when available.

---

## Done when

- [ ] BER data ingested and queryable by eircode/town
- [ ] BER premium analysis shows price differentials by rating band
- [ ] RTB rents ingested; yield analysis works against real data
- [ ] Regulatory monitor checks pages daily and flags material changes
- [ ] Anomaly detector runs weekly and surfaces meaningful signals
- [ ] 6 towns covered (3 new: Longford, Portlaoise, Carrick-on-Shannon)
- [ ] Weekly pulse includes BER, anomaly, and regulatory data when available
- [ ] All new cron handlers follow the existing auth + error handling pattern

Once complete, move to Sprint 5 (Paywall + Pro Tier — see `docs/03-solo-architecture.md` § Sprint 5).
