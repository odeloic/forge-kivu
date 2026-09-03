CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "units_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "unit_id" uuid;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;