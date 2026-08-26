CREATE TABLE "pubquiz"."live_text_response_publications" (
  "live_text_response_publication_id" SERIAL NOT NULL,
  "team_answer_submission_id" INTEGER NOT NULL,
  "is_visible" BOOLEAN NOT NULL DEFAULT false,
  "moderated_by_user_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "live_text_response_publications_pkey" PRIMARY KEY ("live_text_response_publication_id"),
  CONSTRAINT "live_text_response_publications_submission_fkey" FOREIGN KEY ("team_answer_submission_id") REFERENCES "pubquiz"."team_answer_submissions"("team_answer_submission_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "live_text_response_publications_moderator_fkey" FOREIGN KEY ("moderated_by_user_id") REFERENCES "pubquiz"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "live_text_response_publications_submission_key" ON "pubquiz"."live_text_response_publications"("team_answer_submission_id");
CREATE INDEX "idx_live_text_publications_visible" ON "pubquiz"."live_text_response_publications"("is_visible", "updated_at");

CREATE TABLE "pubquiz"."public_text_replacement_rules" (
  "public_text_replacement_rule_id" SERIAL NOT NULL,
  "search_term" VARCHAR(120) NOT NULL,
  "replacement" VARCHAR(120) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by_user_id" INTEGER,
  "updated_by_user_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "public_text_replacement_rules_pkey" PRIMARY KEY ("public_text_replacement_rule_id"),
  CONSTRAINT "public_text_replacement_rules_creator_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "pubquiz"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "public_text_replacement_rules_updater_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "pubquiz"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "public_text_replacement_rules_search_term_key" ON "pubquiz"."public_text_replacement_rules"("search_term");
CREATE INDEX "idx_public_text_rules_active" ON "pubquiz"."public_text_replacement_rules"("is_active", "search_term");

INSERT INTO "pubquiz"."public_text_replacement_rules" ("search_term", "replacement")
VALUES ('Penis', 'Sonnenblume');
