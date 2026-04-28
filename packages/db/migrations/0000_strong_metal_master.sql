CREATE TYPE "public"."buyer_type" AS ENUM('first_time_buyer', 'former_owner_occupier', 'non_occupier', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."planning_decision" AS ENUM('granted', 'refused', 'withdrawn', 'pending', 'invalid');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('detached', 'semi_detached', 'terraced', 'apartment', 'duplex', 'bungalow', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."subscriber_status" AS ENUM('active', 'paused', 'cancelled', 'churned');--> statement-breakpoint
CREATE TYPE "public"."subscriber_tier" AS ENUM('free', 'insider', 'professional', 'enterprise');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ber_ratings" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ber_number" varchar(20),
	"issue_date" date,
	"expiry_date" date,
	"rating" varchar(5) NOT NULL,
	"energy_value" numeric(8, 2),
	"co2_rating" numeric(8, 2),
	"dwelling_type" varchar(100),
	"year_built" integer,
	"floor_area" numeric(8, 2),
	"heating_main" varchar(100),
	"wall_type" varchar(100),
	"county_name" varchar(100),
	"eircode_routing_key" varchar(3),
	"town_id" integer,
	"raw_row" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cso_stats" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"series_code" varchar(100) NOT NULL,
	"period" varchar(20) NOT NULL,
	"region" varchar(100),
	"value" numeric(14, 4),
	"unit" varchar(50),
	"metadata" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"source" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "grant_schemes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(200) NOT NULL,
	"provider" varchar(100) NOT NULL,
	"category" varchar(50) NOT NULL,
	"max_amount" numeric(10, 2),
	"description" text NOT NULL,
	"eligibility_rules" jsonb NOT NULL,
	"source_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"effective_from" date,
	"effective_to" date,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "planning_apps" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source_council" varchar(100) NOT NULL,
	"reference_number" varchar(50) NOT NULL,
	"received_date" date,
	"decision_date" date,
	"decision" "planning_decision" DEFAULT 'pending' NOT NULL,
	"description" text,
	"address_raw" text,
	"location" geometry(Point, 4326),
	"town_id" integer,
	"residential_units" integer,
	"commercial_floor_area" numeric(10, 2),
	"development_type" varchar(100),
	"source_url" text,
	"raw_data" jsonb NOT NULL,
	"classified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rtb_rents" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"quarter" varchar(7) NOT NULL,
	"county" varchar(100) NOT NULL,
	"property_type" varchar(50),
	"bedrooms" integer,
	"is_new_tenancy" boolean,
	"standardised_monthly_rent" numeric(8, 2),
	"sample_size" integer,
	"raw_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sales" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ppr_uid" varchar(100) NOT NULL,
	"sale_date" date NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"address_raw" text NOT NULL,
	"address_normalised" text,
	"town_id" integer,
	"county" varchar(100) NOT NULL,
	"eircode" varchar(8),
	"location" geometry(Point, 4326),
	"is_new" boolean DEFAULT false NOT NULL,
	"property_type" "property_type",
	"description" text,
	"vat_exclusive" boolean,
	"raw_row" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscribers" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"tier" "subscriber_tier" DEFAULT 'free' NOT NULL,
	"status" "subscriber_status" DEFAULT 'active' NOT NULL,
	"name" varchar(200),
	"persona" varchar(50),
	"intent" varchar(50),
	"watched_town_ids" jsonb,
	"preferences" jsonb,
	"substack_id" varchar(100),
	"clerk_user_id" varchar(100),
	"stripe_customer_id" varchar(100),
	"annual_billing" boolean DEFAULT false,
	"is_founding_member" boolean DEFAULT false,
	"subscribed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"upgraded_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"last_active_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "towns" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(200) NOT NULL,
	"county" varchar(100) NOT NULL,
	"centroid" geometry(Point, 4326) NOT NULL,
	"radius_meters" integer DEFAULT 3000 NOT NULL,
	"population_2022" integer,
	"eircode_routing_key" varchar(3),
	"coverage_started_at" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ber_ratings" ADD CONSTRAINT "ber_ratings_town_id_towns_id_fk" FOREIGN KEY ("town_id") REFERENCES "public"."towns"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "planning_apps" ADD CONSTRAINT "planning_apps_town_id_towns_id_fk" FOREIGN KEY ("town_id") REFERENCES "public"."towns"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sales" ADD CONSTRAINT "sales_town_id_towns_id_fk" FOREIGN KEY ("town_id") REFERENCES "public"."towns"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ber_rating_idx" ON "ber_ratings" USING btree ("rating");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ber_county_idx" ON "ber_ratings" USING btree ("county_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ber_eircode_idx" ON "ber_ratings" USING btree ("eircode_routing_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ber_town_id_idx" ON "ber_ratings" USING btree ("town_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ber_year_built_idx" ON "ber_ratings" USING btree ("year_built");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cso_stats_series_period_region_idx" ON "cso_stats" USING btree ("series_code","period","region");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cso_stats_series_idx" ON "cso_stats" USING btree ("series_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_type_idx" ON "events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_occurred_at_idx" ON "events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_unprocessed_idx" ON "events" USING btree ("processed_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "grant_schemes_code_idx" ON "grant_schemes" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "grant_schemes_provider_idx" ON "grant_schemes" USING btree ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "grant_schemes_active_idx" ON "grant_schemes" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "planning_apps_council_ref_idx" ON "planning_apps" USING btree ("source_council","reference_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "planning_apps_decision_date_idx" ON "planning_apps" USING btree ("decision_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "planning_apps_town_id_idx" ON "planning_apps" USING btree ("town_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "planning_apps_decision_idx" ON "planning_apps" USING btree ("decision");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rtb_rents_quarter_county_idx" ON "rtb_rents" USING btree ("quarter","county");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rtb_rents_county_idx" ON "rtb_rents" USING btree ("county");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sales_ppr_uid_idx" ON "sales" USING btree ("ppr_uid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_sale_date_idx" ON "sales" USING btree ("sale_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_town_id_idx" ON "sales" USING btree ("town_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_county_idx" ON "sales" USING btree ("county");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_eircode_idx" ON "sales" USING btree ("eircode");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subscribers_email_idx" ON "subscribers" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscribers_tier_idx" ON "subscribers" USING btree ("tier");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscribers_status_idx" ON "subscribers" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscribers_clerk_idx" ON "subscribers" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "towns_slug_idx" ON "towns" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "towns_county_idx" ON "towns" USING btree ("county");