import { NextRequest, NextResponse } from 'next/server';
import { getSQL } from '../db';

export async function GET(request: NextRequest) {
  const sql = getSQL();
  const params = request.nextUrl.searchParams;

  const county = params.get('county');
  const year = params.get('year');
  const propertyType = params.get('property_type');

  const conditions: string[] = [];
  const args: unknown[] = [];
  let idx = 1;

  if (county) {
    conditions.push(`county ILIKE $${idx}`);
    args.push(county);
    idx++;
  }
  if (year) {
    conditions.push(`extract(year from sale_date) = $${idx}`);
    args.push(Number(year));
    idx++;
  }
  if (propertyType) {
    conditions.push(`property_type = $${idx}`);
    args.push(propertyType);
    idx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT county,
           count(*) as total_sales,
           round(avg(price::numeric)) as avg_price,
           round(percentile_cont(0.5) WITHIN GROUP (ORDER BY price::numeric)) as median_price,
           round(min(price::numeric)) as min_price,
           round(max(price::numeric)) as max_price,
           round(100.0 * count(*) FILTER (WHERE is_new) / NULLIF(count(*), 0), 1) as new_build_pct
    FROM sales
    ${where}
    GROUP BY county
    ORDER BY total_sales DESC
  `;

  try {
    const rows = await sql(query, args);
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
