# Bingo v0.5 – AP2 preparation and printed cards

Status: AP2 implemented with local isolated acceptance; exact-head CI/hosted-preview
evidence is tracked in PR #143 and the linked acceptance report. No runtime, public
join link, draw state, claim workflow or AP3 implementation is included.

AP3 adds the separate persisted integration in [Bingo Live](bingo-live.md).
Preparation and immutable print contracts remain owned by this AP2 module.

## Ownership and boundaries

`game_drafts.id` remains the sole game identity. Existing master data, optional
date, event-series relation, team assignments and shared-design selection retain
their meanings. The AP1 core supplies card generation and validation unchanged.
Preparation has its own optimistic revision; it is not a second game/runtime
status. A future runtime can reference rounds and immutable cards directly.

`app/bingo/preparation/repository.server.ts` owns preparation transactions,
revision checks, idempotence and generation. `access.server.ts` shares current
authorization and lock ordering. `readPreparation.server.ts` serves the overview
without importing generation. `readExport.server.ts` reads stored cards in an
explicitly read-only transaction and has no generation/source-asset IO dependency.
This keeps the PDF function inside the regular serverless package limit rather
than bundling unused source assets. UI components own only editing/feedback/
navigation protection. `pdf.server.ts` receives stored cards and frozen design
bytes and performs no database writes or network access.

## Additive persistence

Migration `20261027180000_bingo_preparation` adds the six original tables (the square-print extension adds two more; see its linked contract):

| Table | Responsibility |
| --- | --- |
| bingo_preparations | One revision counter per game |
| bingo_rounds | Stable round ID, ordering, label, planning target, strategy, nullable issued total |
| bingo_card_series | Game/origin round, generation request/hash, immutable versioned print design and asset bytes |
| bingo_cards | Stable card ID, ordinal, globally unique printed code, full validated immutable cells and layout hash |
| bingo_round_series | Explicit game-scoped many-to-many round/series relation |
| bingo_issuance_changes | Immutable actor/time/before/after history |

All foreign-key deletions restrict. Cards, series and issue-history records cannot
be updated or deleted. Composite foreign keys prevent cross-game series links.
Checks cover AP1 cell dimensions/ranges/free centre, unique layouts within a
series, identity codes, quantities and strategies. Deferred completeness triggers
prevent partial series. The issued total cannot exceed distinct linked cards;
removing a link cannot invalidate an existing total. Rounds with references or
history cannot be removed. Games with card series cannot move to another series.

The migration does not update existing records or rewrite historical migrations.
Empty and representative populated isolated tests baseline the AP1 Prisma schema,
then execute this migration. This is explicitly not a successful replay of the
entire historical migration chain and does not repair historical bootstrap issues.

## Policies and concurrency

Every read/export and write reloads the active actor, current series role and
Bingo product gate. Admin and event manager manage preparation; Bingo editors
retain existing master-data reads and gain no preparation/export/write capability.
A pure shared-series administration grant is insufficient. Admin also requires
the product to be enabled. Archived series permit authorized old-card reads and
exports, but no preparation writes/generation/issue corrections.

Writes lock game → product advisory gate → event series → user/current role rows,
matching existing game operations. A client supplies expected series and revision.
Conflicts preserve client inputs and require reload. All commands are atomic.
Generation retries check current authorization and archive state first, then the
request ID/body hash before revision comparison: the identical retry returns the
existing series, while a changed body is rejected. The game lock serializes
concurrent retries. Client-side pending/ref guards additionally prevent double clicks.

## Round and card contracts

Default label is `Runde N`; default planning target is 30, with 20/30/40 suggestions
and integer values 1–75. The target is planning data and never an automatic stop.
Rounds are paginated in groups of 25, with no small business limit.

`NEW` means new cards for this round; `EXISTING` permits explicit selection of
existing series from the same game. Multiple series may be attached, and series
may be reused by multiple rounds. Strategy changes never copy/delete cards or
copy an issued total. Incompatible links must be explicitly removed first.

Generation defaults to 100, bounded to 1–500 cards per request. More series remain
possible. AP1 receives a cryptographic random source; cells are persisted in full,
not reconstructed from a seed. Duplicate layouts are rejected within the series;
20 attempts per requested card bound the operation, followed by total rollback on
failure. Printed codes are `BG-<12 uppercase hex>-<four-digit ordinal>` with a
database uniqueness constraint. UUIDs remain the actual stable identities.

Issued total: null means not recorded; zero explicitly means none. It is a
nonnegative integer capped by distinct linked cards. Changes record authenticated
actor, timestamp and old/new value. It does not prove a particular card's actual
eligibility, sale, payment or assignment to a person/team. PDF export never changes it.

## Print contract

The approved square-card extension is binding for new print snapshots:
[Bingo print design V2](bingo-print-design.md). It defines print-only inherited
settings in the existing template architecture, square cards, centre logos,
front/back rendering, explicit immutable redesign versions, stable short codes,
long-edge duplex, exact preview and visual/integrity regressions. Historical V1
snapshots and their original export remain unchanged and explicitly selectable.
Two additional additive migrations introduce the print overrides, version/label
tables and serialized label allocation. They do not rewrite this package's first
migration or modify existing cards, identities, assignments or issue totals.

## Backup, restore and local operation

The dynamic inventory and schema-scoped database dump include all eight ordinary
Bingo tables. Executable objects require an additional exact security review:
`schema-reference/bingo-ap2-routines.json` binds nine functions and fifteen triggers
to the three immutable AP2 migration checksums. The existing reviewer checks the
complete body/signature/security/trigger set; no name-prefix exception is allowed.
Unknown, missing, disabled or altered objects fail before row export. Legacy
pre-Bingo snapshots retain their existing exact validation. Trigger UPDATE OF
bindings use ordered column names instead of physical attribute numbers, retaining
semantic equality across independently constructed model baselines. The narrow
`inspectRow` case validates print-snapshot shape, checksums and existing design
token/media rules; it does not exempt other JSON or secret-bearing fields. Cards
are decoded with AP1 validation. Embedded frozen assets travel inside the database
dump, independently of mutable source URLs. Snapshot source references are still
strictly validated but are not added as additional media downloads: the used bytes
are already frozen in the row, and print v1 does not use scene backgrounds.
Restore must preserve schema objects,
card identities/cells, relation scope and issue history; the existing restore
workflow remains responsible for its transactional ordering and integrity checks.
No manual backup or restore is required or executed for AP2 acceptance.

The core/card and persisted contracts require neither a camera nor Vercel. Node,
PostgreSQL and bundled fonts can support a future offline deployment; Raspberry Pi,
OCR, synchronization, draw state and live operation are deliberately outside AP2.
