/**
 * ProperData database schema
 *
 * Core tables:
 *   towns             - Towns we cover, with centroids and bounding boxes
 *   sales             - PPR-derived residential property sales
 *   ber_ratings       - SEAI Building Energy Rating data
 *   planning_apps     - Local authority planning applications
 *   grant_schemes     - All applicable government grant schemes
 *   subscribers       - Email/paid subscribers
 *   events            - Internal event log (for agent orchestration)
 *   cso_stats         - CSO StatBank data (RPPI, transaction volumes)
 *   rtb_rents         - RTB/ESRI Rent Index (county/quarter rents)
 *
 * Conventions:
 *   - All tables have created_at and updated_at timestamps
 *   - Use bigserial primary keys (id) by default
 *   - Use citext for case-insensitive text comparisons (e.g. towns)
 *   - Geometry columns are SRID 4326 (WGS84 lon/lat)
 *   - Use jsonb for flexible/optional fields, never json
 *
 * Migrations: pnpm --filter @properdata/db generate
 */

import {
  pgTable,
  bigserial,
  text,
  varchar,
  integer,
  numeric,
  date,
  timestamp,
  boolean,
  jsonb,
  uniqueIndex,
  index,
  customType,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// -----------------------------------------------------------------------------
// Custom types: PostGIS geometry columns
// -----------------------------------------------------------------------------

export const point = customType<{ data: { lng: number; lat: number }; driverData: string }>({
  dataType() {
    return 'geometry(Point, 4326)';
  },
  toDriver(value) {
    return `SRID=4326;POINT(${value.lng} ${value.lat})`;
  },
});

export const polygon = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'geometry(Polygon, 4326)';
  },
});

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------

export const propertyTypeEnum = pgEnum('property_type', [
  'detached',
  'semi_detached',
  'terraced',
  'apartment',
  'duplex',
  'bungalow',
  'unknown',
]);

export const planningDecisionEnum = pgEnum('planning_decision', [
  'granted',
  'refused',
  'withdrawn',
  'pending',
  'invalid',
]);

export const subscriberTierEnum = pgEnum('subscriber_tier', [
  'free',
  'insider',
  'professional',
  'enterprise',
]);

export const subscriberStatusEnum = pgEnum('subscriber_status', [
  'active',
  'paused',
  'cancelled',
  'churned',
]);

export const buyerTypeEnum = pgEnum('buyer_type', [
  'first_time_buyer',
  'former_owner_occupier',
  'non_occupier',
  'unknown',
]);

// -----------------------------------------------------------------------------
// towns — covered geographic units
// -----------------------------------------------------------------------------

export const towns = pgTable(
  'towns',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    slug: varchar('slug', { length: 100 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    county: varchar('county', { length: 100 }).notNull(),
    centroid: point('centroid').notNull(),
    radiusMeters: integer('radius_meters').notNull().default(3000),
    population2022: integer('population_2022'),
    eircodeRoutingKey: varchar('eircode_routing_key', { length: 3 }),
    coverageStartedAt: date('coverage_started_at'),
    isActive: boolean('is_active').notNull().default(true),
    metadata: jsonb('metadata').$type<{
      historicalPopulation?: Record<string, number>;
      relevantPersonas?: string[];
      notes?: string;
    }>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('towns_slug_idx').on(table.slug),
    index('towns_county_idx').on(table.county),
    // Spatial index added via raw SQL in migration:
    // CREATE INDEX towns_centroid_idx ON towns USING GIST (centroid);
  ],
);

// -----------------------------------------------------------------------------
// sales — PPR residential property sales
// -----------------------------------------------------------------------------

export const sales = pgTable(
  'sales',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    pprUid: varchar('ppr_uid', { length: 100 }).notNull(),
    saleDate: date('sale_date').notNull(),
    price: numeric('price', { precision: 12, scale: 2 }).notNull(),
    addressRaw: text('address_raw').notNull(),
    addressNormalised: text('address_normalised'),
    townId: integer('town_id').references(() => towns.id),
    county: varchar('county', { length: 100 }).notNull(),
    eircode: varchar('eircode', { length: 8 }),
    location: point('location'),
    isNew: boolean('is_new').notNull().default(false),
    propertyType: propertyTypeEnum('property_type'),
    description: text('description'),
    vatExclusive: boolean('vat_exclusive'),
    rawRow: jsonb('raw_row').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('sales_ppr_uid_idx').on(table.pprUid),
    index('sales_sale_date_idx').on(table.saleDate),
    index('sales_town_id_idx').on(table.townId),
    index('sales_county_idx').on(table.county),
    index('sales_eircode_idx').on(table.eircode),
    // Spatial index added via raw SQL in migration:
    // CREATE INDEX sales_location_idx ON sales USING GIST (location);
  ],
);

// -----------------------------------------------------------------------------
// ber_ratings — SEAI BER Research Tool data (anonymised)
// -----------------------------------------------------------------------------

export const berRatings = pgTable(
  'ber_ratings',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    berNumber: varchar('ber_number', { length: 20 }),
    issueDate: date('issue_date'),
    expiryDate: date('expiry_date'),
    rating: varchar('rating', { length: 5 }).notNull(),
    energyValue: numeric('energy_value', { precision: 8, scale: 2 }),
    co2Rating: numeric('co2_rating', { precision: 8, scale: 2 }),
    dwellingType: varchar('dwelling_type', { length: 100 }),
    yearBuilt: integer('year_built'),
    floorArea: numeric('floor_area', { precision: 8, scale: 2 }),
    heatingMain: varchar('heating_main', { length: 100 }),
    wallType: varchar('wall_type', { length: 100 }),
    countyName: varchar('county_name', { length: 100 }),
    eircodeRoutingKey: varchar('eircode_routing_key', { length: 3 }),
    townId: integer('town_id').references(() => towns.id),
    rawRow: jsonb('raw_row').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('ber_ber_number_idx').on(table.berNumber),
    index('ber_rating_idx').on(table.rating),
    index('ber_county_idx').on(table.countyName),
    index('ber_eircode_idx').on(table.eircodeRoutingKey),
    index('ber_town_id_idx').on(table.townId),
    index('ber_year_built_idx').on(table.yearBuilt),
  ],
);

// -----------------------------------------------------------------------------
// planning_apps — local authority planning applications
// -----------------------------------------------------------------------------

export const planningApps = pgTable(
  'planning_apps',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    sourceCouncil: varchar('source_council', { length: 100 }).notNull(),
    referenceNumber: varchar('reference_number', { length: 50 }).notNull(),
    receivedDate: date('received_date'),
    decisionDate: date('decision_date'),
    decision: planningDecisionEnum('decision').notNull().default('pending'),
    description: text('description'),
    addressRaw: text('address_raw'),
    location: point('location'),
    townId: integer('town_id').references(() => towns.id),
    residentialUnits: integer('residential_units'),
    commercialFloorArea: numeric('commercial_floor_area', { precision: 10, scale: 2 }),
    developmentType: varchar('development_type', { length: 100 }),
    sourceUrl: text('source_url'),
    rawData: jsonb('raw_data').notNull(),
    classifiedAt: timestamp('classified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('planning_apps_council_ref_idx').on(table.sourceCouncil, table.referenceNumber),
    index('planning_apps_decision_date_idx').on(table.decisionDate),
    index('planning_apps_town_id_idx').on(table.townId),
    index('planning_apps_decision_idx').on(table.decision),
    // Spatial index: CREATE INDEX planning_apps_location_idx ON planning_apps USING GIST (location);
  ],
);

// -----------------------------------------------------------------------------
// grant_schemes — all applicable grant schemes (config table)
// -----------------------------------------------------------------------------

export const grantSchemes = pgTable(
  'grant_schemes',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    code: varchar('code', { length: 50 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    provider: varchar('provider', { length: 100 }).notNull(),
    category: varchar('category', { length: 50 }).notNull(),
    maxAmount: numeric('max_amount', { precision: 10, scale: 2 }),
    description: text('description').notNull(),
    eligibilityRules: jsonb('eligibility_rules').notNull().$type<{
      buyerType?: string[];
      propertyType?: string[];
      vacancyMinYears?: number;
      maxBerRating?: string;
      minBuildYear?: number;
      maxBuildYear?: number;
      maxPropertyValue?: number;
      stackingExclusions?: string[];
    }>(),
    sourceUrl: text('source_url'),
    isActive: boolean('is_active').notNull().default(true),
    effectiveFrom: date('effective_from'),
    effectiveTo: date('effective_to'),
    lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('grant_schemes_code_idx').on(table.code),
    index('grant_schemes_provider_idx').on(table.provider),
    index('grant_schemes_active_idx').on(table.isActive),
  ],
);

// -----------------------------------------------------------------------------
// subscribers — email and paid subscribers
// -----------------------------------------------------------------------------

export const subscribers = pgTable(
  'subscribers',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    email: varchar('email', { length: 255 }).notNull(),
    tier: subscriberTierEnum('tier').notNull().default('free'),
    status: subscriberStatusEnum('status').notNull().default('active'),
    name: varchar('name', { length: 200 }),
    persona: varchar('persona', { length: 50 }),
    intent: varchar('intent', { length: 50 }),
    watchedTownIds: jsonb('watched_town_ids').$type<number[]>(),
    preferences: jsonb('preferences').$type<{
      sendDay?: 'sunday' | 'monday';
      digestFrequency?: 'weekly' | 'monthly';
      includeCharts?: boolean;
      personaOverrides?: Record<string, unknown>;
    }>(),
    substackId: varchar('substack_id', { length: 100 }),
    clerkUserId: varchar('clerk_user_id', { length: 100 }),
    stripeCustomerId: varchar('stripe_customer_id', { length: 100 }),
    annualBilling: boolean('annual_billing').default(false),
    isFoundingMember: boolean('is_founding_member').default(false),
    subscribedAt: timestamp('subscribed_at', { withTimezone: true }).notNull().defaultNow(),
    upgradedAt: timestamp('upgraded_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('subscribers_email_idx').on(table.email),
    index('subscribers_tier_idx').on(table.tier),
    index('subscribers_status_idx').on(table.status),
    index('subscribers_clerk_idx').on(table.clerkUserId),
  ],
);

// -----------------------------------------------------------------------------
// events — internal event log for agent orchestration
// -----------------------------------------------------------------------------

export const events = pgTable(
  'events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    source: varchar('source', { length: 100 }).notNull(),
    payload: jsonb('payload').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    error: text('error'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('events_type_idx').on(table.eventType),
    index('events_occurred_at_idx').on(table.occurredAt),
    index('events_unprocessed_idx').on(table.processedAt),
  ],
);

// -----------------------------------------------------------------------------
// cso_stats — CSO StatBank reference data
// -----------------------------------------------------------------------------

export const csoStats = pgTable(
  'cso_stats',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    seriesCode: varchar('series_code', { length: 100 }).notNull(),
    period: varchar('period', { length: 20 }).notNull(),
    region: varchar('region', { length: 100 }),
    value: numeric('value', { precision: 14, scale: 4 }),
    unit: varchar('unit', { length: 50 }),
    metadata: jsonb('metadata'),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('cso_stats_series_period_region_idx').on(
      table.seriesCode,
      table.period,
      table.region,
    ),
    index('cso_stats_series_idx').on(table.seriesCode),
  ],
);

// -----------------------------------------------------------------------------
// rtb_rents — RTB/ESRI Rent Index quarterly data
// -----------------------------------------------------------------------------

export const rtbRents = pgTable(
  'rtb_rents',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    quarter: varchar('quarter', { length: 7 }).notNull(),
    county: varchar('county', { length: 100 }).notNull(),
    propertyType: varchar('property_type', { length: 50 }),
    bedrooms: integer('bedrooms'),
    isNewTenancy: boolean('is_new_tenancy'),
    standardisedMonthlyRent: numeric('standardised_monthly_rent', { precision: 8, scale: 2 }),
    sampleSize: integer('sample_size'),
    rawData: jsonb('raw_data'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('rtb_rents_quarter_county_idx').on(table.quarter, table.county),
    index('rtb_rents_county_idx').on(table.county),
  ],
);

// -----------------------------------------------------------------------------
// Materialised view: town_metrics
//
// Refreshed daily via /api/cron/metrics-refresh.
// Created via raw SQL in migration — Drizzle doesn't natively support MVs.
// See packages/db/migrations/0001_town_metrics.sql for the definition.
// -----------------------------------------------------------------------------

// Type definition for queries against the town_metrics materialised view.
export interface TownMetric {
  townId: number;
  asOfDate: string;
  salesCount90d: number;
  medianPrice90d: number | null;
  medianPrice12m: number | null;
  yoyPriceChange: number | null;
  newBuildShare: number | null;
  ftbShare: number | null;
  daysOnMarketEstimate: number | null;
}

// -----------------------------------------------------------------------------
// api_keys — B2B API key management with prepaid credits
// -----------------------------------------------------------------------------

export const apiKeys = pgTable(
  'api_keys',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    subscriberId: integer('subscriber_id'),
    keyHash: varchar('key_hash', { length: 64 }).notNull(),
    keyPrefix: varchar('key_prefix', { length: 16 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    creditsRemaining: integer('credits_remaining').notNull().default(0),
    creditsPurchased: integer('credits_purchased').notNull().default(0),
    tier: varchar('tier', { length: 50 }).notNull().default('standard'),
    rateLimitPerMinute: integer('rate_limit_per_minute').notNull().default(60),
    isActive: boolean('is_active').notNull().default(true),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('api_keys_hash_idx').on(table.keyHash),
    index('api_keys_subscriber_idx').on(table.subscriberId),
    index('api_keys_active_idx').on(table.isActive),
  ],
);

// -----------------------------------------------------------------------------
// api_usage — per-request usage log for billing and analytics
// -----------------------------------------------------------------------------

export const apiUsage = pgTable(
  'api_usage',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    apiKeyId: integer('api_key_id').notNull(),
    endpoint: varchar('endpoint', { length: 200 }).notNull(),
    requestParams: jsonb('request_params'),
    creditsUsed: integer('credits_used').notNull().default(1),
    responseStatus: integer('response_status').notNull(),
    latencyMs: integer('latency_ms'),
    ipAddress: varchar('ip_address', { length: 45 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('api_usage_key_idx').on(table.apiKeyId),
    index('api_usage_created_idx').on(table.createdAt),
    index('api_usage_key_created_idx').on(table.apiKeyId, table.createdAt),
  ],
);

// -----------------------------------------------------------------------------
// Schema exports for migrations and queries
// -----------------------------------------------------------------------------

export const schema = {
  towns,
  sales,
  berRatings,
  planningApps,
  grantSchemes,
  subscribers,
  events,
  csoStats,
  rtbRents,
  apiKeys,
  apiUsage,
};

export type Town = typeof towns.$inferSelect;
export type NewTown = typeof towns.$inferInsert;
export type Sale = typeof sales.$inferSelect;
export type NewSale = typeof sales.$inferInsert;
export type BerRating = typeof berRatings.$inferSelect;
export type NewBerRating = typeof berRatings.$inferInsert;
export type PlanningApp = typeof planningApps.$inferSelect;
export type NewPlanningApp = typeof planningApps.$inferInsert;
export type GrantScheme = typeof grantSchemes.$inferSelect;
export type Subscriber = typeof subscribers.$inferSelect;
export type Event = typeof events.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type ApiUsage = typeof apiUsage.$inferSelect;
