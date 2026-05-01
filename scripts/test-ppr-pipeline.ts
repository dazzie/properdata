/**
 * Small test run of the PPR pipeline — downloads CSV, parses, normalises
 * and inserts ~50 rows to verify everything works end-to-end.
 *
 * Run with:
 *   export $(grep -v '^#' .env.local | grep '=' | xargs)
 *   node --conditions react-server --loader tsx/esm scripts/test-ppr-pipeline.ts
 */

import { downloadPprCsv, parsePprCsv, computePprUid } from '../packages/scrapers/src/ppr';

async function main() {

  console.log('Step 1: Downloading PPR CSV...');
  const csvText = await downloadPprCsv();
  console.log(`  Downloaded ${(csvText.length / 1024 / 1024).toFixed(1)} MB`);

  console.log('\nStep 2: Parsing CSV...');
  const allRows = parsePprCsv(csvText);
  console.log(`  Parsed ${allRows.length} total rows`);

  const sample = allRows[0];
  if (sample) {
    console.log('\n  Sample parsed row:');
    console.log(`    Date: ${sample.saleDate}`);
    console.log(`    Address: ${sample.address}`);
    console.log(`    County: ${sample.county}`);
    console.log(`    Price: ${sample.price.toLocaleString()}`);
    console.log(`    Eircode: ${sample.eircode ?? 'none'}`);
    console.log(`    Description: ${sample.descriptionOfProperty}`);
    console.log(`    UID: ${computePprUid(sample)}`);
  }

  // Test normalisation on 5 rows
  console.log('\nStep 3: Testing normalisation agent on 5 rows...');
  const { normaliseSale } = await import('../packages/agents/src/index');

  const testRows = allRows.slice(-5);
  for (const row of testRows) {
    try {
      const result = await normaliseSale({
        'Date of Sale': row.saleDate,
        Address: row.address,
        County: row.county,
        Eircode: row.eircode,
        Price: row.price,
        'Description of Property': row.descriptionOfProperty,
      });
      console.log(`  ${row.address.slice(0, 60)}`);
      console.log(`    -> ${result.address_normalised} | town: ${result.town} (${result.town_match_confidence}) | type: ${result.property_type}`);
    } catch (err) {
      console.error(`  FAILED: ${row.address.slice(0, 50)}`, (err as Error).message.slice(0, 100));
    }
  }

  // Test DB insert of 50 rows
  console.log('\nStep 4: Inserting 50 rows into database...');
  const { db } = await import('../packages/db/src/seed-client');
  const dbSchema = await import('../packages/db/src/schema');
  // sql is now re-exported from db/src/index.ts
  const { sql } = await import('../packages/db/src/index');

  const allTowns = await db.select({ id: dbSchema.towns.id, name: dbSchema.towns.name, county: dbSchema.towns.county }).from(dbSchema.towns);
  console.log(`  Loaded ${allTowns.length} towns for matching`);
  const townLookup = new Map(allTowns.map((t) => [`${t.name.toLowerCase()}|${t.county.toLowerCase()}`, t.id]));

  const insertBatch = allRows.slice(-50);
  let inserted = 0;
  let errors = 0;

  for (const row of insertBatch) {
    try {
      const norm = await normaliseSale({
        'Date of Sale': row.saleDate,
        Address: row.address,
        County: row.county,
        Eircode: row.eircode,
        Price: row.price,
        'Description of Property': row.descriptionOfProperty,
      });

      const townKey = norm.town ? `${norm.town.toLowerCase()}|${norm.county.toLowerCase()}` : null;
      const townId = townKey ? townLookup.get(townKey) ?? null : null;

      await db.insert(dbSchema.sales).values({
        pprUid: computePprUid(row),
        saleDate: row.saleDate,
        price: row.price.toFixed(2),
        addressRaw: row.address,
        addressNormalised: norm.address_normalised,
        townId,
        county: norm.county || row.county,
        eircode: norm.eircode || row.eircode,
        isNew: norm.is_new,
        propertyType: norm.property_type !== 'unknown' ? norm.property_type : null,
        description: row.descriptionOfProperty || null,
        vatExclusive: row.vatExclusive,
        rawRow: {
          saleDate: row.saleDate,
          address: row.address,
          county: row.county,
          eircode: row.eircode,
          price: row.price,
        },
      }).onConflictDoNothing({ target: dbSchema.sales.pprUid });

      inserted++;
      if (inserted % 10 === 0) console.log(`  ${inserted}/50 inserted`);
    } catch (err) {
      errors++;
      console.error(`  Error: ${(err as Error).message.slice(0, 120)}`);
    }
  }

  console.log(`\nDone: ${inserted} inserted, ${errors} errors out of 50`);

  const count = await db.select({ count: sql<number>`count(*)` }).from(dbSchema.sales);
  console.log(`Total rows in sales table: ${count[0]?.count ?? 0}`);
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
