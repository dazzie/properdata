import 'server-only';

import { db } from '../client';
import { towns } from '../schema';
import { eq, sql } from 'drizzle-orm';

export interface TownMetricsSnapshot {
  townId: number;
  townName: string;
  county: string;
  medianPrice90d: number | null;
  medianPrice12m: number | null;
  salesCount90d: number;
  yoyPriceChange: number | null;
  newBuildShare: number | null;
  ftbShare: number | null;
}

/**
 * Get current and baseline (same period last year) metrics for a town.
 * Queries the town_metrics materialised view for current data and
 * computes baseline from the sales table directly.
 */
export async function getAnomalyMetrics(townId: number): Promise<{
  current: TownMetricsSnapshot | null;
  baseline: TownMetricsSnapshot | null;
}> {
  // Get town details
  const townRows = await db
    .select({ id: towns.id, name: towns.name, county: towns.county })
    .from(towns)
    .where(eq(towns.id, townId))
    .limit(1);

  const town = townRows[0];
  if (!town) return { current: null, baseline: null };

  // Current metrics from the MV
  const currentResult = await db.execute<{
    sales_count_90d: string;
    median_price_90d: string | null;
    median_price_12m: string | null;
    yoy_price_change: string | null;
    new_build_share: string | null;
    ftb_share: string | null;
  }>(sql`
    SELECT
      sales_count_90d,
      median_price_90d,
      median_price_12m,
      yoy_price_change,
      new_build_share,
      ftb_share
    FROM town_metrics
    WHERE town_id = ${townId}
    LIMIT 1
  `);

  const currentRow = currentResult.rows?.[0];
  const current: TownMetricsSnapshot | null = currentRow
    ? {
        townId: town.id,
        townName: town.name,
        county: town.county,
        medianPrice90d: currentRow.median_price_90d ? parseFloat(currentRow.median_price_90d) : null,
        medianPrice12m: currentRow.median_price_12m ? parseFloat(currentRow.median_price_12m) : null,
        salesCount90d: parseInt(currentRow.sales_count_90d, 10),
        yoyPriceChange: currentRow.yoy_price_change ? parseFloat(currentRow.yoy_price_change) : null,
        newBuildShare: currentRow.new_build_share ? parseFloat(currentRow.new_build_share) : null,
        ftbShare: currentRow.ftb_share ? parseFloat(currentRow.ftb_share) : null,
      }
    : null;

  // Baseline: same 90-day window one year ago
  const baselineResult = await db.execute<{
    sales_count: string;
    median_price: string | null;
    new_build_share: string | null;
  }>(sql`
    SELECT
      COUNT(*)::text AS sales_count,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price::numeric)::text AS median_price,
      (AVG(CASE WHEN is_new THEN 1.0 ELSE 0.0 END) * 100)::text AS new_build_share
    FROM sales
    WHERE town_id = ${townId}
      AND sale_date >= (CURRENT_DATE - INTERVAL '1 year 90 days')
      AND sale_date < (CURRENT_DATE - INTERVAL '1 year')
  `);

  const baselineRow = baselineResult.rows?.[0];
  const baseline: TownMetricsSnapshot | null =
    baselineRow && parseInt(baselineRow.sales_count, 10) > 0
      ? {
          townId: town.id,
          townName: town.name,
          county: town.county,
          medianPrice90d: baselineRow.median_price ? parseFloat(baselineRow.median_price) : null,
          medianPrice12m: null,
          salesCount90d: parseInt(baselineRow.sales_count, 10),
          yoyPriceChange: null,
          newBuildShare: baselineRow.new_build_share ? parseFloat(baselineRow.new_build_share) : null,
          ftbShare: null,
        }
      : null;

  return { current, baseline };
}

/**
 * Get all active town IDs.
 */
export async function getActiveTownIds(): Promise<number[]> {
  const rows = await db
    .select({ id: towns.id })
    .from(towns)
    .where(eq(towns.isActive, true));

  return rows.map((r) => r.id);
}
