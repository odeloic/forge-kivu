CREATE TABLE "supplier_gallery_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"caption" text,
	"alt_text" text NOT NULL,
	"link_url" text,
	"display_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_gallery_items_supplier_media_unique" UNIQUE("supplier_id","media_id")
);
--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "website_url" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "featured_media_id" uuid;--> statement-breakpoint
ALTER TABLE "supplier_gallery_items" ADD CONSTRAINT "supplier_gallery_items_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_gallery_items" ADD CONSTRAINT "supplier_gallery_items_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "supplier_gallery_items_supplier_order_idx" ON "supplier_gallery_items" USING btree ("supplier_id","display_order");--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_featured_media_id_media_id_fk" FOREIGN KEY ("featured_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;