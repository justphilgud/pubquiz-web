# PR149: exact read-only preflight without schema or migration delta

Separately human-approved on 30 Oct 2026, only Production
`1b025a78da4f3bc439bda0ac8510b377c1a4eb0f` -> candidate
`ed551d426de69c42eaea604c34176ede72305439`.
The application candidate contains only the two approved icon/ordering corrections.

The new immutable no-delta plan retains all old release pairs. It pins the full
69-file manifest SHA256 `e996d003df6d87260bbd3201e211e2eb11a419f6bf5c3b5cfa7def8ee1a6c498`
and schema SHA256 `8de3ef99975080831c86be36cae7f62bc4a3abe5e2181e92b1a65b8d590d4947`.
Last migration: `20261030150000_bingo_event_operation`. Git independently confirms
identical schema bytes and all 69 SQL files between these immutable revisions.
Missing, additional, duplicated, changed or coherently forged manifests block.
The complete-history helper accepts the 69-file history only with this approved
pair; its existing 64-file default and previous release contracts remain intact.

The secret-free reference job reads only Git manifests/schema, executes no SQL
or candidate application. The protected main-only Production and operations-backup
jobs retain existing environment approvals, GET-only deployment identity checks,
TLS/read-only/reader privilege/history/checksum gates. The CLI regenerates the
manifest proof and checks artifact equality before the fixed read-only DB query.
All 69 migrations must be completed, unique and checksum-valid, with no failed,
unexpected or pending migration. Unknown pairs remain blocked; no wildcard.
This proves current migration history and absent repository delta, not a fresh
full Live-DDL comparison. Historical bootstrap limitations remain NOT_RUN /
HISTORICAL_BOOTSTRAP_LIMITATION_UNCHANGED, never described as repaired.

The separate Operations PR changes only plan, tests, CLI, Safety-CI matrix and
this document. Its actual path diff must yield needsApplicationDeployment=false;
adding application/schema files still yields true. No deployment-scope exceptions,
workflow protections, secrets, database roles or application configuration change.
Merge normally only after required CI/technical review. Verify application deploy
is skipped, then run the protected read-only preflight for the exact pair.

Before PR149 merge and write-capable release, reconfirm both Production aliases,
candidate and Main. Merge result may differ from the approved candidate only by
this separately reviewed operations change. Existing Production workflow remains
responsible for migration status and deployment; no new migration is expected.
Stop on unexpected migration status; no baseline, resolve, repair, backup, restore,
reset or blind additional migration. No active live view is opened or reloaded.
Final report must verify READY, aliases, runtime SHA and read-only Production
smokes of the corrected icons/reference renderer. Existing Storybook overflow is
separately documented, not fixed or hidden by this release.
