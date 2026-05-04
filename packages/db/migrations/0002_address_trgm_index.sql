-- Trigram GIN index for fast ILIKE address search
-- pg_trgm extension was already enabled in 0000_extensions.sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS sales_address_normalised_trgm_idx
  ON sales USING GIN (address_normalised gin_trgm_ops);
