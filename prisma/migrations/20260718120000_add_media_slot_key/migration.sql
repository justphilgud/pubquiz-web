ALTER TABLE "pubquiz"."medien"
ADD COLUMN "slot_key" VARCHAR(80);

ALTER TABLE "pubquiz"."medien"
ADD CONSTRAINT "chk_medien_exactly_one_owner"
CHECK (num_nonnulls("fragen_id", "antwort_id", "antwortfeld_id") = 1)
NOT VALID;

CREATE INDEX "idx_medien_fragen_slot"
ON "pubquiz"."medien"("fragen_id", "slot_key");

CREATE INDEX "idx_medien_antwort_slot"
ON "pubquiz"."medien"("antwort_id", "slot_key");

CREATE INDEX "idx_medien_antwortfeld_slot"
ON "pubquiz"."medien"("antwortfeld_id", "slot_key");
