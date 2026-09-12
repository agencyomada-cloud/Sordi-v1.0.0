CREATE TYPE "public"."device_status" AS ENUM('trial', 'active', 'expired');--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"machine_id" text NOT NULL,
	"device_fingerprint" text NOT NULL,
	"app_version" text NOT NULL,
	"invoices_count" integer DEFAULT 0 NOT NULL,
	"clients_count" integer DEFAULT 0 NOT NULL,
	"expenses_count" integer DEFAULT 0 NOT NULL,
	"status" "device_status" DEFAULT 'trial' NOT NULL,
	"valid_until" timestamp with time zone,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "devices_machine_id_idx" ON "devices" USING btree ("machine_id");--> statement-breakpoint
CREATE INDEX "devices_fingerprint_idx" ON "devices" USING btree ("device_fingerprint");