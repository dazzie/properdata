/**
 * PPR (Property Price Register) ingestion.
 *
 * Source: https://www.propertypriceregister.ie/website/npsra/pprweb.nsf/page/ppr-home-en
 *
 * The PPR publishes a single CSV containing all residential property sales since
 * 1 January 2010. Updated approximately weekly. Free, no API key required, no
 * scraping ToS issues — this is a statutory public register.
 *
 * Strategy:
 *   1. Download the latest CSV (full file, not incremental).
 *   2. Parse CSV rows.
 *   3. Compute a stable hash for each row (date + address + price) to use as ppr_uid.
 *   4. Diff against existing sales table to find new records only.
 *   5. Send each new record through normaliseSale() to extract town/type.
 *   6. Insert into sales table with raw_row preserved.
 *   7. Spatial coordinates are NOT computed here — that's a separate geocoding pass.
 *
 * The PPR CSV uses Windows-1252 encoding (not UTF-8). Ensure decoding handles this.
 * Column headers in the PPR CSV (as of 2026):
 *   - Date of Sale (dd/mm/yyyy)
 *   - Address
 *   - County
 *   - Eircode
 *   - Price (€)
 *   - Not Full Market Price
 *   - VAT Exclusive
 *   - Description of Property
 *   - Property Size Description
 */

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
  duplicates: number;
  errors: number;
  newRecords: PprRow[];
}

/**
 * Compute a stable hash for a PPR row to use as ppr_uid.
 *
 * The PPR has no native unique identifier — sales are identified by the
 * combination of date, address (raw), and price. This combination is unique
 * in practice because Revenue's e-stamping system de-duplicates submissions.
 */
export function computePprUid(row: PprRow): string {
  const normalised = `${row.saleDate}|${row.address.toUpperCase().replace(/\s+/g, ' ').trim()}|${row.price.toFixed(2)}`;
  // SHA-256 first 16 hex chars is plenty for ~1M rows
  // TODO: implement using node:crypto
  return normalised.slice(0, 100); // placeholder
}

/**
 * Download the latest PPR CSV.
 *
 * Returns the raw text content (already UTF-8 decoded from Windows-1252).
 *
 * TODO:
 *   - Use the actual PPR download URL (the site uses a POST form submission)
 *   - Handle Windows-1252 → UTF-8 decoding (use `iconv-lite` or similar)
 *   - Cache the response in R2 with the date as the key
 *   - Implement timeout and retry logic
 */
export async function downloadPprCsv(): Promise<string> {
  throw new Error('Not yet implemented — see Sprint 1 task in .claude/sprints/sprint-1-ppr-pipeline.md');
}

/**
 * Parse the PPR CSV text into typed rows.
 *
 * Handles the PPR-specific quirks:
 *   - Quoted fields with embedded commas in addresses
 *   - Date format dd/mm/yyyy → YYYY-MM-DD
 *   - Price format "€100,000.00" → 100000
 *   - "Yes" / "No" → boolean
 *   - Empty Eircode field → null
 */
export function parsePprCsv(_csvText: string): PprRow[] {
  throw new Error('Not yet implemented — see Sprint 1 task');
}

/**
 * Diff parsed rows against the existing sales table.
 *
 * Returns only rows that are new (not present in the database by ppr_uid).
 */
export async function findNewRows(_rows: PprRow[]): Promise<PprRow[]> {
  throw new Error('Not yet implemented — see Sprint 1 task');
}

/**
 * Top-level entry point. Called by /api/cron/ppr-ingest.
 *
 * Returns metrics about what was ingested.
 */
export async function ingestPpr(): Promise<PprIngestResult> {
  throw new Error('Not yet implemented — see Sprint 1 task');
}
