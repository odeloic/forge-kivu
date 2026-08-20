CREATE TYPE "public"."project_phase" AS ENUM('foundation', 'structure', 'roofing', 'finishing');--> statement-breakpoint
CREATE TYPE "public"."project_type" AS ENUM('residential_house', 'apartment_building', 'commercial', 'industrial', 'institutional', 'other');--> statement-breakpoint
CREATE TYPE "public"."work_type" AS ENUM('new_construction', 'renovation', 'extension', 'repair');--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"project_type" "project_type" NOT NULL,
	"work_type" "work_type",
	"phase" "project_phase",
	"client_name" text,
	"location" text,
	"description" text,
	"start_date" date,
	"end_date" date,
	"budget" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;