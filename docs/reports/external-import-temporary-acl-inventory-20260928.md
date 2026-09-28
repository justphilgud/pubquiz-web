# Production ACL inventory before external-import writer setup

Date: 2026-09-28

Database: `neondb`

Direct host: `ep-dawn-paper-alws45vx.c-3.eu-central-1.aws.neon.tech`

Connected role: `neondb_owner`

## Scope and method

`scripts/external-import/inventory-production-temporary.psql` ran in an explicit
`BEGIN TRANSACTION READ ONLY` transaction after validating host, database and
owner. It selected role attributes, memberships, effective and explicit ACLs,
default privileges, temporary-relation counts and aggregated session counts. It
selected no passwords, application rows or active SQL text and finished with
`ROLLBACK` and `write_executed=false`.

The inventory found five non-system roles. At the observation time there were
three `neondb_owner` client sessions, one active, and no temporary relations.

## Role classification

| Role | Purpose | Login | Current TEMPORARY source | Actual requirement | Category | Evidence |
| --- | --- | ---: | --- | --- | --- | --- |
| `cloud_admin` | Neon provider administration | Yes | `PUBLIC`; also `SUPERUSER` | Provider-internal/unknown; not dependent on the PUBLIC grant because superusers bypass ordinary ACL checks | C, provider-controlled | Production catalog role attributes; no application credential or repository code path |
| `neon_service` | Neon provider service role | Yes | `PUBLIC` and inherited `neon_superuser` | Provider-internal/unknown; remains covered by inherited provider role privileges | C, provider-controlled | Member of `neon_superuser` with inheritance; no application credential or repository code path |
| `neon_superuser` | Neon provider administration group | No | Explicit database `TEMPORARY` plus `PUBLIC` | Provider administration; capability remains after a PUBLIC revoke | A, already explicit | Direct database ACL contains `TEMPORARY`; provider memberships only |
| `neondb_owner` | Production application, Prisma migration and protected deployment owner | Yes | Explicit database `TEMPORARY`, inherited `neon_superuser`, and `PUBLIC` | Yes for the existing migration contract | A, already explicit | `20260919170000_cleanup_presentation_templates` creates a transaction-local temporary table; direct ACL remains after PUBLIC revoke |
| `pubquiz_backup_reader` | Production backup and read-only preflight source | Yes | `PUBLIC` only | No | B | Backup code opens read-only sessions, exports a snapshot and invokes `pg_dump`; no temporary-table statement exists; role has only SELECT and CONNECT outside the PUBLIC default |
| `pubquiz_external_import_writer` | Planned guarded external-question writer | No; role absent | Would inherit `PUBLIC` if created now | No; strict contract forbids all DDL | B | Setup and verification contract rejects database TEMPORARY |

`pubquiz_preview_refresher` is not a role in the Production cluster inventory.
Its target is the separate Preview database. Production reads for backup and
refresh use `pubquiz_backup_reader`. The restore owner is in the isolated Neon
restore project, so a Production database ACL change does not affect it.

## Effective Production privileges

- `PUBLIC`: database `CONNECT` and `TEMPORARY`; schema `public` `USAGE`.
- `neondb_owner`: explicit database `CONNECT`, `CREATE`, `TEMPORARY`; owns all
  52 relations and 48 sequences in `public`/`pubquiz`.
- `neon_superuser`: explicit database `CONNECT`, `CREATE`, `TEMPORARY` and the
  provider's predefined-role memberships.
- `pubquiz_backup_reader`: database `CONNECT`, schema `USAGE`, SELECT on all 52
  relations and all 48 sequences; no relation or sequence write privilege and
  no schema/database CREATE.
- No explicit column ACLs exist.
- Default privileges from `neondb_owner` grant the backup reader SELECT on
  future tables and sequences in `public` and `pubquiz`; they grant no writes.
- No current temporary relations were present.

## Repository and tool usage

The only application-repository statement that creates a temporary table is
the already versioned presentation-template cleanup migration. It runs through
the protected migration path as `neondb_owner`, which retains explicit
`TEMPORARY` after a PUBLIC revoke.

Production app queries, the external-import preflight/writer, backup snapshot,
`pg_dump`, validation and Blob transport contain no temporary-table statement.
Restore uses the isolated restore project and does not execute against
Production. `@prisma/streams-local` contains an internal `CREATE TEMP TABLE`
statement, but it is a transitive Prisma development dependency and is not used
by the Production app, backup, migration or import runtime.

Database `TEMPORARY` controls creation of temporary tables. Query-executor
temporary files for sorts/hashes are a separate resource mechanism and do not
require this database privilege. PostgreSQL grants database `CONNECT` and
`TEMPORARY` to `PUBLIC` by default, and effective role privileges are the sum of
direct, inherited and PUBLIC grants:

- https://www.postgresql.org/docs/17/ddl-priv.html
- https://www.postgresql.org/docs/17/role-membership.html

## Effect on sessions

A revoke does not disconnect existing sessions. Subsequent attempts to create a
temporary table are checked against the then-effective database privileges.
Objects already created are not retroactively dropped; none existed at the
inventory snapshot. The three observed sessions used `neondb_owner`, which
retains explicit and inherited TEMPORARY rights, so the planned PUBLIC revoke
does not remove that capability from them.

No mandatory application downtime is indicated. The inventory is a point-in-
time observation, so the future mutation must repeat the role, session and
temporary-object checks immediately before execution. A short controlled
operations window is recommended to keep verification and rollback evidence
unambiguous.

## Proposed ACL migration (not executed)

All roles that need or may need TEMPORARY independently retain it. No additional
role-specific grant is required by the current inventory.

1. Repeat the read-only inventory and confirm the same five roles, no new role
   dependent only on PUBLIC, and no temporary relation owned by such a role.
2. In one owner-controlled transaction, run only:

   ```sql
   REVOKE TEMPORARY ON DATABASE neondb FROM PUBLIC;
   ```

3. Verify:
   - `PUBLIC` has no TEMPORARY;
   - `neondb_owner`, `neon_superuser`, `neon_service` and `cloud_admin` remain
     capable through their direct/inherited/provider privileges;
   - `pubquiz_backup_reader` has no TEMPORARY and remains read-only;
   - the writer precheck passes while the writer role remains absent.
4. Create and verify the writer only in a later, separately authorized step.

## Rollback for the later ACL change

If any unexpected effect appears before writer creation, restore the exact
previous database default in an owner-controlled transaction:

```sql
GRANT TEMPORARY ON DATABASE neondb TO PUBLIC;
```

Then verify effective rights again. Because the current migration plan requires
no new explicit TEMPORARY grants, there are no compensating role grants to
remove on rollback. Writer creation must not be attempted until post-change
verification is fully green.

## Decision

`Kann TEMPORARY sicher von PUBLIC entzogen werden: Ja`

This conclusion is limited to the inventoried role set and requires the
immediate pre-mutation recheck above. No ACL, role, secret, deployment, backup or
content mutation was performed during this AP.

Recommended next step: **A) ACL-Umstellung sicher möglich**, as a separately
approved Production operation with the documented verification and rollback.
