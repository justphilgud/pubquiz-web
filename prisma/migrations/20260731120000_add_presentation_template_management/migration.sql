CREATE TABLE "pubquiz"."presentation_templates" (
  "presentation_template_id" VARCHAR(64) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "beschreibung" VARCHAR(1000),
  "status" VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  "ist_systemtemplate" BOOLEAN NOT NULL DEFAULT false,
  "contract_version" INTEGER NOT NULL DEFAULT 1,
  "theme_config_json" JSONB NOT NULL,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "source_template_id" VARCHAR(64),
  "created_by_user_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "presentation_templates_pkey" PRIMARY KEY ("presentation_template_id"),
  CONSTRAINT "presentation_templates_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "pubquiz"."users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "presentation_templates_status_check"
    CHECK ("status" IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
  CONSTRAINT "presentation_templates_contract_version_check"
    CHECK ("contract_version" = 1),
  CONSTRAINT "presentation_templates_system_write_check"
    CHECK ("ist_systemtemplate" = false)
);

CREATE INDEX "idx_presentation_templates_status_updated"
  ON "pubquiz"."presentation_templates"("status", "updated_at");

CREATE INDEX "idx_presentation_templates_creator"
  ON "pubquiz"."presentation_templates"("created_by_user_id");
