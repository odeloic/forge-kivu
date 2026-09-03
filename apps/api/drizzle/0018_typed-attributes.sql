CREATE TYPE "public"."attribute_value_type" AS ENUM('text', 'number', 'boolean', 'range', 'color');--> statement-breakpoint
ALTER TABLE "product_option_values" ADD COLUMN "hex" text;--> statement-breakpoint
ALTER TABLE "product_options" ADD COLUMN "type" "attribute_value_type" DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_specs" ADD COLUMN "hex" text;--> statement-breakpoint
ALTER TABLE "product_specs" ADD COLUMN "value_number" numeric(14, 4);--> statement-breakpoint
ALTER TABLE "product_specs" ADD COLUMN "value_min" numeric(14, 4);--> statement-breakpoint
ALTER TABLE "product_specs" ADD COLUMN "value_max" numeric(14, 4);--> statement-breakpoint
ALTER TABLE "product_specs" ADD COLUMN "value_bool" boolean;--> statement-breakpoint
ALTER TABLE "spec_attributes" ADD COLUMN "type" "attribute_value_type" DEFAULT 'text' NOT NULL;