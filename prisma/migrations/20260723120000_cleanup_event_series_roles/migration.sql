ALTER TYPE "pubquiz"."UserRole" ADD VALUE 'USER';

ALTER TYPE "pubquiz"."EventSeriesRole"
RENAME VALUE 'EDITOR' TO 'EVENT_EDITOR';
