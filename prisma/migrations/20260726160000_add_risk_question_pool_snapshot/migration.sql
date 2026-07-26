ALTER TABLE "pubquiz"."quiz_fragen"
  ADD COLUMN "risiko_pool_teamanzahl" INTEGER,
  ADD COLUMN "risiko_pool_fixiert_am" TIMESTAMP(3);

COMMENT ON COLUMN "pubquiz"."quiz_fragen"."risiko_pool_teamanzahl" IS
  'Frozen number of eligible quiz team sessions used as the risk-question point pool.';

COMMENT ON COLUMN "pubquiz"."quiz_fragen"."risiko_pool_fixiert_am" IS
  'Timestamp at which the risk-question team pool was first frozen.';
