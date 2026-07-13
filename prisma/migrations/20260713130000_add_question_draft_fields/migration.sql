-- Preserve the completion state of existing questions while allowing new drafts.
ALTER TABLE "pubquiz"."fragen"
ADD COLUMN "ist_unfertig" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "moderationsnotizen" TEXT,
ADD COLUMN "gueltig_bis" DATE;

-- Store resolution information on the concrete classic answer.
ALTER TABLE "pubquiz"."antworten"
ADD COLUMN "zusatzinformation" TEXT;

-- Store resolution information on the concrete labeled-field solution.
ALTER TABLE "pubquiz"."frage_antwortfeld_loesungen"
ADD COLUMN "zusatzinformation" TEXT;
