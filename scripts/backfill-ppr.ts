/**
 * Two-phase PPR backfill.
 *
 * Phase 1 (raw insert): Inserts all PPR rows without AI normalisation. Fast (~5 min).
 * Phase 2 (normalise):  Normalises un-normalised rows in batches. Rate-limited by API.
 *
 * Run Phase 1:
 *   export $(grep -v '^#' .env.local | grep '=' | xargs)
 *   NODE_OPTIONS='--conditions react-server' pnpm tsx scripts/backfill-ppr.ts
 *
 * Run Phase 2 (normalise N rows, default 100):
 *   export $(grep -v '^#' .env.local | grep '=' | xargs)
 *   NODE_OPTIONS='--conditions react-server' pnpm tsx scripts/backfill-ppr.ts --normalise [N]
 *
 * Both phases are idempotent and can be re-run safely.
 */

import { ingestPpr, normalisePendingSales } from '../packages/scrapers/src/ppr';

const isNormalise = process.argv.includes('--normalise');

async function main() {
  if (isNormalise) {
    const limitArg = process.argv[process.argv.indexOf('--normalise') + 1];
    const limit = limitArg ? parseInt(limitArg, 10) : 100;
    console.log(`Phase 2: Normalising up to ${limit} pending sales...\n`);

    const start = Date.now();
    const result = await normalisePendingSales(limit);
    const elapsed = Math.round((Date.now() - start) / 1000);

    console.log(`\nNormalisation complete in ${elapsed}s`);
    console.log(`  Processed: ${result.processed}`);
    console.log(`  Errors: ${result.errors}`);
    return;
  }

  console.log('Phase 1: Inserting all PPR rows (raw, no AI normalisation)...\n');

  const start = Date.now();
  const result = await ingestPpr();
  const elapsed = Math.round((Date.now() - start) / 1000);

  console.log(`\nPhase 1 complete in ${elapsed}s`);
  console.log(`  Total rows in PPR CSV: ${result.totalRows}`);
  console.log(`  New rows inserted: ${result.inserted}`);
  console.log(`  Duplicates skipped: ${result.duplicates}`);
  console.log(`  Errors: ${result.errors}`);
  console.log(`\nRun with --normalise to start AI normalisation of addresses.`);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
