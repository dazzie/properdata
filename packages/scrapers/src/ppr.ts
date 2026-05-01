/**
 * PPR (Property Price Register) ingestion.
 *
 * Source: https://www.propertypriceregister.ie/website/npsra/pprweb.nsf/page/ppr-home-en
 *
 * The PPR publishes a single CSV containing all residential property sales since
 * 1 January 2010. Updated approximately weekly. Free, no API key required — this
 * is a statutory public register.
 */

import { createHash } from 'node:crypto';
import https from 'node:https';
import Papa from 'papaparse';
import iconv from 'iconv-lite';
import { unzipSync } from 'fflate';

export interface PprRow {
  saleDate: string;
  address: string;
  county: string;
  eircode: string | null;
  price: number;
  notFullMarketPrice: boolean;
  vatExclusive: boolean;
  descriptionOfProperty: string;
  propertySizeDescription: string;
}

export interface PprIngestResult {
  totalRows: number;
  newRows: number;
  inserted: number;
  duplicates: number;
  errors: number;
}

// ---------------------------------------------------------------------------
// Task 1.3 — Compute stable hash for deduplication
// ---------------------------------------------------------------------------

export function computePprUid(row: PprRow): string {
  const key = `${row.saleDate}|${row.address.toUpperCase().replace(/\s+/g, ' ').trim()}|${row.price.toFixed(2)}`;
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------------------
// Task 1.1 — Download PPR CSV
// ---------------------------------------------------------------------------

const PPR_DOWNLOAD_URL =
  'https://www.propertypriceregister.ie/website/npsra/ppr/npsra-ppr.nsf/Downloads/PPR-ALL.zip/$FILE/PPR-ALL.zip';

function fetchBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const agent = new https.Agent({ rejectUnauthorized: false });
    https.get(url, { agent }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`PPR download failed: ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

export async function downloadPprCsv(): Promise<string> {
  const zipBuffer = await fetchBuffer(PPR_DOWNLOAD_URL);

  // Extract CSV from ZIP
  const unzipped = unzipSync(new Uint8Array(zipBuffer));
  const csvFilename = Object.keys(unzipped).find((name) => name.endsWith('.csv'));
  if (!csvFilename) {
    throw new Error('No CSV file found in PPR ZIP archive');
  }

  const csvBytes = unzipped[csvFilename]!;
  // PPR CSV uses Windows-1252 encoding
  return iconv.decode(Buffer.from(csvBytes), 'win1252');
}

// ---------------------------------------------------------------------------
// Task 1.2 — Parse PPR CSV
// ---------------------------------------------------------------------------

function parseDateDMY(raw: string): string {
  const parts = raw.trim().split('/');
  if (parts.length !== 3) return raw;
  const [dd, mm, yyyy] = parts;
  return `${yyyy}-${mm!.padStart(2, '0')}-${dd!.padStart(2, '0')}`;
}

function parsePrice(raw: string): number {
  const cleaned = raw.replace(/[€,\s]/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) throw new Error(`Invalid price: ${raw}`);
  return num;
}

function parseYesNo(raw: string): boolean {
  return raw.trim().toLowerCase() === 'yes';
}

export function parsePprCsv(csvText: string): PprRow[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  if (result.errors.length > 0) {
    const critical = result.errors.filter((e) => e.type !== 'FieldMismatch');
    if (critical.length > 0) {
      console.warn(`CSV parse warnings: ${critical.length} issues`);
    }
  }

  const rows: PprRow[] = [];

  for (const raw of result.data) {
    const dateRaw = raw['Date of Sale (dd/mm/yyyy)'] ?? raw['Date of Sale'];
    const addressRaw = raw['Address'] ?? '';
    const countyRaw = raw['County'] ?? '';
    const eircodeRaw = raw['Eircode'] ?? raw['Postal Code'] ?? '';
    const priceRaw = raw['Price (€)'] ?? raw['Price (€)'] ?? raw['Price'] ?? '0';
    const notFullRaw = raw['Not Full Market Price'] ?? 'No';
    const vatRaw = raw['VAT Exclusive'] ?? 'No';
    const descRaw = raw['Description of Property'] ?? '';
    const sizeRaw = raw['Property Size Description'] ?? '';

    if (!dateRaw || !addressRaw || !priceRaw) continue;

    try {
      rows.push({
        saleDate: parseDateDMY(dateRaw),
        address: addressRaw.trim(),
        county: countyRaw.trim(),
        eircode: eircodeRaw.trim() || null,
        price: parsePrice(priceRaw),
        notFullMarketPrice: parseYesNo(notFullRaw),
        vatExclusive: parseYesNo(vatRaw),
        descriptionOfProperty: descRaw.trim(),
        propertySizeDescription: sizeRaw.trim(),
      });
    } catch {
      // Skip unparseable rows
    }
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// Task 1.4 + 1.5 + 1.6 + 1.7 — Full ingestion orchestration
// ---------------------------------------------------------------------------

export async function ingestPpr(): Promise<PprIngestResult> {
  const dbMod = await import('@properdata/db');
  const drizzle = await import('drizzle-orm');

  const { db, sales } = dbMod;
  const { inArray } = drizzle;

  console.log('Downloading PPR CSV...');
  const csvText = await downloadPprCsv();

  console.log('Parsing CSV...');
  const allRows = parsePprCsv(csvText);
  console.log(`  Parsed ${allRows.length} rows`);

  // Find new rows by checking existing UIDs
  console.log('Finding new rows...');
  const allUids = allRows.map(computePprUid);
  const existingUids = new Set<string>();
  const UID_BATCH = 5000;

  for (let i = 0; i < allUids.length; i += UID_BATCH) {
    const batch = allUids.slice(i, i + UID_BATCH);
    const results = await db
      .select({ pprUid: sales.pprUid })
      .from(sales)
      .where(inArray(sales.pprUid, batch));
    for (const r of results) {
      existingUids.add(r.pprUid);
    }
  }

  const newRows = allRows.filter((row) => !existingUids.has(computePprUid(row)));
  console.log(`  ${newRows.length} new rows (${allRows.length - newRows.length} duplicates)`);

  if (newRows.length === 0) {
    return { totalRows: allRows.length, newRows: 0, inserted: 0, duplicates: allRows.length, errors: 0 };
  }

  // Insert raw rows without AI normalisation (normalisation happens async via normalisePendingSales)
  let inserted = 0;
  let errors = 0;
  const INSERT_BATCH = 500;
  const insertBatches = chunk(newRows, INSERT_BATCH);

  for (let bi = 0; bi < insertBatches.length; bi++) {
    const batch = insertBatches[bi]!;
    if (bi % 10 === 0) {
      console.log(`  Inserting batch ${bi + 1}/${insertBatches.length} (${inserted} inserted)`);
    }

    try {
      const records = batch.map((row) => ({
        pprUid: computePprUid(row),
        saleDate: row.saleDate,
        price: row.price.toFixed(2),
        addressRaw: row.address,
        addressNormalised: null,
        townId: null,
        county: row.county,
        eircode: row.eircode,
        isNew: row.descriptionOfProperty.toLowerCase().includes('new dwelling'),
        propertyType: null,
        description: row.descriptionOfProperty || null,
        vatExclusive: row.vatExclusive,
        rawRow: {
          saleDate: row.saleDate,
          address: row.address,
          county: row.county,
          eircode: row.eircode,
          price: row.price,
          notFullMarketPrice: row.notFullMarketPrice,
          vatExclusive: row.vatExclusive,
          descriptionOfProperty: row.descriptionOfProperty,
          propertySizeDescription: row.propertySizeDescription,
        },
      }));

      await db.insert(sales).values(records).onConflictDoNothing({ target: sales.pprUid });
      inserted += records.length;
    } catch (err) {
      console.error(`Insert batch ${bi + 1} failed:`, (err as Error).message.slice(0, 200));
      errors += batch.length;
    }
  }

  console.log(`\nIngestion complete: ${inserted} inserted, ${errors} errors`);

  return {
    totalRows: allRows.length,
    newRows: newRows.length,
    inserted,
    duplicates: allRows.length - newRows.length,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Async normalisation — processes un-normalised sales in rate-limited batches
// ---------------------------------------------------------------------------

export interface NormaliseResult {
  processed: number;
  errors: number;
}

export async function normalisePendingSales(limit = 100): Promise<NormaliseResult> {
  const dbMod = await import('@properdata/db');
  const agentsMod = await import('@properdata/agents');
  const drizzle = await import('drizzle-orm');

  const { db, sales, towns } = dbMod;
  const { normaliseSaleBatch } = agentsMod;
  const { isNull, eq } = drizzle;

  // Find rows without normalised address
  const pending = await db
    .select({
      id: sales.id,
      pprUid: sales.pprUid,
      saleDate: sales.saleDate,
      addressRaw: sales.addressRaw,
      county: sales.county,
      eircode: sales.eircode,
      description: sales.description,
      rawRow: sales.rawRow,
    })
    .from(sales)
    .where(isNull(sales.addressNormalised))
    .limit(limit);

  if (pending.length === 0) {
    return { processed: 0, errors: 0 };
  }

  console.log(`Normalising ${pending.length} pending sales...`);

  // Load towns for matching
  const allTowns = await db.select({ id: towns.id, name: towns.name, county: towns.county }).from(towns);
  const townLookup = new Map(allTowns.map((t) => [`${t.name.toLowerCase()}|${t.county.toLowerCase()}`, t.id]));

  let processed = 0;
  let errors = 0;
  const BATCH_SIZE = 20;
  const MIN_BATCH_INTERVAL_MS = 7000;
  const batches = chunk(pending, BATCH_SIZE);

  for (const batch of batches) {
    const batchStart = Date.now();

    try {
      const batchInput = batch.map((row) => {
        const raw = row.rawRow as Record<string, unknown>;
        return {
          'Date of Sale': row.saleDate,
          Address: row.addressRaw,
          County: row.county,
          Eircode: row.eircode,
          Price: raw['price'] ?? 0,
          'Description of Property': row.description ?? '',
        };
      });

      const normalised = await normaliseSaleBatch(batchInput);

      for (let i = 0; i < batch.length; i++) {
        const row = batch[i]!;
        const norm = normalised[i]!;
        const townKey = norm.town ? `${norm.town.toLowerCase()}|${norm.county.toLowerCase()}` : null;
        const townId = townKey ? townLookup.get(townKey) ?? null : null;

        await db
          .update(sales)
          .set({
            addressNormalised: norm.address_normalised,
            townId,
            county: norm.county || row.county,
            eircode: norm.eircode || row.eircode,
            isNew: norm.is_new,
            propertyType: norm.property_type !== 'unknown' ? norm.property_type : null,
          })
          .where(eq(sales.id, row.id));
      }

      processed += batch.length;
      console.log(`  Normalised ${processed}/${pending.length}`);
    } catch (err) {
      console.error(`  Normalise batch failed:`, (err as Error).message.slice(0, 150));
      errors += batch.length;
    }

    // Rate limit: ~8 requests/min to stay under 10K output tokens/min
    const elapsed = Date.now() - batchStart;
    if (elapsed < MIN_BATCH_INTERVAL_MS) {
      await new Promise((r) => setTimeout(r, MIN_BATCH_INTERVAL_MS - elapsed));
    }
  }

  return { processed, errors };
}
