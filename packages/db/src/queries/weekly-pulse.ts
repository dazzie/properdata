import 'server-only';

import { neon } from '@neondatabase/serverless';

interface TownMetricsRow {
  townId: number;
  name: string;
  county: string;
  salesCount90d: number;
  medianPrice90d: number | null;
  medianPrice12m: number | null;
  yoyPriceChange: number | null;
}

interface NotableSaleRow {
  address: string;
  price: number;
  saleDate: string;
  propertyType: string | null;
  isNew: boolean;
}

interface GrantUpdateRow {
  code: string;
  name: string;
  description: string;
}

export interface WeeklyPulseBerSummary {
  rating: string;
  medianPrice: number;
  saleCount: number;
  premiumVsD: number | null;
}

export interface WeeklyPulseAnomaly {
  metric: string;
  currentValue: number;
  baselineValue: number;
  deviationPct: number;
  significance: string;
  explanation: string;
}

export interface WeeklyPulseRegulatoryChange {
  label: string;
  category: string;
  summary: string;
  subscriberImpact: string | null;
}

export interface WeeklyPulseData {
  week_ending: string;
  towns: Array<{
    name: string;
    county: string;
    metrics: {
      median_price_12m: number | null;
      median_price_3m: number | null;
      yoy_change_pct: number | null;
      sales_count_90d: number;
    };
    notable_sales: Array<{
      address: string;
      price: number;
      date: string;
      property_type: string | null;
      is_new: boolean;
    }>;
    ber_premium: WeeklyPulseBerSummary[] | null;
    anomalies: WeeklyPulseAnomaly[] | null;
  }>;
  grant_updates: string | null;
  regulatory_context: string | null;
  regulatory_changes: WeeklyPulseRegulatoryChange[] | null;
}

function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
  return neon(process.env.DATABASE_URL);
}

function stripHouseNumber(address: string): string {
  return address.replace(/^\d+[A-Za-z]?\s+/, '').replace(/^(No\.?\s*|Unit\s+)\d+[A-Za-z]?\s*/i, '');
}

export async function assembleWeeklyPulseData(
  weekEnding?: string,
  townSlugs?: string[],
): Promise<WeeklyPulseData> {
  const sql = getSql();
  const endDate = weekEnding ?? new Date().toISOString().slice(0, 10);

  // 1. Get active towns (optionally filtered by slug)
  let townFilter = '';
  const townArgs: unknown[] = [];
  if (townSlugs && townSlugs.length > 0) {
    townFilter = `AND slug IN (${townSlugs.map((_, i) => `$${i + 1}`).join(', ')})`;
    townArgs.push(...townSlugs);
  }

  const townsRows = await sql(
    `SELECT id, name, county FROM towns WHERE is_active = true ${townFilter} ORDER BY name`,
    townArgs,
  );

  const towns: WeeklyPulseData['towns'] = [];

  for (const town of townsRows) {
    const townId = town.id as number;
    const townName = town.name as string;
    const townCounty = town.county as string;

    // 2. Get town metrics from materialised view
    const metricsRows = await sql(
      `SELECT
        sales_count_90d AS "salesCount90d",
        median_price_90d::numeric AS "medianPrice90d",
        median_price_12m::numeric AS "medianPrice12m",
        yoy_price_change::numeric AS "yoyPriceChange"
      FROM town_metrics
      WHERE town_id = $1
      LIMIT 1`,
      [townId],
    ) as unknown as TownMetricsRow[];

    const m = metricsRows[0];

    // 3. Get notable sales from the past 7 days for this town
    const salesRows = await sql(
      `SELECT
        COALESCE(address_normalised, address_raw) AS address,
        price::numeric AS price,
        sale_date AS "saleDate",
        property_type AS "propertyType",
        is_new AS "isNew"
      FROM sales
      WHERE town_id = $1
        AND sale_date >= ($2::date - INTERVAL '7 days')
        AND sale_date <= $2::date
      ORDER BY price DESC
      LIMIT 10`,
      [townId, endDate],
    ) as unknown as NotableSaleRow[];

    // 3b. BER premium data (if available)
    let berPremium: WeeklyPulseBerSummary[] | null = null;
    try {
      const berRows = await sql(
        `WITH ber_sales AS (
          SELECT
            CASE
              WHEN b.rating LIKE 'A%' THEN 'A'
              WHEN b.rating LIKE 'B%' THEN 'B'
              WHEN b.rating LIKE 'C%' THEN 'C'
              WHEN b.rating LIKE 'D%' THEN 'D'
              ELSE 'E+'
            END AS band,
            s.price::numeric AS price
          FROM ber_ratings b
          JOIN sales s ON s.eircode IS NOT NULL
            AND LEFT(s.eircode, 3) = b.eircode_routing_key
          WHERE s.town_id = $1
            AND s.sale_date >= (CURRENT_DATE - INTERVAL '3 years')
        )
        SELECT
          band,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)::text AS median_price,
          COUNT(*)::text AS sale_count
        FROM ber_sales
        GROUP BY band
        HAVING COUNT(*) >= 5
        ORDER BY CASE band WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 WHEN 'D' THEN 4 ELSE 5 END`,
        [townId],
      ) as unknown as Array<{ band: string; median_price: string; sale_count: string }>;

      if (berRows.length > 0) {
        const dBand = berRows.find((r) => r.band === 'D');
        const dMedian = dBand ? parseFloat(dBand.median_price) : null;

        berPremium = berRows.map((row) => {
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
    } catch {
      // BER data may not be available yet
    }

    // 3c. Recent anomalies for this town
    let anomalies: WeeklyPulseAnomaly[] | null = null;
    try {
      const anomalyRows = await sql(
        `SELECT payload
        FROM events
        WHERE event_type = 'anomaly_detected'
          AND source LIKE $1
          AND occurred_at >= ($2::date - INTERVAL '7 days')
        ORDER BY occurred_at DESC
        LIMIT 5`,
        [`anomaly-detect:${townName}%`, endDate],
      ) as unknown as Array<{ payload: Record<string, unknown> }>;

      if (anomalyRows.length > 0) {
        anomalies = anomalyRows.map((r) => ({
          metric: r.payload.metric as string,
          currentValue: r.payload.current_value as number,
          baselineValue: r.payload.baseline_value as number,
          deviationPct: r.payload.deviation_pct as number,
          significance: r.payload.significance as string,
          explanation: r.payload.explanation as string,
        }));
      }
    } catch {
      // Anomaly data may not be available yet
    }

    towns.push({
      name: townName,
      county: townCounty,
      metrics: {
        median_price_12m: m?.medianPrice12m ?? null,
        median_price_3m: m?.medianPrice90d ?? null,
        yoy_change_pct: m?.yoyPriceChange ?? null,
        sales_count_90d: m?.salesCount90d ?? 0,
      },
      notable_sales: salesRows.map((s) => ({
        address: stripHouseNumber(s.address),
        price: s.price,
        date: s.saleDate,
        property_type: s.propertyType,
        is_new: s.isNew,
      })),
      ber_premium: berPremium,
      anomalies,
    });
  }

  // 4. Check for grant scheme updates in the past 7 days
  const grantRows = await sql(
    `SELECT code, name, description
    FROM grant_schemes
    WHERE is_active = true
      AND updated_at >= ($1::date - INTERVAL '7 days')
    ORDER BY updated_at DESC`,
    [endDate],
  ) as unknown as GrantUpdateRow[];

  const grant_updates =
    grantRows.length > 0
      ? grantRows.map((g) => `${g.name} (${g.code}): ${g.description}`).join('\n')
      : null;

  // 5. Check for material regulatory changes in the past 7 days
  let regulatoryChanges: WeeklyPulseRegulatoryChange[] | null = null;
  try {
    const regRows = await sql(
      `SELECT payload
      FROM events
      WHERE event_type = 'regulatory_change'
        AND occurred_at >= ($1::date - INTERVAL '7 days')
      ORDER BY occurred_at DESC
      LIMIT 5`,
      [endDate],
    ) as unknown as Array<{ payload: Record<string, unknown> }>;

    if (regRows.length > 0) {
      regulatoryChanges = regRows.map((r) => ({
        label: r.payload.label as string,
        category: r.payload.category as string,
        summary: r.payload.summary as string,
        subscriberImpact: (r.payload.subscriber_impact as string | null) ?? null,
      }));
    }
  } catch {
    // Regulatory data may not be available yet
  }

  return {
    week_ending: endDate,
    towns,
    grant_updates,
    regulatory_context: null,
    regulatory_changes: regulatoryChanges,
  };
}
