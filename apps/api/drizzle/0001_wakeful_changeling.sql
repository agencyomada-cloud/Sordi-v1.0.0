CREATE TYPE "public"."license_status" AS ENUM('active', 'expired', 'revoked');--> statement-breakpoint
CREATE TABLE "license_activations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"license_id" uuid NOT NULL,
	"device_fingerprint" text NOT NULL,
	"activated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_verified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "licenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_reference_id" text NOT NULL,
	"license_key" text NOT NULL,
	"organization_name" text NOT NULL,
	"activated_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"max_devices" integer DEFAULT 2 NOT NULL,
	"status" "license_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "license_activations" ADD CONSTRAINT "license_activations_license_id_licenses_id_fk" FOREIGN KEY ("license_id") REFERENCES "public"."licenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "license_activations_license_device_idx" ON "license_activations" USING btree ("license_id","device_fingerprint");--> statement-breakpoint
CREATE INDEX "license_activations_license_idx" ON "license_activations" USING btree ("license_id");--> statement-breakpoint
CREATE UNIQUE INDEX "licenses_client_reference_id_idx" ON "licenses" USING btree ("client_reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX "licenses_license_key_idx" ON "licenses" USING btree ("license_key");