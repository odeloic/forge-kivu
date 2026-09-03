ALTER TABLE "boq_items" ADD COLUMN "supplier_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "boq_items" ADD COLUMN "category_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "boq_items" ADD COLUMN "category_root_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "boq_items" ADD COLUMN "options" jsonb DEFAULT '[]'::jsonb NOT NULL;