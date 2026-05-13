import { db, rtbRents } from '../packages/db/src';
import { sql } from 'drizzle-orm';

const COUNTIES = [
  'Carlow', 'Cavan', 'Clare', 'Cork', 'Donegal', 'Dublin', 'Galway',
  'Kerry', 'Kildare', 'Kilkenny', 'Laois', 'Leitrim', 'Limerick',
  'Longford', 'Louth', 'Mayo', 'Meath', 'Monaghan', 'Offaly',
  'Roscommon', 'Sligo', 'Tipperary', 'Waterford', 'Westmeath',
  'Wexford', 'Wicklow',
];

async function main() {
  console.log('Counties with bare-name RTB rows:');
  for (const c of COUNTIES) {
    const r = await db.execute<{ cnt: string }>(sql`
      SELECT COUNT(*) AS cnt FROM ${rtbRents}
      WHERE county = ${c} AND is_new_tenancy = true`);
    const cnt = parseInt(r.rows?.[0]?.cnt ?? '0', 10);
    if (cnt === 0) {
      // Check what formats exist
      const alt = await db.execute<{ county: string }>(sql`
        SELECT DISTINCT county FROM ${rtbRents}
        WHERE county ILIKE ${'%' + c} AND is_new_tenancy = true
        ORDER BY county LIMIT 3`);
      const altNames = alt.rows?.map((x) => x.county).join(', ') || 'NONE';
      console.log(`  ❌ ${c}: 0 rows — alternatives: ${altNames}`);
    } else {
      console.log(`  ✓ ${c}: ${cnt} rows`);
    }
  }
}

main().catch(console.error);
