/**
 * RTB Rent Index ingestion.
 *
 * Source: RTB/ESRI Rent Index (rtb.ie)
 *
 * The RTB publishes quarterly standardised rent data by county, property type,
 * bedroom count, and tenancy type. Published as Excel/CSV on rtb.ie.
 * Free, no API key required — this is a statutory public register.
 *
 * The RTB Rent Index is updated quarterly. Data includes standardised monthly
 * rent figures, adjusted for property characteristics to allow valid comparisons.
 */

import Papa from 'papaparse';

export interface RtbRow {
  quarter: string;
  county: string;
  propertyType: string | null;
  bedrooms: number | null;
  isNewTenancy: boolean | null;
  standardisedMonthlyRent: number;
  sampleSize: number | null;
}

export interface RtbIngestResult {
  totalRows: number;
  inserted: number;
  skipped: number;
  errors: number;
}

// ---------------------------------------------------------------------------
// Download RTB CSV
// ---------------------------------------------------------------------------

// The RTB publishes data on rtb.ie — configure the URL via env var since
// the exact resource URL changes per quarterly release.
const RTB_DOWNLOAD_URL =
  process.env.RTB_CSV_URL ?? 'https://www.rtb.ie/images/uploads/Rent_Index/RTB_Rent_Index_Data.csv';

export async function downloadRtbCsv(): Promise<string> {
  console.log(`Fetching RTB data from ${RTB_DOWNLOAD_URL}...`);
  const response = await fetch(RTB_DOWNLOAD_URL, {
    headers: {
      'User-Agent': 'ProperData/1.0 (property research tool)',
    },
  });

  if (!response.ok) {
    throw new Error(`RTB download failed: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

// ---------------------------------------------------------------------------
// Parse RTB CSV
// ---------------------------------------------------------------------------

function normaliseCounty(raw: string): string {
  let c = raw.trim();
  c = c.replace(/^Co\.\s*/i, '');
  c = c
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return c;
}

function parseQuarter(raw: string | undefined): string | null {
  if (!raw || raw.trim() === '') return null;
  const trimmed = raw.trim();
  // Expect formats like "2025Q4", "2025 Q4", "Q4 2025", "2025-Q4"
  const match = trimmed.match(/(\d{4})\s*[-]?\s*Q(\d)/i) ?? trimmed.match(/Q(\d)\s*[-]?\s*(\d{4})/i);
  if (match) {
    if (match[0]!.startsWith('Q')) {
      return `${match[2]}Q${match[1]}`;
    }
    return `${match[1]}Q${match[2]}`;
  }
  return trimmed;
}

function parseNumericOrNull(raw: string | undefined): number | null {
  if (!raw || raw.trim() === '') return null;
  const cleaned = raw.replace(/[€,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseIntOrNull(raw: string | undefined): number | null {
  if (!raw || raw.trim() === '') return null;
  const num = parseInt(raw.trim(), 10);
  return isNaN(num) ? null : num;
}

export function parseRtbCsv(csvText: string): RtbRow[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  if (result.errors.length > 0) {
    const critical = result.errors.filter((e) => e.type !== 'FieldMismatch');
    if (critical.length > 0) {
      console.warn(`RTB CSV parse warnings: ${critical.length} issues`);
    }
  }

  const rows: RtbRow[] = [];

  for (const raw of result.data) {
    const quarterRaw = raw['Quarter'] ?? raw['Period'] ?? raw['Year_Quarter'] ?? '';
    const countyRaw = raw['County'] ?? raw['Location'] ?? raw['Area'] ?? '';
    const rentRaw = raw['Standardised Rent'] ?? raw['StandardisedRent'] ?? raw['Rent'] ?? raw['Monthly Rent'] ?? '';

    const quarter = parseQuarter(quarterRaw);
    if (!quarter || !countyRaw || !rentRaw) continue;

    const rent = parseNumericOrNull(rentRaw);
    if (rent === null || rent <= 0) continue;

    try {
      const tenancyType = raw['Tenancy Type'] ?? raw['TenancyType'] ?? raw['Type'] ?? '';
      let isNewTenancy: boolean | null = null;
      if (tenancyType.toLowerCase().includes('new')) {
        isNewTenancy = true;
      } else if (tenancyType.toLowerCase().includes('existing') || tenancyType.toLowerCase().includes('renew')) {
        isNewTenancy = false;
      }

      rows.push({
        quarter,
        county: normaliseCounty(countyRaw),
        propertyType: raw['Property Type'] ?? raw['PropertyType'] ?? null,
        bedrooms: parseIntOrNull(raw['Bedrooms'] ?? raw['Beds'] ?? raw['No. of Bedrooms']),
        isNewTenancy,
        standardisedMonthlyRent: rent,
        sampleSize: parseIntOrNull(raw['Sample Size'] ?? raw['SampleSize'] ?? raw['N']),
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
// Full ingestion orchestration
// ---------------------------------------------------------------------------

export async function ingestRtbRents(): Promise<RtbIngestResult> {
  const dbMod = await import('@properdata/db');
  const drizzle = await import('drizzle-orm');

  const { db, rtbRents } = dbMod;

  console.log('Downloading RTB Rent Index CSV...');
  const csvText = await downloadRtbCsv();

  console.log('Parsing CSV...');
  const allRows = parseRtbCsv(csvText);
  console.log(`  Parsed ${allRows.length} rows`);

  if (allRows.length === 0) {
    return { totalRows: 0, inserted: 0, skipped: 0, errors: 0 };
  }

  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  const INSERT_BATCH = 200;
  const batches = chunk(allRows, INSERT_BATCH);

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi]!;

    try {
      const records = batch.map((row) => ({
        quarter: row.quarter,
        county: row.county,
        propertyType: row.propertyType,
        bedrooms: row.bedrooms,
        isNewTenancy: row.isNewTenancy,
        standardisedMonthlyRent: row.standardisedMonthlyRent.toFixed(2),
        sampleSize: row.sampleSize,
        rawData: row as unknown as Record<string, unknown>,
      }));

      await db.insert(rtbRents).values(records).onConflictDoNothing();
      inserted += records.length;
    } catch (err) {
      console.error(`Insert batch ${bi + 1} failed:`, (err as Error).message.slice(0, 200));
      errors += batch.length;
    }
  }

  console.log(`\nRTB ingestion complete: ${inserted} inserted, ${errors} errors`);

  return {
    totalRows: allRows.length,
    inserted,
    skipped,
    errors,
  };
}
