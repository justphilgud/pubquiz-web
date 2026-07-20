CREATE TYPE "pubquiz"."RoleAssignmentRole" AS ENUM ('ADMIN', 'EDITOR', 'EVENT_MANAGER');
CREATE TYPE "pubquiz"."RoleScopeType" AS ENUM ('GLOBAL', 'EVENT_SERIES');

CREATE TABLE "pubquiz"."benutzer_rollenzuweisungen" (
    "rollenzuweisung_id" SERIAL NOT NULL,
    "benutzer_id" INTEGER NOT NULL,
    "rolle" "pubquiz"."RoleAssignmentRole" NOT NULL,
    "scope_typ" "pubquiz"."RoleScopeType" NOT NULL,
    "eventreihe_id" INTEGER,
    "zugewiesen_von_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "benutzer_rollenzuweisungen_pkey" PRIMARY KEY ("rollenzuweisung_id"),
    CONSTRAINT "ck_rollenzuweisung_scope_referenz" CHECK (
      ("scope_typ" = 'GLOBAL' AND "eventreihe_id" IS NULL) OR
      ("scope_typ" = 'EVENT_SERIES' AND "eventreihe_id" IS NOT NULL)
    ),
    CONSTRAINT "ck_rollenzuweisung_rolle_scope" CHECK (
      ("scope_typ" = 'GLOBAL' AND "rolle" IN ('ADMIN', 'EDITOR')) OR
      ("scope_typ" = 'EVENT_SERIES' AND "rolle" IN ('EDITOR', 'EVENT_MANAGER'))
    ),
    CONSTRAINT "benutzer_rollenzuweisungen_benutzer_id_fkey"
      FOREIGN KEY ("benutzer_id") REFERENCES "pubquiz"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "benutzer_rollenzuweisungen_eventreihe_id_fkey"
      FOREIGN KEY ("eventreihe_id") REFERENCES "pubquiz"."eventreihen"("eventreihe_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "benutzer_rollenzuweisungen_zugewiesen_von_user_id_fkey"
      FOREIGN KEY ("zugewiesen_von_user_id") REFERENCES "pubquiz"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "uq_rollenzuweisung_global"
ON "pubquiz"."benutzer_rollenzuweisungen"("benutzer_id", "rolle")
WHERE "scope_typ" = 'GLOBAL';

-- Variante A: EDITOR und EVENT_MANAGER sind je Benutzer/Eventreihe gegenseitig exklusiv.
CREATE UNIQUE INDEX "uq_rollenzuweisung_eventreihe"
ON "pubquiz"."benutzer_rollenzuweisungen"("benutzer_id", "eventreihe_id")
WHERE "scope_typ" = 'EVENT_SERIES';

CREATE INDEX "idx_rollenzuweisungen_benutzer"
ON "pubquiz"."benutzer_rollenzuweisungen"("benutzer_id");

CREATE INDEX "idx_rollenzuweisungen_eventreihe"
ON "pubquiz"."benutzer_rollenzuweisungen"("eventreihe_id");

INSERT INTO "pubquiz"."benutzer_rollenzuweisungen" (
  "benutzer_id", "rolle", "scope_typ", "eventreihe_id",
  "zugewiesen_von_user_id", "created_at", "updated_at"
)
SELECT
  "id",
  CASE "role"::text
    WHEN 'ADMIN' THEN 'ADMIN'::"pubquiz"."RoleAssignmentRole"
    WHEN 'EDITOR' THEN 'EDITOR'::"pubquiz"."RoleAssignmentRole"
  END,
  'GLOBAL'::"pubquiz"."RoleScopeType",
  NULL,
  NULL,
  "created_at",
  "updated_at"
FROM "pubquiz"."users"
WHERE "role"::text IN ('ADMIN', 'EDITOR')
ON CONFLICT DO NOTHING;

INSERT INTO "pubquiz"."benutzer_rollenzuweisungen" (
  "benutzer_id", "rolle", "scope_typ", "eventreihe_id",
  "zugewiesen_von_user_id", "created_at", "updated_at"
)
SELECT
  "benutzer_id",
  CASE "rolle"::text
    WHEN 'EVENT_EDITOR' THEN 'EDITOR'::"pubquiz"."RoleAssignmentRole"
    WHEN 'EVENT_MANAGER' THEN 'EVENT_MANAGER'::"pubquiz"."RoleAssignmentRole"
  END,
  'EVENT_SERIES'::"pubquiz"."RoleScopeType",
  "eventreihe_id",
  "zugewiesen_von_user_id",
  "created_at",
  "updated_at"
FROM "pubquiz"."eventreihe_benutzerrollen"
WHERE "rolle"::text IN ('EVENT_EDITOR', 'EVENT_MANAGER')
ON CONFLICT DO NOTHING;
