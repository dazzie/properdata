import { db, rtbRents } from '../packages/db/src';
import { sql } from 'drizzle-orm';
async function main() {
  const r = await db.execute<{ cnt: string }>(sql`SELECT COUNT(*) AS cnt FROM ${rtbRents} WHERE county = 'Cork' AND is_new_tenancy = true`);
  console.log('Cork rows:', r.rows?.[0]?.cnt);
  const r2 = await db.execute<{ quarter: string; rent: string }>(sql`
    SELECT quarter, standardised_monthly_rent AS rent FROM ${rtbRents}
    WHERE county = 'Cork' AND bedrooms = 2 AND is_new_tenancy = true ORDER BY quarter DESC LIMIT 3`);
  console.log('Cork 2-bed recent:', r2.rows);
}
main().catch(console.error);
