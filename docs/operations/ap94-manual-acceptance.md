# AP9.4 manual acceptance pipeline

Prepared 2026-09-14. This is an operations-only addition, not an application release.
Production and the regular Preview/Development endpoints are never restore targets.

## Safety contract

- Only workflow_dispatch on justphilgud/pubquiz-web main. Both BACKUP_AUTOMATION_ENABLED
  and BACKUP_RETENTION_VERIFIED must remain false. No scheduled execution or remote deletion.
- Source: pubquiz_backup_reader, exact Production Direct endpoint, neondb, TLS and
  mandatory SCRAM channel binding through native libpq. No owner substitution.
- Destination: icy-leaf-46256271 / br-bitter-paper-b20sx4lu /
  ep-small-poetry-b2jfzg9w.c-6.eu-central-1.aws.neon.tech / neondb / neondb_owner.
  The project-local branch name production does not identify the application's Production.
- Private store only: store_BVRjATGCRBW0fBeF / pubquiz-backups. Immutable keys,
  byte counts and SHA-256 checked after authenticated readback; anonymous manifest access rejected.
- operations-restore remains a separate required-reviewer job. Never self-approve
  or bypass its environment protection. No app/domain connection is created.

## Export and restore architecture

The standard custom pg_dump archive retains schema, ordinary table data, constraints,
indexes, enum types, sequence definitions/state and migration records. A persistent
REPEATABLE READ READ ONLY libpq session exports the shared snapshot used by pg_dump.
Only users/teams data are excluded from the archive. SQL projections replace
users.password_hash with an invalid empty value and teams.team_passwort with NULL
before transfer to the client. A private JSON overlay retains all other columns,
IDs and relationships. Restoration loads pre-data, ordinary data, the checked overlay,
then post-data in one transaction. No original password is needed to validate exclusion.

Schema audit blocks unknown credential columns, generated/identity columns requiring
special handling, foreign data sources, custom schemas and unreviewed stored routines.
Known credential defaults must be absent. Nested JSON credential fields, known token/hash
formats and signed URLs fail closed. This is not a promise to identify arbitrary secrets
written as unrelated free text. The current Prisma/auth implementation has two stored
credential columns; team-session signatures and AUTH_SECRET are not stored in these tables.

The third live run authenticated successfully but stopped before pg_dump at
EMBEDDED_SECRET_REVIEW_REQUIRED. A read-only aggregate audit of all eleven JSONB
columns found three matching design objects, all at
presentation_templates.theme_config_json.tokens. The Operations scanner now reviews
only this exact path as design: version 1, exact groups/keys, hex colors, registered
fonts, bounded weights/spacing/radii and safe asset references. All contents still
pass the recursive credential and media scan; arbitrary tokens fields remain blocked.
The stored rows and hashes are unchanged. No Production data or application code changes.

Run 34881900154 on main 6fdb1dc stopped at the narrower structure gate before
dump/upload. Read-only structure counts found one of three palettes missing only
colors.correct, the legacy form already supported by the application normalizer.
The audit permits precisely that missing key; other missing/extra keys and invalid
values still fail. It does not normalize the backup or populate a fallback value.

The target is checked before connection and again at the only write call. A transaction
advisory lock and database/role/empty-catalog guard precede DDL. The empty default public
schema is dropped without CASCADE so pg_restore can recreate it; existing data causes
an abort. Do not automatically clear a partially used target or repeat a successful restore.

Validation compares column definitions, catalogs, every table's row count and SHA-256
over exact JSON row texts, sample hashes, migration rows, sequence state, final-point
aggregates and application ranking/number-formatting helpers. Decimal/bigint text is
kept exact for database comparison. The domain smoke does not replace the separately
required real application/browser smoke after restore approval.

Referenced Production Blob originals are fetched without credentials or redirects,
privately backed up and authenticated-readback checked. Restore downloads original bytes
and validates the URL-to-file mapping. Other remote media sources fail for explicit review;
repository-owned static assets remain tied to the Production release commit. No originals
are written back into the public Production media store. Limit: 128 MiB per artifact,
2048 artifacts per manifest; exceeding a limit fails instead of silently omitting media.

## Before dispatch

Finish the live R04 credential/Development/old-deployment isolation audit first.
Reverify both environments, private store, empty target, current Production release
and provider identity. Do not infer actual GitHub secret values from their names.
The corrected j-host is confirmed in operations-restore; password unchanged by this work.

Run **AP9.4 Manual Backup and Isolated Restore** on main with the verified 40-character
Production application SHA. The backup job records its key and manifest SHA in its
summary and hands these exact values to the protected restore job. Stop when that job
waits for the reviewer; report the exact run URL. The workflow never deploys the application.

After approval inspect the private validation record and complete application/browser
smoke against the isolated target. Record all failures honestly. Snapshot age at restore,
measured restore/validation durations and total recovery duration are separate from an
operational RPO/RTO guarantee. No automatic cleanup or retention is enabled.

## Validation of this implementation

Run 34884691642 on main 25d54a3 failed in DATA_UPLOAD (backup 1m52s, acceptance
1m08s). Source snapshot, redacted capture, archive audit and media capture precede
that phase and completed; a successful private backup is still not established.
The SDK cause remains unknown: the phase includes put and immediate get/readback.
The private adapter now emits fixed UPLOAD/READBACK plus known SDK/network categories,
never provider messages or causes. Existing identity, size and checksum gates remain
unchanged. No retry, credentials, access mode, transport or restore protection changes.

Run 34883162344 on main 386d034 failed with OPERATIONS_FAILED_DETAILS_WITHHELD
(backup job 2m26s, acceptance step 1m34s); restore was skipped. This message does
not establish which phase failed or whether partial uploads exist. Do not claim
a completed backup, successful readback or absence of uploaded artifacts from it.
Unexpected backup exceptions now expose only a fixed phase (source capture,
archive, media capture, overlay file, upload, manifest, anonymous readback or cleanup).
Existing safety-gate codes remain unchanged; raw errors and causes are discarded.
No export, redaction, credential, transport, target or reviewer rule changes.

The first real run (34876340079, 2026-09-14) stopped with LIBPQ_SESSION_FAILED;
restore was skipped. The native session now reports only a fixed failure category
and a fixed execution phase. Raw stderr is bounded to 8192 characters in memory,
classified and discarded; SQL, row data, URLs, hostnames and credentials are never
included in the diagnostic output. Unknown messages remain SESSION_FAILED. These
categories are diagnostic hints, not permission to relax any source/target/TLS guard.
The source, redaction, read-only transaction, private store and reviewer gates are unchanged.

Local disposable PostgreSQL 18.4 with TLS/SCRAM binding: synchronized concurrent-change
test, original-auth-value exclusion, custom dump/restore, Unicode/quotes/decimal/FK/
migration/full-row-hash comparison and nonempty-target rejection passed. No Production
credentials or data used. Unit tests additionally cover wrong/pooler hosts, manual-mode
flags, secret fields, artifact corruption, bounded reads, media roundtrip and deployment scope.
Typecheck and Operations ESLint pass. Real Neon 17, Blob authentication and browser
smoke remain acceptance measurements, not claimed by local tests.

Only scripts/operations, this runbook and two workflows belong in the main commit.
The Production workflow retains its environment review and now suppresses operations-only
commits; mixed application/schema/package changes still require the normal deployment path.
Vercel Git automatic deployment remains disabled by the unchanged vercel.json.

Sources: [PostgreSQL snapshot/dump options](https://www.postgresql.org/docs/18/app-pgdump.html),
[Vercel private storage](https://vercel.com/docs/vercel-blob/private-storage).
