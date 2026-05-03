import 'server-only';

import { db } from '../client';
import { berRatings } from '../schema';
import { sql } from 'drizzle-orm';

export interface BerLookupResult {
  rating: string;
  yearBuilt: number | null;
  dwellingType: string | null;
  floorArea: number | null;
  sampleSize: number;
  isAreaEstimate: boolean;
}

const PPR_TO_BER_DWELLING: Record<string, string[]> = {
  detached: ['Detached house'],
  semi_detached: ['Semi-detached house'],
  terraced: ['Mid-terrace house', 'End of terrace house'],
  end_terrace: ['End of terrace house'],
  apartment: ['Mid-floor apartment', 'Top-floor apartment', 'Ground-floor apartment', 'Basement Dwelling'],
  bungalow: ['Detached house'],
  townhouse: ['End of terrace house', 'Mid-terrace house'],
};

/**
 * Look up BER statistics for a given area. Tries routing key first (if available),
 * falls back to county + dwelling type matching against the SEAI public dataset.
 */
export async function lookupBerByRoutingKey(opts: {
  routingKey?: string;
  county?: string;
  propertyType?: string;
}): Promise<BerLookupResult | null> {
  if (!opts.routingKey && !opts.county) return null;

  const dwellingFilter = opts.propertyType ? PPR_TO_BER_DWELLING[opts.propertyType] : undefined;

  const result = await db.execute<{
    mode_rating: string;
    median_year: string | null;
    mode_dwelling: string | null;
    median_floor_area: string | null;
    sample_size: string;
  }>(sql`
    WITH filtered AS (
      SELECT rating, year_built, dwelling_type, floor_area
      FROM ${berRatings}
      WHERE 1=1
        ${opts.routingKey
          ? sql`AND eircode_routing_key = ${opts.routingKey.toUpperCase()}`
          : sql``}
        ${opts.county ? sql`AND county_name = ${opts.county}` : sql``}
        ${dwellingFilter && dwellingFilter.length > 0
          ? sql`AND dwelling_type IN (${sql.join(dwellingFilter.map((d) => sql`${d}`), sql`, `)})`
          : sql``}
    )
    SELECT
      (SELECT rating FROM filtered GROUP BY rating ORDER BY COUNT(*) DESC LIMIT 1) AS mode_rating,
      (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY year_built)
       FROM filtered WHERE year_built IS NOT NULL)::text AS median_year,
      (SELECT dwelling_type FROM filtered WHERE dwelling_type IS NOT NULL
       GROUP BY dwelling_type ORDER BY COUNT(*) DESC LIMIT 1) AS mode_dwelling,
      (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY floor_area::numeric)
       FROM filtered WHERE floor_area IS NOT NULL)::text AS median_floor_area,
      (SELECT COUNT(*)::text FROM filtered) AS sample_size
  `);

  const row = result.rows?.[0];
  if (!row?.mode_rating || row.sample_size === '0') return null;

  return {
    rating: row.mode_rating,
    yearBuilt: row.median_year ? Math.round(parseFloat(row.median_year)) : null,
    dwellingType: row.mode_dwelling,
    floorArea: row.median_floor_area ? Math.round(parseFloat(row.median_floor_area)) : null,
    sampleSize: parseInt(row.sample_size, 10),
    isAreaEstimate: parseInt(row.sample_size, 10) > 1,
  };
}
