-- Run separately on the verified Production or Preview endpoint.
-- No data rows, credential values or private contents are returned.
-- Counts and fingerprints are inventory evidence, not a full restore validation.
BEGIN READ ONLY;

SELECT current_database() AS database_name,
       current_setting('server_version') AS server_version,
       current_setting('transaction_read_only') AS read_only,
       (SELECT count(*) FROM pubquiz.quiz) AS quizzes,
       (SELECT count(*) FROM pubquiz.fragen) AS questions,
       (SELECT count(*) FROM pubquiz.teams) AS teams,
       (SELECT count(*) FROM pubquiz.team_antworten) AS answers,
       (SELECT count(*) FROM information_schema.tables
        WHERE table_schema = 'pubquiz') AS schema_tables,
       (SELECT string_agg(table_schema, ',') FROM information_schema.tables
        WHERE table_name = '_prisma_migrations') AS migration_schema;

SELECT count(*) AS migrations,
       count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS unfinished,
       max(migration_name) AS latest,
       md5(string_agg(migration_name || ':' || checksum, ',' ORDER BY migration_name)) AS migration_fingerprint
FROM public._prisma_migrations
WHERE rolled_back_at IS NULL;

SELECT md5(string_agg(table_name || ':' || column_name || ':' || data_type || ':' ||
                     udt_name || ':' || is_nullable || ':' || coalesce(column_default, ''),
                     '|' ORDER BY table_name, ordinal_position)) AS column_fingerprint
FROM information_schema.columns
WHERE table_schema = 'pubquiz';

SELECT CASE WHEN datei LIKE 'https://%' THEN split_part(datei, '/', 3)
            ELSE 'relative' END AS media_host,
       count(*) AS media_count
FROM pubquiz.medien
GROUP BY 1 ORDER BY 1;

COMMIT;
