CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"subscriber_id" integer,
	"key_hash" varchar(64) NOT NULL,
	"key_prefix" varchar(16) NOT NULL,
	"name" varchar(200) NOT NULL,
	"credits_remaining" integer DEFAULT 0 NOT NULL,
	"credits_purchased" integer DEFAULT 0 NOT NULL,
	"tier" varchar(50) DEFAULT 'standard' NOT NULL,
	"rate_limit_per_minute" integer DEFAULT 60 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_usage" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"api_key_id" integer NOT NULL,
	"endpoint" varchar(200) NOT NULL,
	"request_params" jsonb,
	"credits_used" integer DEFAULT 1 NOT NULL,
	"response_status" integer NOT NULL,
	"latency_ms" integer,
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_hash_idx" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_subscriber_idx" ON "api_keys" USING btree ("subscriber_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_active_idx" ON "api_keys" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_usage_key_idx" ON "api_usage" USING btree ("api_key_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_usage_created_idx" ON "api_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_usage_key_created_idx" ON "api_usage" USING btree ("api_key_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ber_ber_number_idx" ON "ber_ratings" USING btree ("ber_number");