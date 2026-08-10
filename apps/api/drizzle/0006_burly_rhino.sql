CREATE TABLE "platform_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"currency" text NOT NULL,
	"locale" text NOT NULL,
	"language" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_settings_singleton" CHECK ("platform_settings"."id" = 1)
);
