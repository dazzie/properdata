-- ProperData — town_metrics materialised view
--
-- Run AFTER the Drizzle-generated migrations have created the base tables.
-- This view powers the weekly newsletter, town profiles, and most analytical queries.
--
-- Refreshed daily by /api/cron/metrics-refresh (Vercel Cron, 06:00 UTC).
--
-- Run with: psql $DATABASE_URL -f packages/db/migrations/0001_town_metrics.sql

CREATE MATERIALIZED VIEW IF NOT EXISTS town_metrics AS
WITH recent_sales AS (
  SELECT
    town_id,
    sale_date,
    price::numeric AS price,
    is_new,
    property_type
  FROM sales
  WHERE town_id IS NOT NULL
    AND sale_date >= CURRENT_DATE - INTERVAL '24 months'
),
sales_90d AS (
  SELECT
    town_id,
    COUNT(*) AS sales_count,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) AS median_price,
    AVG(price) AS mean_price,
    SUM(CASE WHEN is_new THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) AS new_build_share
  FROM recent_sales
  WHERE sale_date >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY town_id
),
sales_12m AS (
  SELECT
    town_id,
    COUNT(*) AS sales_count,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) AS median_price
  FROM recent_sales
  WHERE sale_date >= CURRENT_DATE - INTERVAL '12 months'
  GROUP BY town_id
),
sales_prior_12m AS (
  SELECT
    town_id,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) AS median_price
  FROM recent_sales
  WHERE sale_date >= CURRENT_DATE - INTERVAL '24 months'
    AND sale_date < CURRENT_DATE - INTERVAL '12 months'
  GROUP BY town_id
)
SELECT
  t.id AS town_id,
  t.slug,
  t.name,
  t.county,
  CURRENT_DATE AS as_of_date,
  COALESCE(s90.sales_count, 0) AS sales_count_90d,
  s90.median_price AS median_price_90d,
  s12.median_price AS median_price_12m,
  CASE
    WHEN s12.median_price IS NOT NULL AND sp.median_price IS NOT NULL AND sp.median_price > 0
    THEN ((s12.median_price - sp.median_price) / sp.median_price)::numeric(6, 4)
    ELSE NULL
  END AS yoy_price_change,
  s90.new_build_share,
  -- ftb_share placeholder; populated when stamp duty data is integrated
  NULL::numeric(6, 4) AS ftb_share,
  -- days_on_market_estimate placeholder; populated when listings data integrated
  NULL::integer AS days_on_market_estimate
FROM towns t
LEFT JOIN sales_90d s90 ON s90.town_id = t.id
LEFT JOIN sales_12m s12 ON s12.town_id = t.id
LEFT JOIN sales_prior_12m sp ON sp.town_id = t.id
WHERE t.is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS town_metrics_town_id_idx ON town_metrics (town_id);
CREATE INDEX IF NOT EXISTS town_metrics_county_idx ON town_metrics (county);

-- Spatial indexes on base tables
CREATE INDEX IF NOT EXISTS towns_centroid_idx ON towns USING GIST (centroid);
CREATE INDEX IF NOT EXISTS sales_location_idx ON sales USING GIST (location);
CREATE INDEX IF NOT EXISTS planning_apps_location_idx ON planning_apps USING GIST (location);

-- Refresh function for cron job
CREATE OR REPLACE FUNCTION refresh_town_metrics()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY town_metrics;
END;
$$;
