# Sprint 1 — PPR Pipeline

**Goal**: First real data flowing. PPR records ingested, normalised, geocoded to the closest town, and town-level metrics computed.

**Estimated time**: 4-5 days.

**Prerequisites**: Sprint 0 complete.

---

## Task 1.1 — Implement `downloadPprCsv()`

The PPR is published at https://www.propertypriceregister.ie/website/npsra/pprweb.nsf/page/ppr-home-en

The site uses a POST form submission to download. Inspect the form in dev tools to find the right URL and parameters. Cache the response in Cloudflare R2 with the date as the key (so we can re-process without re-downloading).

The CSV uses **Windows-1252 encoding**. Use `iconv-lite` to decode to UTF-8 before parsing.

For initial development, you can also work from a hand-downloaded CSV in `/tmp` to avoid hitting the live site repeatedly.

**File**: `packages/scrapers/src/ppr.ts`
**Tests**: write a unit test in `packages/scrapers/src/__tests__/ppr.test.ts` that runs against a fixture CSV.

---

## Task 1.2 — Implement `parsePprCsv()`

Parse the CSV using `papaparse`. Handle:
- Quoted fields with embedded commas
- Date format `dd/mm/yyyy` → ISO `YYYY-MM-DD`
- Price format `"€100,000.00"` → number `100000`
- "Yes"/"No" → boolean
- Empty Eircode → null

Output type: `PprRow[]` (already defined in `ppr.ts`).

**Test**: parse a fixture CSV, verify a known row matches expected typed values.

---

## Task 1.3 — Implement `computePprUid()` properly

Use `node:crypto` to compute SHA-256 of the normalised key, take first 16 hex chars.

```typescript
import { createHash } from 'node:crypto';

export function computePprUid(row: PprRow): string {
  const key = `${row.saleDate}|${row.address.toUpperCase().replace(/\s+/g, ' ').trim()}|${row.price.toFixed(2)}`;
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}
```

**Test**: same input always produces same hash; different prices/dates/addresses produce different hashes.

---

## Task 1.4 — Implement `findNewRows()`

Query the database for existing `ppr_uid` values, return only rows whose computed UID isn't in the database.

```typescript
import { db, sales } from '@properdata/db';
import { inArray } from 'drizzle-orm';

export async function findNewRows(rows: PprRow[]): Promise<PprRow[]> {
  const uids = rows.map(computePprUid);
  // Batch the IN query if uids.length > 5000 (Postgres has limits)
  const existing = await db
    .select({ pprUid: sales.pprUid })
    .from(sales)
    .where(inArray(sales.pprUid, uids));
  const existingSet = new Set(existing.map((r) => r.pprUid));
  return rows.filter((row) => !existingSet.has(computePprUid(row)));
}
```

---

## Task 1.5 — Wire up the normalisation agent

For each new row, call the `normaliseSale()` agent function (already in `packages/agents/src/index.ts`).

The agent returns town name + county. Match the town name against the `towns` table to get a `townId`. If no match, set `townId: null` (the row is still ingested, just not associated with a covered town).

**Optimisation**: batch the agent calls. Send 10-20 rows at a time in a single Anthropic API request to reduce latency and cost. The Haiku model handles batches well.

---

## Task 1.6 — Insert with deduplication

Insert all new sales into the `sales` table. Use Drizzle's `onConflictDoNothing()` on the `ppr_uid` unique index in case of race conditions.

```typescript
await db
  .insert(sales)
  .values(newSalesRecords)
  .onConflictDoNothing({ target: sales.pprUid });
```

---

## Task 1.7 — Implement `ingestPpr()` orchestration

Tie it all together in the top-level `ingestPpr()` function:

```typescript
export async function ingestPpr(): Promise<PprIngestResult> {
  const csvText = await downloadPprCsv();
  const allRows = parsePprCsv(csvText);
  const newRows = await findNewRows(allRows);

  let inserted = 0;
  let errors = 0;
  // Process in batches of 20
  for (const batch of chunk(newRows, 20)) {
    try {
      const normalised = await Promise.all(batch.map((row) => normaliseSale(row)));
      const records = batch.map((row, i) => buildSaleRecord(row, normalised[i]));
      await db.insert(sales).values(records).onConflictDoNothing();
      inserted += records.length;
    } catch (err) {
      console.error('Batch failed', err);
      errors += batch.length;
    }
  }

  return {
    totalRows: allRows.length,
    newRows: newRows.length,
    duplicates: allRows.length - newRows.length,
    errors,
  };
}
```

---

## Task 1.8 — Wire to the cron route

Update `apps/web/app/api/cron/ppr-ingest/route.ts` to call `ingestPpr()` and return the result.

---

## Task 1.9 — Manually trigger and load historical data

Once the pipeline works, do a one-time historical backfill:

1. Trigger the cron once. It will download the PPR CSV (~777K records as of April 2026) and insert all rows.
2. The first run will take longer — likely 20-40 minutes for full backfill. **Run this from a local script, not the Vercel cron** (Vercel max duration is 300s).

Create `scripts/backfill-ppr.ts`:

```typescript
import { ingestPpr } from '@properdata/scrapers/ppr';
const result = await ingestPpr();
console.log('Backfill complete:', result);
```

Run with:
```bash
pnpm tsx scripts/backfill-ppr.ts
```

---

## Task 1.10 — Verify and refresh metrics

Once data is loaded:

```sql
-- Count by town
SELECT t.name, COUNT(s.id) AS sales_count
FROM towns t
LEFT JOIN sales s ON s.town_id = t.id
GROUP BY t.name;

-- Refresh the materialised view
SELECT refresh_town_metrics();

-- Check the metrics
SELECT * FROM town_metrics;
```

**Success criteria**:
- Mullingar/Athlone/Tullamore each have 100+ sales associated
- `town_metrics` returns sensible median prices and YoY change values
- An ad-hoc query like "median 3-bed price in Mullingar last 12 months" returns plausible numbers

---

## Done when

- [ ] PPR CSV downloads and caches successfully
- [ ] Parser handles all PPR CSV quirks (encoding, formatting, edge cases)
- [ ] Deduplication via `ppr_uid` works correctly
- [ ] Normalisation agent runs with reasonable accuracy (manual spot-check 20 rows)
- [ ] Sales table populated with historical data for covered towns
- [ ] `town_metrics` materialised view returns sensible numbers
- [ ] Daily cron runs without errors and adds new sales as the PPR updates

Once complete, move to `sprint-2-comparables.md` (to be written).
