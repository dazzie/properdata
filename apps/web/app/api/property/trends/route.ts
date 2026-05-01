import { NextRequest, NextResponse } from 'next/server';
import { getSQL } from '../db';

export async function GET(request: NextRequest) {
  const sql = getSQL();
  const params = request.nextUrl.searchParams;

  const county = params.get('county');
  const groupBy = params.get('group_by') ?? 'year';
  const propertyType = params.get('property_type');

  const conditions: string[] = [];
  const args: unknown[] = [];
  let idx = 1;

  if (county) {
    conditions.push(`county ILIKE $${idx}`);
    args.push(county);
    idx++;
  }
  if (propertyType) {
    conditions.push(`property_type = $${idx}`);
    args.push(propertyType);
    idx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const periodExpr =
    groupBy === 'quarter'
      ? `extract(year from sale_date) || '-Q' || extract(quarter from sale_date)`
      : `extract(year from sale_date)`;

  const query = `
    SELECT ${periodExpr} as period,
           count(*) as total_sales,
           round(avg(price::numeric)) as avg_price,
           round(percentile_cont(0.5) WITHIN GROUP (ORDER BY price::numeric)) as median_price
    FROM sales
    ${where}
    GROUP BY period
    ORDER BY period
  `;

  try {
    const rows = await sql(query, args);
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
