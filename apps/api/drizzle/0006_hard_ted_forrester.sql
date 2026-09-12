CREATE TYPE "public"."license_plan_type" AS ENUM('trial', 'annual', 'lifetime');--> statement-breakpoint
ALTER TABLE "licenses" ADD COLUMN "plan_type" "license_plan_type" DEFAULT 'trial' NOT NULL;--> statement-breakpoint
-- Backfill: every row already marked "converti" in the sales pipeline is,
-- by definition, a paid customer, not a trial — even though this column
-- didn't exist when they converted. Anything not already converted keeps
-- the "trial" default, which is correct for every row created via the
-- self-service trial flow and conservative for anything else.
UPDATE "licenses" SET "plan_type" = 'annual' WHERE "contact_status" = 'converti';