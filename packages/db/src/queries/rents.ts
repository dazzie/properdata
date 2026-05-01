import 'server-only';

import { neon } from '@neondatabase/serverless';

export interface RtbRentRow {
  quarter: string;
  county: string;
  propertyType: string | null;
  bedrooms: number | null;
  isNewTenancy: boolean | null;
  standardisedMonthlyRent: number | null;
  sampleSize: number | null;
}

function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
  return neon(process.env.DATABASE_URL);
}

export async function findRentBenchmark(opts: {
  county: string;
  propertyType?: string;
  bedrooms?: number;
}): Promise<RtbRentRow | null> {
  const sql = getSql();

  const args: unknown[] = [opts.county];
  const conditions = ['county ILIKE $1', 'is_new_tenancy = true'];
  let idx = 2;

  if (opts.bedrooms) {
    conditions.push(`bedrooms = $${idx}`);
    args.push(opts.bedrooms);
    idx++;
  }

  const where = conditions.join(' AND ');

  const rows = await sql(
    `SELECT
      quarter,
      county,
      property_type AS "propertyType",
      bedrooms,
      is_new_tenancy AS "isNewTenancy",
      standardised_monthly_rent::numeric AS "standardisedMonthlyRent",
      sample_size AS "sampleSize"
    FROM rtb_rents
    WHERE ${where}
    ORDER BY quarter DESC
    LIMIT 1`,
    args,
  );

  if (rows.length === 0) return null;
  return rows[0] as unknown as RtbRentRow;
}
