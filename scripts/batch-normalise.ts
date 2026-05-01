/**
 * Batch normalisation of PPR sales using the Anthropic Message Batches API.
 *
 * Commands:
 *   submit   — Query un-normalised rows, submit batch jobs, save state
 *   status   — Check batch job status
 *   retrieve — Download results and update the database
 *
 * Usage:
 *   export $(grep -v '^#' .env.local | grep '=' | xargs)
 *   NODE_OPTIONS='--conditions react-server' pnpm tsx scripts/batch-normalise.ts submit
 *   NODE_OPTIONS='--conditions react-server' pnpm tsx scripts/batch-normalise.ts status
 *   NODE_OPTIONS='--conditions react-server' pnpm tsx scripts/batch-normalise.ts retrieve
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../packages/db/src/seed-client';
import { sales, towns } from '../packages/db/src/schema';
import { sql } from '../packages/db/src/index';
import { isNull, eq } from 'drizzle-orm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, '.batch-state.json');
const ROWS_PER_REQUEST = 20;
const MAX_REQUESTS_PER_BATCH = 15_000;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const systemPrompt = readFileSync(join(__dirname, '..', 'packages', 'agents', 'prompts', 'normalise-sales.md'), 'utf-8');

interface BatchState {
  batches: Array<{
    batchId: string;
    requestCount: number;
    rowMapping: Record<string, number[]>; // custom_id → array of sale IDs
    status: 'submitted' | 'processing' | 'ended' | 'failed';
  }>;
  submittedAt: string;
}

function loadState(): BatchState | null {
  if (!existsSync(STATE_FILE)) return null;
  return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
}

function saveState(state: BatchState) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ---- SUBMIT ----

async function submit() {
  console.log('Querying un-normalised sales...');
  const PAGE_SIZE = 10_000;
  let offset = 0;
  const allRows: Array<{ id: number; addressRaw: string; county: string; eircode: string | null; description: string | null; rawRow: unknown }> = [];

  while (true) {
    const page = await db
      .select({
        id: sales.id,
        addressRaw: sales.addressRaw,
        county: sales.county,
        eircode: sales.eircode,
        description: sales.description,
        rawRow: sales.rawRow,
      })
      .from(sales)
      .where(isNull(sales.addressNormalised))
      .orderBy(sales.id)
      .limit(PAGE_SIZE)
      .offset(offset);

    if (page.length === 0) break;
    allRows.push(...page);
    offset += PAGE_SIZE;
    console.log(`  Loaded ${allRows.length} rows...`);
  }

  console.log(`Total un-normalised rows: ${allRows.length}`);
  if (allRows.length === 0) {
    console.log('Nothing to normalise.');
    return;
  }

  // Group rows into API requests (ROWS_PER_REQUEST rows per request)
  const requests: Array<{ customId: string; rowIds: number[]; input: string }> = [];
  for (let i = 0; i < allRows.length; i += ROWS_PER_REQUEST) {
    const chunk = allRows.slice(i, i + ROWS_PER_REQUEST);
    const customId = `r${i}`;
    const rowIds = chunk.map((r) => r.id);
    const input = JSON.stringify(
      chunk.map((row) => {
        const raw = row.rawRow as Record<string, unknown>;
        return {
          Address: row.addressRaw,
          County: row.county,
          Eircode: row.eircode,
          Price: raw['price'] ?? 0,
          'Description of Property': row.description ?? raw['descriptionOfProperty'] ?? '',
        };
      }),
    );
    requests.push({ customId, rowIds, input });
  }

  console.log(`Created ${requests.length} batch requests (${ROWS_PER_REQUEST} rows each)`);

  // Split into batch submissions
  const state: BatchState = { batches: [], submittedAt: new Date().toISOString() };

  for (let bi = 0; bi < requests.length; bi += MAX_REQUESTS_PER_BATCH) {
    const batchRequests = requests.slice(bi, bi + MAX_REQUESTS_PER_BATCH);
    const batchIdx = Math.floor(bi / MAX_REQUESTS_PER_BATCH);

    console.log(`\nSubmitting batch ${batchIdx + 1} (${batchRequests.length} requests)...`);

    const rowMapping: Record<string, number[]> = {};
    const apiRequests = batchRequests.map((r) => {
      rowMapping[r.customId] = r.rowIds;
      return {
        custom_id: r.customId,
        params: {
          model: 'claude-haiku-4-5' as const,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user' as const, content: r.input }],
        },
      };
    });

    const batch = await anthropic.beta.messages.batches.create({ requests: apiRequests });
    console.log(`  Batch ID: ${batch.id}`);
    console.log(`  Status: ${batch.processing_status}`);

    state.batches.push({
      batchId: batch.id,
      requestCount: batchRequests.length,
      rowMapping,
      status: 'submitted',
    });
  }

  saveState(state);
  console.log(`\nAll batches submitted. State saved to ${STATE_FILE}`);
  console.log('Run "status" to check progress, "retrieve" when done.');
}

// ---- STATUS ----

async function status() {
  const state = loadState();
  if (!state) {
    console.log('No batch state found. Run "submit" first.');
    return;
  }

  console.log(`Submitted at: ${state.submittedAt}`);
  console.log(`Batches: ${state.batches.length}\n`);

  for (const b of state.batches) {
    const batch = await anthropic.beta.messages.batches.retrieve(b.batchId);
    b.status = batch.processing_status === 'ended' ? 'ended' : batch.processing_status;
    console.log(`Batch ${b.batchId}:`);
    console.log(`  Status: ${batch.processing_status}`);
    console.log(`  Requests: ${b.requestCount}`);
    console.log(`  Counts:`, batch.request_counts);
  }

  saveState(state);
}

// ---- RETRIEVE ----

interface ParsedRow {
  id: number;
  addressNormalised: string;
  townId: number | null;
  county: string;
  eircode: string | null;
  isNew: boolean;
  propertyType: string | null;
}

const VALID_PROPERTY_TYPES = new Set(['detached', 'semi_detached', 'terraced', 'apartment', 'duplex', 'bungalow']);
function sanitisePropertyType(val: string | null | undefined): string | null {
  if (!val || val === 'unknown') return null;
  if (VALID_PROPERTY_TYPES.has(val)) return val;
  return null;
}

const UPDATE_BATCH = 500;

async function flushUpdates(rows: ParsedRow[]) {
  if (rows.length === 0) return;

  // Build a bulk UPDATE using a VALUES list + UPDATE FROM
  const values = rows
    .map(
      (r) =>
        `(${r.id}, ${esc(r.addressNormalised)}, ${r.townId ?? 'NULL'}, ${esc(r.county)}, ${esc(r.eircode)}, ${r.isNew ?? false}, ${esc(r.propertyType)})`,
    )
    .join(',\n');

  await db.execute(sql`
    UPDATE sales SET
      address_normalised = v.address_normalised,
      town_id = v.town_id::int,
      county = v.county,
      eircode = v.eircode,
      is_new = v.is_new::boolean,
      property_type = v.property_type::property_type
    FROM (VALUES ${sql.raw(values)})
      AS v(id, address_normalised, town_id, county, eircode, is_new, property_type)
    WHERE sales.id = v.id::int
  `);
}

function esc(s: string | null | undefined): string {
  if (s == null) return 'NULL';
  return `'${String(s).replace(/'/g, "''")}'`;
}

async function retrieve() {
  const state = loadState();
  if (!state) {
    console.log('No batch state found. Run "submit" first.');
    return;
  }

  // Load towns for matching
  const allTowns = await db.select({ id: towns.id, name: towns.name, county: towns.county }).from(towns);
  const townLookup = new Map(allTowns.map((t) => [`${t.name.toLowerCase()}|${t.county.toLowerCase()}`, t.id]));
  console.log(`Loaded ${allTowns.length} towns for matching\n`);

  let totalProcessed = 0;
  let totalErrors = 0;

  for (const b of state.batches) {
    const batch = await anthropic.beta.messages.batches.retrieve(b.batchId);
    if (batch.processing_status !== 'ended') {
      console.log(`Batch ${b.batchId} not ready (${batch.processing_status}). Skipping.`);
      continue;
    }

    console.log(`Processing results from batch ${b.batchId}...`);
    let batchProcessed = 0;
    let batchErrors = 0;
    let pendingRows: ParsedRow[] = [];

    const resultsStream = await anthropic.beta.messages.batches.results(b.batchId);
    for await (const result of resultsStream) {
      const rowIds = b.rowMapping[result.custom_id];
      if (!rowIds) {
        console.error(`  Unknown custom_id: ${result.custom_id}`);
        batchErrors++;
        continue;
      }

      if (result.result.type !== 'succeeded') {
        console.error(`  ${result.custom_id}: ${result.result.type}`);
        batchErrors += rowIds.length;
        continue;
      }

      const textBlock = result.result.message.content.find((b: { type: string }) => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        batchErrors += rowIds.length;
        continue;
      }

      try {
        const cleaned = textBlock.text
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/, '')
          .replace(/\s*```\s*$/, '')
          .trim();
        const normalised = JSON.parse(cleaned) as Array<{
          address_normalised: string;
          town: string | null;
          county: string;
          eircode: string | null;
          property_type: string;
          is_new: boolean;
        }>;

        for (let i = 0; i < rowIds.length && i < normalised.length; i++) {
          const norm = normalised[i]!;
          const rowId = rowIds[i]!;
          const townKey = norm.town ? `${norm.town.toLowerCase()}|${norm.county.toLowerCase()}` : null;
          const townId = townKey ? townLookup.get(townKey) ?? null : null;

          pendingRows.push({
            id: rowId,
            addressNormalised: norm.address_normalised,
            townId,
            county: norm.county,
            eircode: norm.eircode?.slice(0, 8) || null,
            isNew: norm.is_new,
            propertyType: sanitisePropertyType(norm.property_type),
          });
        }

        batchProcessed += rowIds.length;
      } catch (err) {
        console.error(`  ${result.custom_id}: parse error:`, (err as Error).message.slice(0, 100));
        batchErrors += rowIds.length;
      }

      // Flush in batches of UPDATE_BATCH
      if (pendingRows.length >= UPDATE_BATCH) {
        try {
          await flushUpdates(pendingRows);
        } catch (err) {
          console.error(`  flush error (${pendingRows.length} rows):`, (err as Error).message.slice(0, 120));
          batchErrors += pendingRows.length;
          batchProcessed -= pendingRows.length;
        }
        pendingRows = [];
      }

      if ((batchProcessed + batchErrors) % 5000 === 0) {
        console.log(`  Progress: ${batchProcessed} updated, ${batchErrors} errors`);
      }
    }

    // Flush remaining
    try {
      await flushUpdates(pendingRows);
    } catch (err) {
      console.error(`  flush error (${pendingRows.length} rows):`, (err as Error).message.slice(0, 120));
      batchErrors += pendingRows.length;
      batchProcessed -= pendingRows.length;
    }

    console.log(`  Batch done: ${batchProcessed} updated, ${batchErrors} errors`);
    totalProcessed += batchProcessed;
    totalErrors += batchErrors;
  }

  console.log(`\nTotal: ${totalProcessed} updated, ${totalErrors} errors`);
}

// ---- MAIN ----

async function main() {
  const command = process.argv[2];
  switch (command) {
    case 'submit':
      await submit();
      break;
    case 'status':
      await status();
      break;
    case 'retrieve':
      await retrieve();
      break;
    default:
      console.log('Usage: batch-normalise.ts <submit|status|retrieve>');
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
