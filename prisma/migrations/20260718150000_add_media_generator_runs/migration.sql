CREATE TABLE "pubquiz"."medien_generator_laefe" (
    "generator_lauf_id" SERIAL NOT NULL,
    "fragen_id" INTEGER NOT NULL,
    "generator_id" VARCHAR(80) NOT NULL,
    "generator_version" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "input_fingerprint" VARCHAR(64),
    "error_code" VARCHAR(80),
    "error_message" TEXT,
    "parameters_json" JSONB,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "medien_generator_laefe_pkey" PRIMARY KEY ("generator_lauf_id"),
    CONSTRAINT "chk_generator_lauf_status" CHECK ("status" IN ('PENDING','PROCESSING','SUCCEEDED','FAILED','STALE','CANCELLED')),
    CONSTRAINT "chk_generator_version_positive" CHECK ("generator_version" > 0)
);

CREATE TABLE "pubquiz"."medien_generator_lauf_medien" (
    "generator_lauf_medium_id" SERIAL NOT NULL,
    "generator_lauf_id" INTEGER NOT NULL,
    "medien_id" INTEGER NOT NULL,
    "rolle" VARCHAR(10) NOT NULL,
    "slot_key" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "medien_generator_lauf_medien_pkey" PRIMARY KEY ("generator_lauf_medium_id"),
    CONSTRAINT "chk_generator_medium_rolle" CHECK ("rolle" IN ('INPUT','OUTPUT'))
);

CREATE INDEX "idx_generator_laefe_frage_generator" ON "pubquiz"."medien_generator_laefe"("fragen_id", "generator_id", "created_at");
CREATE INDEX "idx_generator_laefe_fingerprint" ON "pubquiz"."medien_generator_laefe"("fragen_id", "generator_id", "input_fingerprint");
CREATE INDEX "idx_generator_laefe_status" ON "pubquiz"."medien_generator_laefe"("status", "updated_at");
CREATE UNIQUE INDEX "uq_generator_lauf_active" ON "pubquiz"."medien_generator_laefe"("fragen_id", "generator_id") WHERE "status" IN ('PENDING','PROCESSING');
CREATE UNIQUE INDEX "uq_generator_lauf_medium_rolle" ON "pubquiz"."medien_generator_lauf_medien"("generator_lauf_id", "medien_id", "rolle");
CREATE INDEX "idx_generator_lauf_medien_medium" ON "pubquiz"."medien_generator_lauf_medien"("medien_id", "rolle");
CREATE INDEX "idx_generator_lauf_medien_lauf" ON "pubquiz"."medien_generator_lauf_medien"("generator_lauf_id", "rolle");

ALTER TABLE "pubquiz"."medien_generator_laefe" ADD CONSTRAINT "fk_generator_laefe_fragen" FOREIGN KEY ("fragen_id") REFERENCES "pubquiz"."fragen"("fragen_id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "pubquiz"."medien_generator_lauf_medien" ADD CONSTRAINT "fk_generator_lauf_medien_lauf" FOREIGN KEY ("generator_lauf_id") REFERENCES "pubquiz"."medien_generator_laefe"("generator_lauf_id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "pubquiz"."medien_generator_lauf_medien" ADD CONSTRAINT "fk_generator_lauf_medien_medium" FOREIGN KEY ("medien_id") REFERENCES "pubquiz"."medien"("medien_id") ON DELETE CASCADE ON UPDATE NO ACTION;
