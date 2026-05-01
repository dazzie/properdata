/**
 * BER (Building Energy Rating) ingestion.
 *
 * Source: SEAI National BER Database (ndber.seai.ie)
 *
 * The SEAI publishes anonymised BER data as a bulk CSV download from the
 * National BER Research Tool. Updated regularly. Free, no API key required —
 * this is government open data under the SEAI open data licence.
 *
 * Columns in the CSV (key ones mapped to our schema):
 *   CountyName, DwellingTypeDescr, Year_of_Construction, EnergyRating,
 *   BerRating (kWh/m²/yr), CO2Rating, LivingAreaPercent, RoofArea,
 *   UValueWall, UValueRoof, UValueFloor, UValueWindow, UValueDoor,
 *   WallArea, WindowArea, FloorArea, HSMainSystemEfficiency,
 *   HSSupplSystemEfficiency, HSMainSystemFuel, HSSupplSystemFuel,
 *   WHMainSystemFuel, WHSupplSystemFuel, GroundFloorArea,
 *   FirstFloorArea, SecondFloorArea, ThirdFloorArea, MainSpaceHeatingFuel,
 *   MainWaterHeatingFuel, HSEffAdjFactor, WHEffAdjFactor,
 *   PurposeOfRating, DateOfAssessment, TypeofRating, TGDEdition,
 *   MPCDERValue, DeliveredEnergyMainSpace, DeliveredEnergySupplSpace,
 *   DeliveredEnergyMainWater, DeliveredEnergySupplWater, DeliveredEnergyLighting,
 *   DeliveredEnergyFansAndPumps, EPC (kWh/m²/yr), CPC (kgCO2/m²/yr), ...
 *
 * We extract: BER number (if present), issue date, rating, energy value,
 * CO2 rating, dwelling type, year built, floor area, heating type, wall type,
 * county, eircode routing key.
 */

import Papa from 'papaparse';

export interface BerRow {
  berNumber: string | null;
  issueDate: string | null;
  rating: string;
  energyValue: number | null;
  co2Rating: number | null;
  dwellingType: string | null;
  yearBuilt: number | null;
  floorArea: number | null;
  heatingMain: string | null;
  wallType: string | null;
  countyName: string;
  eircodeRoutingKey: string | null;
}

export interface BerIngestResult {
  totalRows: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
}

// ---------------------------------------------------------------------------
// Download BER CSV
// ---------------------------------------------------------------------------

// The SEAI publishes BER data via two routes:
// 1. data.gov.ie — no auth, but resource URL changes per upload
// 2. ndber.seai.ie — requires free registration
// Configure BER_CSV_URL env var to point to the current data.gov.ie resource URL.
// Falls back to the SEAI direct download path.
const BER_DOWNLOAD_URL =
  process.env.BER_CSV_URL ?? 'https://ndber.seai.ie/BERResearchTool/Register/Download.aspx';

export async function downloadBerCsv(): Promise<string> {
  console.log(`Fetching BER data from ${BER_DOWNLOAD_URL}...`);
  const response = await fetch(BER_DOWNLOAD_URL, {
    headers: {
      'User-Agent': 'ProperData/1.0 (property research tool)',
    },
  });

  if (!response.ok) {
    throw new Error(`BER download failed: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

// ---------------------------------------------------------------------------
// Parse BER CSV
// ---------------------------------------------------------------------------

function normaliseCounty(raw: string): string {
  let c = raw.trim();
  // SEAI sometimes uses "Co. Westmeath" or "Westmeath" or "WESTMEATH"
  c = c.replace(/^Co\.?\s*/i, '');
  // Title case
  c = c
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return c;
}

function parseNumericOrNull(raw: string | undefined): number | null {
  if (!raw || raw.trim() === '') return null;
  const num = parseFloat(raw.trim());
  return isNaN(num) ? null : num;
}

function parseIntOrNull(raw: string | undefined): number | null {
  if (!raw || raw.trim() === '') return null;
  const num = parseInt(raw.trim(), 10);
  return isNaN(num) ? null : num;
}

function parseDate(raw: string | undefined): string | null {
  if (!raw || raw.trim() === '') return null;
  const trimmed = raw.trim();
  // Try ISO format first
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  // Try DD/MM/YYYY
  const parts = trimmed.split('/');
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    return `${yyyy}-${mm!.padStart(2, '0')}-${dd!.padStart(2, '0')}`;
  }
  return null;
}

function normaliseRating(raw: string): string {
  const r = raw.trim().toUpperCase();
  // Ensure valid BER rating format: A1-G
  if (/^[A-G][1-3]?$/.test(r)) return r;
  // Sometimes just a letter
  if (/^[A-G]$/.test(r)) return r;
  return r;
}

export function parseBerCsv(csvText: string): BerRow[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  if (result.errors.length > 0) {
    const critical = result.errors.filter((e) => e.type !== 'FieldMismatch');
    if (critical.length > 0) {
      console.warn(`BER CSV parse warnings: ${critical.length} issues`);
    }
  }

  const rows: BerRow[] = [];

  for (const raw of result.data) {
    // SEAI CSV column names vary between versions; try known variants
    const rating = raw['EnergyRating'] ?? raw['Energy Rating'] ?? '';
    const countyName = raw['CountyName'] ?? raw['County'] ?? '';

    if (!rating || !countyName) continue;

    try {
      rows.push({
        berNumber: raw['BERNumber'] ?? raw['BER Number'] ?? raw['BERBridgeID'] ?? null,
        issueDate: parseDate(raw['DateOfAssessment'] ?? raw['Date of Assessment']),
        rating: normaliseRating(rating),
        energyValue: parseNumericOrNull(raw['BerRating'] ?? raw['EPC']),
        co2Rating: parseNumericOrNull(raw['CO2Rating'] ?? raw['CPC']),
        dwellingType: raw['DwellingTypeDescr'] ?? raw['Dwelling Type'] ?? null,
        yearBuilt: parseIntOrNull(raw['Year_of_Construction'] ?? raw['YearOfConstruction']),
        floorArea: parseNumericOrNull(raw['FloorArea'] ?? raw['GroundFloorArea'] ?? raw['TotalFloorArea']),
        heatingMain: raw['MainSpaceHeatingFuel'] ?? raw['HSMainSystemFuel'] ?? null,
        wallType: raw['WallTypeDescr'] ?? raw['WallType'] ?? null,
        countyName: normaliseCounty(countyName),
        eircodeRoutingKey: (raw['EircodeRouteKey'] ?? raw['Eircode Routing Key'] ?? raw['EircodeRK'] ?? '').trim().slice(0, 3) || null,
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

export async function ingestBer(): Promise<BerIngestResult> {
  const dbMod = await import('@properdata/db');
  const drizzle = await import('drizzle-orm');

  const { db, berRatings, towns } = dbMod;

  console.log('Downloading BER CSV...');
  const csvText = await downloadBerCsv();

  console.log('Parsing CSV...');
  const allRows = parseBerCsv(csvText);
  console.log(`  Parsed ${allRows.length} rows`);

  if (allRows.length === 0) {
    return { totalRows: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 };
  }

  // Load towns for eircode routing key → town_id mapping
  const allTowns = await db
    .select({
      id: towns.id,
      eircodeRoutingKey: towns.eircodeRoutingKey,
    })
    .from(towns);

  const townByEircode = new Map<string, number>();
  for (const t of allTowns) {
    if (t.eircodeRoutingKey) {
      townByEircode.set(t.eircodeRoutingKey, t.id);
    }
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const INSERT_BATCH = 500;
  const batches = chunk(allRows, INSERT_BATCH);

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi]!;
    if (bi % 20 === 0) {
      console.log(`  Processing batch ${bi + 1}/${batches.length} (${inserted + updated} upserted)`);
    }

    try {
      const records = batch.map((row) => ({
        berNumber: row.berNumber,
        issueDate: row.issueDate,
        rating: row.rating,
        energyValue: row.energyValue?.toFixed(2) ?? null,
        co2Rating: row.co2Rating?.toFixed(2) ?? null,
        dwellingType: row.dwellingType,
        yearBuilt: row.yearBuilt,
        floorArea: row.floorArea?.toFixed(2) ?? null,
        heatingMain: row.heatingMain,
        wallType: row.wallType,
        countyName: row.countyName,
        eircodeRoutingKey: row.eircodeRoutingKey,
        townId: row.eircodeRoutingKey ? townByEircode.get(row.eircodeRoutingKey) ?? null : null,
        rawRow: row as unknown as Record<string, unknown>,
      }));

      const withBerNumber = records.filter((r) => r.berNumber);
      const withoutBerNumber = records.filter((r) => !r.berNumber);

      if (withBerNumber.length > 0) {
        const result = await db
          .insert(berRatings)
          .values(withBerNumber)
          .onConflictDoUpdate({
            target: berRatings.berNumber,
            set: {
              issueDate: drizzle.sql`EXCLUDED.issue_date`,
              rating: drizzle.sql`EXCLUDED.rating`,
              energyValue: drizzle.sql`EXCLUDED.energy_value`,
              co2Rating: drizzle.sql`EXCLUDED.co2_rating`,
              dwellingType: drizzle.sql`EXCLUDED.dwelling_type`,
              yearBuilt: drizzle.sql`EXCLUDED.year_built`,
              floorArea: drizzle.sql`EXCLUDED.floor_area`,
              heatingMain: drizzle.sql`EXCLUDED.heating_main`,
              wallType: drizzle.sql`EXCLUDED.wall_type`,
              countyName: drizzle.sql`EXCLUDED.county_name`,
              eircodeRoutingKey: drizzle.sql`EXCLUDED.eircode_routing_key`,
              townId: drizzle.sql`EXCLUDED.town_id`,
              rawRow: drizzle.sql`EXCLUDED.raw_row`,
            },
          });
        inserted += withBerNumber.length;
      }

      if (withoutBerNumber.length > 0) {
        await db.insert(berRatings).values(withoutBerNumber);
        inserted += withoutBerNumber.length;
      }
    } catch (err) {
      console.error(`Insert batch ${bi + 1} failed:`, (err as Error).message.slice(0, 200));
      errors += batch.length;
    }
  }

  console.log(`\nBER ingestion complete: ${inserted} inserted, ${updated} updated, ${errors} errors`);

  return {
    totalRows: allRows.length,
    inserted,
    updated,
    skipped,
    errors,
  };
}
