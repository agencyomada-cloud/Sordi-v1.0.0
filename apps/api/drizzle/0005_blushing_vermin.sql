CREATE TYPE "public"."license_contact_status" AS ENUM('a_contacter', 'en_cours', 'converti', 'non_interesse');--> statement-breakpoint
ALTER TABLE "licenses" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "licenses" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "licenses" ADD COLUMN "contact_status" "license_contact_status" DEFAULT 'a_contacter' NOT NULL;