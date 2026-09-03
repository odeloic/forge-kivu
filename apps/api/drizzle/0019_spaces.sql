CREATE TABLE "project_spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"space_id" uuid,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "project_items" DROP CONSTRAINT "project_items_project_id_variant_id_pk";--> statement-breakpoint
ALTER TABLE "boq_items" ADD COLUMN "space_id" uuid;--> statement-breakpoint
ALTER TABLE "boq_items" ADD COLUMN "space_name" text;--> statement-breakpoint
ALTER TABLE "project_items" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "project_items" ADD COLUMN "space_id" uuid;--> statement-breakpoint
ALTER TABLE "project_spaces" ADD CONSTRAINT "project_spaces_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_spaces" ADD CONSTRAINT "project_spaces_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_spaces_project_id_name_lower_idx" ON "project_spaces" USING btree ("project_id",lower("name"));--> statement-breakpoint
ALTER TABLE "project_items" ADD CONSTRAINT "project_items_space_id_project_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."project_spaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_items" ADD CONSTRAINT "project_items_project_id_variant_id_space_id_unique" UNIQUE NULLS NOT DISTINCT("project_id","variant_id","space_id");