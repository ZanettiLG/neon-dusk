-- ND-015: Saideira Hub — Legends table
-- Legends are PERMANENT records. They survive round resets (no FK to characters):
-- character_name/drink_name are denormalized by design, an immutable record of
-- a feat. Seed rows are canonical Saideira lore for the MVP menu.
CREATE TABLE "legends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_name" text NOT NULL,
	"drink_name" text NOT NULL,
	"achieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"crew_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "legends" ("character_name", "drink_name", "achieved_at", "crew_name") VALUES
	('Razorback', 'Cromo no Gelo', '2085-03-15 02:47:00+00', NULL),
	('Ghostwire', 'Flatline Azul', '2085-06-02 23:11:00+00', NULL),
	('Dama de Paus', 'Sangue e Circuito', '2086-01-20 05:33:00+00', 'Os Sem Rosto'),
	('Zé do Gatilho', 'O Último Gole', '2086-09-08 18:59:00+00', NULL),
	('Mão Fria', 'Nevasca Elétrica', '2087-04-04 14:22:00+00', 'Filhos do Fluxo');

-- ============================================================================
-- DOWN (manual rollback — drizzle migrations are up-only, run in order)
-- ============================================================================
-- DROP TABLE "legends";
