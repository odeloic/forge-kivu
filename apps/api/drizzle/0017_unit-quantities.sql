ALTER TABLE "boq_items" ALTER COLUMN "quantity" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "product_variants" ALTER COLUMN "unit_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "project_items" ALTER COLUMN "quantity" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "boq_items" ADD COLUMN "unit" text DEFAULT '' NOT NULL;