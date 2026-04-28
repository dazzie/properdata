/**
 * One-time backfill of historical PPR data.
 *
 * Run with: pnpm tsx scripts/backfill-ppr.ts
 *
 * This is a long-running operation (20-40 minutes for the full ~777K records
 * as of April 2026). DO NOT run from the Vercel cron — Vercel has a 300s max
 * function duration even on Pro plan, and this will exceed it.
 *
 * Run from a local machine with a stable connection. The operation is
 * idempotent (deduplication on ppr_uid) so it can be re-run safely.
 *
 * Sprint 1 — Task 1.9
 *
 * Before running:
 * - Verify DATABASE_URL points to the intended environment (probably staging first)
 * - Verify ANTHROPIC_API_KEY is set (normalisation calls)
 * - Estimate AI cost: ~$0.001 per row × 777K rows = ~$8 in Haiku calls
 * - Be on a stable network — interruptions mean re-fetching the full PPR CSV
 */

import { ingestPpr } from '../packages/scrapers/src/ppr';

async function main() {
  console.log('Starting PPR backfill...');
  console.log('This may take 20-40 minutes. Do not interrupt.\n');

  const start = Date.now();
  const result = await ingestPpr();
  const elapsed = Math.round((Date.now() - start) / 1000);

  console.log(`\n✓ Backfill complete in ${elapsed}s`);
  console.log(`  Total rows in PPR CSV: ${result.totalRows}`);
  console.log(`  New rows ingested: ${result.newRows}`);
  console.log(`  Duplicates skipped: ${result.duplicates}`);
  console.log(`  Errors: ${result.errors}`);

  if (result.errors > 0) {
    console.warn(`\n⚠ ${result.errors} rows failed. Check logs.`);
    process.exit(1);
  }

  console.log('\nNext step: refresh the town_metrics materialised view:');
  console.log('  psql $DATABASE_URL -c "SELECT refresh_town_metrics();"');
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
