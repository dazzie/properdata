import 'server-only';

import { neon } from '@neondatabase/serverless';

export type PropertyType =
  | 'detached'
  | 'semi_detached'
  | 'terraced'
  | 'apartment'
  | 'duplex'
  | 'bungalow';

export interface ComparableTarget {
  location?: { lng: number; lat: number };
  eircodeRoutingKey?: string;
  county: string;
  propertyType?: PropertyType;
  maxRadiusMeters?: number;
  maxAgeMonths?: number;
  limit?: number;
}

export interface ComparableCandidate {
  id: number;
  saleDate: string;
  price: number;
  addressNormalised: string | null;
  addressRaw: string;
  county: string;
  eircode: string | null;
  propertyType: string | null;
  isNew: boolean;
  description: string | null;
  distanceMeters: number | null;
  monthsAgo: number;
}

const SIMILAR_TYPES: Record<string, string[]> = {
  semi_detached: ['semi_detached', 'terraced'],
  terraced: ['terraced', 'semi_detached'],
  detached: ['detached', 'bungalow'],
  bungalow: ['bungalow', 'detached'],
  apartment: ['apartment', 'duplex'],
  duplex: ['duplex', 'apartment'],
};

function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
  return neon(process.env.DATABASE_URL);
}

const BASE_COLUMNS = `
  id,
  sale_date AS "saleDate",
  price::numeric AS price,
  address_normalised AS "addressNormalised",
  address_raw AS "addressRaw",
  county,
  eircode,
  property_type AS "propertyType",
  is_new AS "isNew",
  description`;

export async function findComparableCandidates(
  target: ComparableTarget,
): Promise<ComparableCandidate[]> {
  const sql = getSql();
  const maxAge = target.maxAgeMonths ?? 18;
  const maxRadius = target.maxRadiusMeters ?? 2000;
  const resultLimit = Math.min(target.limit ?? 30, 50);

  const types = target.propertyType
    ? SIMILAR_TYPES[target.propertyType] ?? [target.propertyType]
    : null;

  // Mode 1: PostGIS spatial query (when target has coordinates and sales are geocoded)
  if (target.location) {
    const args: unknown[] = [target.location.lng, target.location.lat, maxAge, maxRadius, resultLimit];
    let typeClause = '';
    if (types) {
      typeClause = `AND property_type IN (${types.map((_, i) => `$${args.length + i + 1}`).join(', ')})`;
      args.push(...types);
    }

    const rows = await sql(
      `SELECT ${BASE_COLUMNS},
        ST_Distance(
          location::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        )::integer AS "distanceMeters",
        EXTRACT(MONTH FROM AGE(CURRENT_DATE, sale_date))::integer AS "monthsAgo"
      FROM sales
      WHERE location IS NOT NULL
        AND sale_date >= CURRENT_DATE - MAKE_INTERVAL(months => $3)
        AND ST_DWithin(
          location::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          $4
        )
        ${typeClause}
      ORDER BY
        ST_Distance(
          location::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) + (EXTRACT(MONTH FROM AGE(CURRENT_DATE, sale_date)) * 50)
      LIMIT $5`,
      args,
    );

    if (rows.length > 0) return rows as unknown as ComparableCandidate[];
  }

  // Mode 2: Eircode routing key matching (same ~2-5km postal area)
  if (target.eircodeRoutingKey) {
    const routingKey = target.eircodeRoutingKey.toUpperCase();
    const args: unknown[] = [target.county, routingKey, maxAge, resultLimit];
    let typeClause = '';
    if (types) {
      typeClause = `AND property_type IN (${types.map((_, i) => `$${args.length + i + 1}`).join(', ')})`;
      args.push(...types);
    }

    const rows = await sql(
      `SELECT ${BASE_COLUMNS},
        NULL::integer AS "distanceMeters",
        EXTRACT(MONTH FROM AGE(CURRENT_DATE, sale_date))::integer AS "monthsAgo"
      FROM sales
      WHERE county ILIKE $1
        AND eircode IS NOT NULL
        AND UPPER(LEFT(eircode, 3)) = $2
        AND sale_date >= CURRENT_DATE - MAKE_INTERVAL(months => $3)
        ${typeClause}
      ORDER BY sale_date DESC
      LIMIT $4`,
      args,
    );

    if (rows.length >= 5) return rows as unknown as ComparableCandidate[];
  }

  // Mode 3: County-wide fallback with property type matching
  const args: unknown[] = [target.county, maxAge, resultLimit];
  let typeClause = '';
  if (types) {
    typeClause = `AND property_type IN (${types.map((_, i) => `$${args.length + i + 1}`).join(', ')})`;
    args.push(...types);
  }

  const rows = await sql(
    `SELECT ${BASE_COLUMNS},
      NULL::integer AS "distanceMeters",
      EXTRACT(MONTH FROM AGE(CURRENT_DATE, sale_date))::integer AS "monthsAgo"
    FROM sales
    WHERE county ILIKE $1
      AND sale_date >= CURRENT_DATE - MAKE_INTERVAL(months => $2)
      ${typeClause}
    ORDER BY sale_date DESC
    LIMIT $3`,
    args,
  );

  return rows as unknown as ComparableCandidate[];
}
