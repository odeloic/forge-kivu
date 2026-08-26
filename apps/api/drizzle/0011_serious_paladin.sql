CREATE TYPE "public"."session_audience" AS ENUM('workshop', 'admin');--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "audience" "session_audience" DEFAULT 'workshop' NOT NULL;