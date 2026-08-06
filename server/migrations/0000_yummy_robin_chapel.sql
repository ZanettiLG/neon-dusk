CREATE TABLE "health" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"checked_at" timestamp DEFAULT now() NOT NULL,
	"healthy" boolean DEFAULT true NOT NULL
);
