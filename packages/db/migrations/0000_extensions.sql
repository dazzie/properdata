-- ProperData — PostGIS and extension initialization
--
-- This migration runs BEFORE the auto-generated Drizzle migrations.
-- It enables the PostgreSQL extensions the schema depends on.
--
-- Run with: psql $DATABASE_URL -f packages/db/migrations/0000_extensions.sql

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgvector;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- After running this, run: pnpm --filter @properdata/db migrate
-- to apply the Drizzle-generated schema migrations.
