/**
 * RTB/ESRI Rent Index ingestion from CSO PxStat API.
 *
 * Source: CSO table RIQ02 (JSON-stat 2.0 format)
 * This is the same RTB/ESRI Rent Index data published via CSO's open data API.
 * Free, no auth, structured JSON. Updated quarterly.
 *
 * Usage:
 *   export $(grep -v '^#' .env.local | grep '=' | xargs)
 *   NODE_OPTIONS='--conditions react-server' pnpm tsx scripts/ingest-rtb.ts
 */

import { sql } from 'drizzle-orm';
import { db, rtbRents } from '../packages/db/src';

const CSO_API_URL =
  'https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/RIQ02/JSON-stat/2.0/en';

const BEDROOM_MAP: Record<string, number | null> = {
  '-': null,     // All bedrooms
  '01': 1,       // One bed
  '02': 2,       // Two bed
  '03': 3,       // Three bed
  '06': null,    // 1 to 2 bed (aggregate)
  '07': null,    // 1 to 3 bed (aggregate)
  '08': 4,       // Four plus bed
};

const PROPERTY_TYPE_MAP: Record<string, string | null> = {
  '-': null,           // All property types
  '01': 'Detached',
  '02': 'Semi-detached',
  '03': 'Terrace',
  '04': 'Apartment',
  '05': 'Other',
};

function normaliseCounty(raw: string): string {
  let c = raw.trim();
  c = c.replace(/^Co\.\s*/i, '');
  c = c.replace(/\s+(City|North|South)$/i, '');
  c = c
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return c;
}

interface JsonStatDataset {
  id: string[];
  size: number[];
  dimension: Record<string, {
    category: {
      index: Record<string, number>;
      label: Record<string, string>;
    };
  }>;
  value: (number | null)[];
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function main() {
  console.log('Fetching RTB/ESRI Rent Index from CSO PxStat API...');
  const res = await fetch(CSO_API_URL, {
    headers: { 'User-Agent': 'ProperData/1.0 (property research tool)' },
  });
  if (!res.ok) throw new Error(`CSO API failed: ${res.status}`);

  const dataset = (await res.json()) as JsonStatDataset;
  const dimIds = dataset.id;
  const dimSizes = dataset.size;

  const dims = dimIds.map((id) => {
    const dim = dataset.dimension[id]!;
    let indexToCode: string[];
    if (Array.isArray(dim.category.index)) {
      indexToCode = dim.category.index as string[];
    } else {
      indexToCode = [];
      for (const [code, idx] of Object.entries(dim.category.index as Record<string, number>)) {
        indexToCode[idx] = code;
      }
    }
    return { id, labels: dim.category.label, indexToCode };
  });

  // Compute strides for flat index → multi-dimensional index
  const strides: number[] = new Array(dimIds.length);
  strides[dimIds.length - 1] = 1;
  for (let i = dimIds.length - 2; i >= 0; i--) {
    strides[i] = strides[i + 1]! * dimSizes[i + 1]!;
  }

  const statIdx = dimIds.indexOf('STATISTIC');
  const quarterIdx = dimIds.indexOf('TLIST(Q1)');
  const bedroomIdx = dimIds.indexOf('C02970V03592');
  const propTypeIdx = dimIds.indexOf('C02969V03591');
  const locationIdx = dimIds.indexOf('C03004V03625');

  const records: Array<typeof rtbRents.$inferInsert> = [];

  for (let i = 0; i < dataset.value.length; i++) {
    const val = dataset.value[i];
    if (val === null || val <= 0) continue;

    const indices = dimIds.map((_, d) => Math.floor(i / strides[d]!) % dimSizes[d]!);

    const quarterCode = dims[quarterIdx]!.indexToCode[indices[quarterIdx]!]!;
    const bedroomCode = dims[bedroomIdx]!.indexToCode[indices[bedroomIdx]!]!;
    const propTypeCode = dims[propTypeIdx]!.indexToCode[indices[propTypeIdx]!]!;
    const locationCode = dims[locationIdx]!.indexToCode[indices[locationIdx]!]!;

    const quarter = dims[quarterIdx]!.labels[quarterCode]!;
    const locationLabel = dims[locationIdx]!.labels[locationCode]!;
    const bedrooms = BEDROOM_MAP[bedroomCode];
    const propertyType = PROPERTY_TYPE_MAP[propTypeCode];

    // Skip aggregate bedroom categories (1-2, 1-3)
    if (bedroomCode === '06' || bedroomCode === '07') continue;

    const county = normaliseCounty(locationLabel);

    records.push({
      quarter,
      county,
      propertyType,
      bedrooms,
      isNewTenancy: true,
      standardisedMonthlyRent: val.toFixed(2),
      sampleSize: null,
      rawData: { locationCode, bedroomCode, propTypeCode, locationLabel },
    });
  }

  console.log(`Parsed ${records.length.toLocaleString()} rent records`);

  // Truncate and re-insert
  console.log('Truncating rtb_rents table...');
  await db.execute(sql`TRUNCATE TABLE ${rtbRents}`);

  const batches = chunk(records, 500);
  let inserted = 0;
  let errors = 0;

  for (let bi = 0; bi < batches.length; bi++) {
    try {
      await db.insert(rtbRents).values(batches[bi]!);
      inserted += batches[bi]!.length;
    } catch (err) {
      console.error(`Batch ${bi + 1} failed:`, (err as Error).message.slice(0, 200));
      errors += batches[bi]!.length;
    }
    if ((bi + 1) % 50 === 0) {
      console.log(`  ${inserted.toLocaleString()} inserted (batch ${bi + 1}/${batches.length})`);
    }
  }

  console.log(`\nRTB ingestion complete:`);
  console.log(`  Inserted: ${inserted.toLocaleString()}`);
  console.log(`  Errors:   ${errors}`);

  // Quick sanity check
  const sample = await db.execute<{ quarter: string; county: string; rent: string }>(
    sql`SELECT quarter, county, standardised_monthly_rent AS rent
        FROM ${rtbRents}
        WHERE county = 'Dublin' AND bedrooms = 2 AND is_new_tenancy = true AND property_type IS NULL
        ORDER BY quarter DESC LIMIT 3`,
  );
  if (sample.rows?.length) {
    console.log('\nSample — Dublin 2-bed all types (recent quarters):');
    for (const r of sample.rows) {
      console.log(`  ${r.quarter}: €${parseFloat(r.rent).toFixed(0)}/month`);
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
