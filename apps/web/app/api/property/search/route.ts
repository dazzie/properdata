import { NextRequest, NextResponse } from 'next/server';
import { getSQL } from '../db';

const SORT_MAP: Record<string, string> = {
  date_desc: 'sale_date DESC',
  date_asc: 'sale_date ASC',
  price_desc: 'price DESC',
  price_asc: 'price ASC',
};

export async function GET(request: NextRequest) {
  const sql = getSQL();
  const params = request.nextUrl.searchParams;

  const county = params.get('county');
  const minPrice = params.get('min_price');
  const maxPrice = params.get('max_price');
  const fromDate = params.get('from_date');
  const toDate = params.get('to_date');
  const propertyType = params.get('property_type');
  const addressSearch = params.get('address_search');
  const isNew = params.get('is_new');
  const limitParam = params.get('limit');
  const offsetParam = params.get('offset');
  const sortParam = params.get('sort');

  const conditions: string[] = [];
  const args: unknown[] = [];
  let idx = 1;

  if (county) {
    conditions.push(`county ILIKE $${idx}`);
    args.push(county);
    idx++;
  }
  if (minPrice) {
    conditions.push(`price >= $${idx}`);
    args.push(Number(minPrice));
    idx++;
  }
  if (maxPrice) {
    conditions.push(`price <= $${idx}`);
    args.push(Number(maxPrice));
    idx++;
  }
  if (fromDate) {
    conditions.push(`sale_date >= $${idx}`);
    args.push(fromDate);
    idx++;
  }
  if (toDate) {
    conditions.push(`sale_date <= $${idx}`);
    args.push(toDate);
    idx++;
  }
  if (propertyType) {
    conditions.push(`property_type = $${idx}`);
    args.push(propertyType);
    idx++;
  }
  if (addressSearch) {
    conditions.push(
      `(address_normalised ILIKE $${idx} OR (address_normalised IS NULL AND address_raw ILIKE $${idx}))`,
    );
    args.push(`%${addressSearch}%`);
    idx++;
  }
  if (isNew != null) {
    conditions.push(`is_new = $${idx}`);
    args.push(isNew === 'true');
    idx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(Number(limitParam) || 50, 200);
  const offset = Math.max(Number(offsetParam) || 0, 0);
  const orderBy = SORT_MAP[sortParam ?? ''] ?? SORT_MAP.date_desc;

  const query = `
    SELECT id, sale_date, price, address_raw, address_normalised, county, eircode,
           property_type, is_new, description,
           ST_Y(location::geometry) AS lat,
           ST_X(location::geometry) AS lng
    FROM sales
    ${where}
    ORDER BY ${orderBy}
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  try {
    const rows = await sql(query, args);

    const countQuery = `SELECT count(*) as total FROM sales ${where}`;
    const countResult = await sql(countQuery, args);
    const total = Number(countResult[0]?.total ?? 0);

    return NextResponse.json({ rows, total, limit, offset });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
