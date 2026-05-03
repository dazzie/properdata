/**
 * BER bulk ingestion from SEAI public dataset.
 *
 * Reads the tab-delimited BERPublicsearch.txt file (1.4M rows, ~1.4GB)
 * and streams inserts into the ber_ratings table.
 *
 * Usage:
 *   export $(grep -v '^#' .env.local | grep '=' | xargs)
 *   NODE_OPTIONS='--conditions react-server' pnpm tsx scripts/ingest-ber.ts [path-to-txt]
 *
 * Default path: /tmp/ber-data/BERPublicsearch.txt
 */

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { sql } from 'drizzle-orm';
import { db, berRatings, towns } from '../packages/db/src';

const BER_FILE = process.argv[2] ?? '/tmp/ber-data/BERPublicsearch.txt';
const BATCH_SIZE = 500;

function normaliseCounty(raw: string): string {
  let c = raw.trim();
  c = c.replace(/^Co\.\s*/i, '');
  // Handle "Dublin 1" → "Dublin", "Limerick City" → "Limerick" etc
  c = c.replace(/\s+\d+$/, '');
  c = c.replace(/\s+(City|North|South)$/i, '');
  c = c
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return c;
}

function normaliseRating(raw: string): string {
  const r = raw.trim().toUpperCase();
  if (/^[A-G][1-3]?$/.test(r)) return r;
  return r;
}

function parseNum(raw: string | undefined): string | null {
  if (!raw || raw.trim() === '') return null;
  const num = parseFloat(raw.trim());
  return isNaN(num) ? null : num.toFixed(2);
}

function parseInt_(raw: string | undefined): number | null {
  if (!raw || raw.trim() === '') return null;
  const num = parseInt(raw.trim(), 10);
  return isNaN(num) ? null : num;
}

function parseDate(raw: string | undefined): string | null {
  if (!raw || raw.trim() === '') return null;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const parts = trimmed.split('/');
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    return `${yyyy}-${mm!.padStart(2, '0')}-${dd!.padStart(2, '0')}`;
  }
  return null;
}

async function main() {
  console.log(`Reading BER data from: ${BER_FILE}`);

  // Load town routing key mapping
  const allTowns = await db
    .select({ id: towns.id, eircodeRoutingKey: towns.eircodeRoutingKey })
    .from(towns);
  const townByEircode = new Map<string, number>();
  for (const t of allTowns) {
    if (t.eircodeRoutingKey) townByEircode.set(t.eircodeRoutingKey, t.id);
  }
  console.log(`Loaded ${townByEircode.size} town routing key mappings`);

  // Truncate existing BER data for clean re-ingestion
  console.log('Truncating ber_ratings table...');
  await db.execute(sql`TRUNCATE TABLE ${berRatings}`);

  const stream = createReadStream(BER_FILE, { encoding: 'utf-8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let headers: string[] = [];
  let batch: Array<typeof berRatings.$inferInsert> = [];
  let total = 0;
  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  let lineNum = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    try {
      await db.insert(berRatings).values(batch);
      inserted += batch.length;
    } catch (err) {
      console.error(`  Batch insert failed at line ~${lineNum}:`, (err as Error).message.slice(0, 200));
      errors += batch.length;
    }
    batch = [];
  };

  for await (const line of rl) {
    lineNum++;

    if (lineNum === 1) {
      headers = line.split('\t').map((h) => h.trim());
      console.log(`Columns: ${headers.length}`);
      continue;
    }

    const values = line.split('\t');
    const raw: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      raw[headers[i]!] = values[i] ?? '';
    }

    const rating = (raw['EnergyRating'] ?? '').trim();
    const countyRaw = (raw['CountyName'] ?? '').trim();
    if (!rating || !countyRaw) {
      skipped++;
      continue;
    }

    const county = normaliseCounty(countyRaw);

    batch.push({
      berNumber: null,
      issueDate: parseDate(raw['DateOfAssessment']),
      rating: normaliseRating(rating),
      energyValue: parseNum(raw['BerRating'] ?? raw['EPC']),
      co2Rating: parseNum(raw['CO2Rating'] ?? raw['CPC']),
      dwellingType: (raw['DwellingTypeDescr'] ?? '').trim() || null,
      yearBuilt: parseInt_(raw['Year_of_Construction']),
      floorArea: parseNum(raw['GroundFloorArea(sq m)'] ?? raw['FloorArea']),
      heatingMain: (raw['MainSpaceHeatingFuel'] ?? '').trim() || null,
      wallType: (raw['FirstWallType_Description'] ?? '').trim() || null,
      countyName: county,
      eircodeRoutingKey: null,
      townId: null,
      rawRow: { sa_code: raw['SA_Code'] ?? null },
    });

    total++;

    if (batch.length >= BATCH_SIZE) {
      await flush();
      if (total % 50000 === 0) {
        console.log(`  ${total.toLocaleString()} rows processed, ${inserted.toLocaleString()} inserted`);
      }
    }
  }

  await flush();

  console.log(`\nBER ingestion complete:`);
  console.log(`  Total parsed:  ${total.toLocaleString()}`);
  console.log(`  Inserted:      ${inserted.toLocaleString()}`);
  console.log(`  Skipped:       ${skipped.toLocaleString()}`);
  console.log(`  Errors:        ${errors.toLocaleString()}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
