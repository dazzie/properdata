/**
 * Batch geocode sales using Nominatim (OpenStreetMap).
 *
 * Nominatim usage policy: max 1 request/second, meaningful User-Agent.
 * This script is resumable — it skips already-geocoded records.
 *
 * Usage:
 *   export $(grep -v '^#' .env.local | grep '=' | xargs)
 *   NODE_OPTIONS='--conditions react-server' pnpm tsx scripts/geocode-sales.ts [--limit N] [--since YYYY-MM-DD]
 *
 * Defaults: limit=5000, since=2024-01-01
 */

import { db, sales } from '../packages/db/src';
import { sql, desc } from 'drizzle-orm';

const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const sinceIdx = args.indexOf('--since');
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1]!, 10) : 5000;
const SINCE = sinceIdx >= 0 ? args[sinceIdx + 1]! : '2024-01-01';
const DELAY_MS = 1100; // 1.1s between requests to respect Nominatim policy

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 2000;

async function fetchWithRetry(url: string, attempt = 0): Promise<NominatimResult[]> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ProperData/1.0 (property-research, moran.daragh@gmail.com)' },
      signal: AbortSignal.timeout(10000),
    });

    if (res.status === 429 || res.status >= 500) {
      if (attempt < MAX_RETRIES) {
        const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt);
        console.log(`    HTTP ${res.status} — retrying in ${backoff}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(backoff);
        return fetchWithRetry(url, attempt + 1);
      }
      console.log(`    HTTP ${res.status} — exhausted retries`);
      return [];
    }

    if (!res.ok) return [];
    return (await res.json()) as NominatimResult[];
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt);
      const msg = err instanceof Error ? err.message : 'unknown error';
      console.log(`    Network error (${msg}) — retrying in ${backoff}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await sleep(backoff);
      return fetchWithRetry(url, attempt + 1);
    }
    return [];
  }
}

async function geocode(address: string, county: string): Promise<{ lat: number; lng: number } | null> {
  const queries = [
    `${address}, ${county}, Ireland`,
    `${address.replace(/^\d+\s*/, '')}, ${county}, Ireland`,
  ];

  const parts = address.split(',').map((s) => s.trim());
  if (parts.length >= 2) {
    const town = parts.find((p) => !p.match(/^\d/) && !p.match(/^Co\.?\s/i));
    if (town) queries.push(`${town}, ${county}, Ireland`);
  }

  for (let i = 0; i < queries.length; i++) {
    if (i > 0) await sleep(DELAY_MS);

    const params = new URLSearchParams({
      q: queries[i]!,
      format: 'json',
      limit: '1',
      countrycodes: 'ie',
    });
    const results = await fetchWithRetry(
      `https://nominatim.openstreetmap.org/search?${params}`,
    );

    if (results.length > 0 && results[0]) {
      const lat = parseFloat(results[0].lat);
      const lng = parseFloat(results[0].lon);
      if (!isNaN(lat) && !isNaN(lng) && lat > 51 && lat < 56 && lng > -11 && lng < -5.5) {
        return { lat, lng };
      }
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(`Geocoding sales since ${SINCE}, limit ${LIMIT}`);

  // Fetch un-geocoded sales, newest first
  const rows = await db
    .select({
      id: sales.id,
      address: sales.addressNormalised,
      addressRaw: sales.addressRaw,
      county: sales.county,
      eircode: sales.eircode,
    })
    .from(sales)
    .where(sql`location IS NULL AND sale_date >= ${SINCE}`)
    .orderBy(desc(sales.saleDate))
    .limit(LIMIT);

  console.log(`Found ${rows.length} un-geocoded sales to process\n`);

  if (rows.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  let geocoded = 0;
  let failed = 0;
  let eircodeHits = 0;
  const startTime = Date.now();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const address = row.address ?? row.addressRaw;

    // Try eircode first if available (more precise)
    let result: { lat: number; lng: number } | null = null;
    if (row.eircode && row.eircode.length >= 3) {
      result = await geocode(row.eircode, row.county);
      if (result) eircodeHits++;
      await sleep(DELAY_MS);
    }

    if (!result) {
      result = await geocode(address, row.county);
      await sleep(DELAY_MS);
    }

    if (result) {
      await db.execute(
        sql`UPDATE ${sales} SET location = ST_SetSRID(ST_MakePoint(${result.lng}, ${result.lat}), 4326) WHERE id = ${row.id}`,
      );
      geocoded++;
    } else {
      failed++;
    }

    if ((i + 1) % 100 === 0) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const processed = i + 1;
      const remaining = rows.length - processed;
      const secPerRecord = elapsed / processed;
      const eta = Math.round(remaining * secPerRecord);
      console.log(
        `  ${processed}/${rows.length} — geocoded: ${geocoded}, failed: ${failed}, eircode hits: ${eircodeHits} ` +
        `(${elapsed}s elapsed, ~${eta}s remaining)`,
      );
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`\nGeocoding complete (${elapsed}s):`);
  console.log(`  Processed: ${rows.length}`);
  console.log(`  Geocoded:  ${geocoded} (${((geocoded / rows.length) * 100).toFixed(1)}%)`);
  console.log(`  Failed:    ${failed}`);
  console.log(`  Eircode:   ${eircodeHits} resolved via eircode`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
