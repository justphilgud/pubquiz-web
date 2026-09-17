-- A short-lived proof for retrying a newly created team after a lost response.
ALTER TABLE "pubquiz"."quiz_team_sessions" ADD COLUMN "join_request_hash" TEXT;
