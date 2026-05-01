import 'server-only';

import { db } from '../client';
import { berRatings, sales, towns } from '../schema';
import { eq, and, sql, gte, isNotNull } from 'drizzle-orm';

export interface BerPremiumBand {
  rating: string;
  medianPrice: number;
  saleCount: number;
  premiumVsD: number | null;
}

/**
 * Cross-reference BER ratings with PPR sales to surface the BER premium —
 * how much more an A/B/C-rated home sells for vs a D-rated one in the same town.
 *
 * Joins on eircode routing key (both BER and sales tables have this field).
 * Groups by BER rating band (A, B, C, D, E+).
 * Only includes bands with 5+ sales for statistical relevance.
 */
export async function berPremiumByTown(townId: number): Promise<BerPremiumBand[]> {
  // Get the town's eircode routing key
  const townRows = await db
    .select({ eircodeRoutingKey: towns.eircodeRoutingKey })
    .from(towns)
    .where(eq(towns.id, townId))
    .limit(1);

  const town = townRows[0];
  if (!town?.eircodeRoutingKey) return [];

  const routingKey = town.eircodeRoutingKey;

  // Join BER ratings with sales via eircode routing key and compute medians per band
  // Band logic: A (A1-A3), B (B1-B3), C (C1-C3), D (D1-D2), E+ (E1, E2, F, G)
  const result = await db.execute<{
    band: string;
    median_price: string;
    sale_count: string;
  }>(sql`
    WITH ber_sales AS (
      SELECT
        CASE
          WHEN b.rating LIKE 'A%' THEN 'A'
          WHEN b.rating LIKE 'B%' THEN 'B'
          WHEN b.rating LIKE 'C%' THEN 'C'
          WHEN b.rating LIKE 'D%' THEN 'D'
          ELSE 'E+'
        END AS band,
        s.price::numeric AS price
      FROM ${berRatings} b
      JOIN ${sales} s ON s.eircode IS NOT NULL
        AND LEFT(s.eircode, 3) = b.eircode_routing_key
        AND b.dwelling_type IS NOT NULL
      WHERE b.eircode_routing_key = ${routingKey}
        AND s.town_id = ${townId}
        AND s.sale_date >= (CURRENT_DATE - INTERVAL '3 years')
    )
    SELECT
      band,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) AS median_price,
      COUNT(*)::text AS sale_count
    FROM ber_sales
    GROUP BY band
    HAVING COUNT(*) >= 5
    ORDER BY
      CASE band
        WHEN 'A' THEN 1
        WHEN 'B' THEN 2
        WHEN 'C' THEN 3
        WHEN 'D' THEN 4
        WHEN 'E+' THEN 5
      END
  `);

  if (!result.rows || result.rows.length === 0) return [];

  // Find the D-band median as baseline
  const dBand = result.rows.find((r) => r.band === 'D');
  const dMedian = dBand ? parseFloat(dBand.median_price) : null;

  return result.rows.map((row) => {
    const medianPrice = parseFloat(row.median_price);
    let premiumVsD: number | null = null;

    if (dMedian && dMedian > 0 && row.band !== 'D') {
      premiumVsD = Math.round(((medianPrice - dMedian) / dMedian) * 1000) / 10;
    }

    return {
      rating: row.band,
      medianPrice: Math.round(medianPrice),
      saleCount: parseInt(row.sale_count, 10),
      premiumVsD,
    };
  });
}

export interface BerDistribution {
  rating: string;
  count: number;
  avgEnergyValue: number | null;
}

/**
 * Get BER rating distribution for a town.
 */
export async function berDistributionByTown(townId: number): Promise<BerDistribution[]> {
  const result = await db.execute<{
    rating: string;
    count: string;
    avg_energy: string | null;
  }>(sql`
    SELECT
      rating,
      COUNT(*)::text AS count,
      AVG(energy_value)::text AS avg_energy
    FROM ${berRatings}
    WHERE town_id = ${townId}
    GROUP BY rating
    ORDER BY rating
  `);

  if (!result.rows) return [];

  return result.rows.map((row) => ({
    rating: row.rating,
    count: parseInt(row.count, 10),
    avgEnergyValue: row.avg_energy ? Math.round(parseFloat(row.avg_energy)) : null,
  }));
}
