CREATE TYPE "public"."license_type" AS ENUM('yearly', 'lifetime');--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "customer_name" text;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "phone_number" text;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "os_platform" text;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "license_type" "license_type";--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "downloaded_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "last_active_at" timestamp with time zone;