import { createHash } from "node:crypto";
import reference from "./schema-reference/meme-archive-routines.json";
import {readFileSync} from "node:fs";
import bingo from "./schema-reference/bingo-ap2-routines.json";
import bingoLive from "./schema-reference/bingo-live-routines.json";
import roleGuards from "./schema-reference/role-guard-routines.json";
import { inspectValue } from "./acceptance-policy";
import { requireCondition } from "./guards";

export const MEME_ARCHIVE_EXECUTABLE_SQL = `SELECT json_build_object(
 'bingoLiveTables',(SELECT coalesce(json_agg(c.relname ORDER BY c.relname),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='pubquiz' AND c.relkind='r' AND c.relname IN ('bingo_live_cards','bingo_live_events','bingo_live_runs')),
 'bingoTables',(SELECT coalesce(json_agg(c.relname ORDER BY c.relname),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='pubquiz' AND c.relkind='r' AND c.relname IN ('bingo_preparations','bingo_rounds','bingo_card_series','bingo_cards','bingo_round_series','bingo_issuance_changes','bingo_series_labels','bingo_print_versions')),
 'roleTables',(SELECT coalesce(json_agg(c.relname ORDER BY c.relname),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='pubquiz' AND c.relkind='r' AND c.relname IN ('eventarten','eventreihe_eventarten','benutzer_eventartrollen','eventreihe_verwaltung','benutzer_reihenrollen')),
 'tables',(SELECT coalesce(json_agg(c.relname ORDER BY c.relname),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='pubquiz' AND c.relkind='r' AND c.relname IN ('meme_archive_sources','meme_archive_entries')),
 'routines',(SELECT coalesce(json_agg(x ORDER BY schema,name),'[]') FROM (SELECT n.nspname AS schema,p.proname AS name,
 ARRAY(SELECT format_type(t,NULL) FROM unnest(p.proargtypes) t) AS "argumentTypes",p.proargnames AS "argumentNames",
 format_type(p.prorettype,NULL) AS result,l.lanname AS language,p.prokind AS kind,p.prosecdef AS "securityDefiner",p.proleakproof AS leakproof,
 p.proisstrict AS strict,p.provolatile AS volatility,p.proparallel AS parallel,p.proconfig AS configuration,p.procost AS cost,p.prorows AS rows,
 p.proargmodes AS "argumentModes",p.proallargtypes AS "allArgumentTypes",p.pronargdefaults AS "defaultArguments",
 p.provariadic<>0 AS variadic,p.prosupport<>0 AS support,p.probin AS binary,p.prosrc AS source
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
 WHERE n.nspname IN ('public','pubquiz') AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')) x),
 'triggers',(SELECT coalesce(json_agg(x ORDER BY schema,name),'[]') FROM (SELECT n.nspname AS schema,t.tgname AS name,c.relname AS "table",
 fn.nspname AS "functionSchema",p.proname AS "functionName",t.tgtype AS type,t.tgenabled AS enabled,t.tgdeferrable AS deferrable,
 t.tginitdeferred AS deferred,t.tgconstraint<>0 AS constraint,(SELECT coalesce(string_agg(a.attname,',' ORDER BY x.ord),'') FROM unnest(t.tgattr) WITH ORDINALITY x(attnum,ord) JOIN pg_attribute a ON a.attrelid=t.tgrelid AND a.attnum=x.attnum) AS columns,encode(t.tgargs,'hex') AS arguments,
 pg_get_expr(t.tgqual,t.tgrelid) AS condition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace fn ON fn.oid=p.pronamespace WHERE n.nspname IN ('public','pubquiz') AND NOT t.tgisinternal) x))`;

export const MEME_ARCHIVE_REQUIRED_ORIGINAL_SQL = `SELECT coalesce(json_agg(source_id ORDER BY source_id),'[]') FROM pubquiz.meme_archive_sources s
 WHERE image_bytes IS NULL AND EXISTS(SELECT 1 FROM pubquiz.meme_archive_entries e WHERE e.source_id=s.source_id AND e.status IN ('PENDING','ERROR','READY'))`;
const trigger = {schema: "pubquiz", name: "capture_confirmed_meme", table: "team_answer_submissions", functionSchema: "pubquiz",
  functionName: "capture_confirmed_meme", type: 5, enabled: "O", deferrable: false, deferred: false, constraint: false, columns: "", arguments: "", condition: null};
const stable = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b, "en"))) : item);
export type ArchiveSchemaProof = {version: 1; migrationSha256: string; executableSha256: string; roleGuardMigrations?: {name:string;sha256:string}[]; bingoMigrations?: {name:string;sha256:string}[]; bingoLiveMigrations?: {name:string;sha256:string}[]};

export function assertBingoMigrationChecksums(actual: readonly {name:string;sha256:string}[]) {
  requireCondition(stable(actual) === stable(bingo.migrations), "BINGO_MIGRATION_REFERENCE_MISMATCH");
}

/** Exact approved bodies/signatures/security attributes, never a name-only exception. */
export function reviewMemeArchiveExecutables(value: unknown): ArchiveSchemaProof | undefined {
  requireCondition(Boolean(value) && typeof value === "object" && !Array.isArray(value), "SCHEMA_SECURITY_REVIEW_REQUIRED");
  const data = value as Record<string, unknown>;
  const liveTables = data.bingoLiveTables ?? [];
  requireCondition(Array.isArray(liveTables), "SCHEMA_SECURITY_REVIEW_REQUIRED");
  const hasLive = liveTables.length > 0;
  if (hasLive) {
    requireCondition(stable(liveTables) === stable(bingoLive.tables), "SCHEMA_SECURITY_REVIEW_REQUIRED");
    for (const migration of bingoLive.migrations) {
      const sql = readFileSync(new URL(`../../prisma/migrations/${migration.name}/migration.sql`, import.meta.url), "utf8").replaceAll("\r\n", "\n");
      requireCondition(createHash("sha256").update(sql).digest("hex") === migration.sha256, "BINGO_LIVE_MIGRATION_REFERENCE_MISMATCH");
    }
  }
  requireCondition(Array.isArray(data.tables) && Array.isArray(data.routines) && Array.isArray(data.triggers), "SCHEMA_SECURITY_REVIEW_REQUIRED");
  const bingoTables = data.bingoTables ?? [];
  requireCondition(Array.isArray(bingoTables), "SCHEMA_SECURITY_REVIEW_REQUIRED");
  const hasBingo = bingoTables.length > 0;
  requireCondition(!hasLive || hasBingo, "SCHEMA_SECURITY_REVIEW_REQUIRED");
  if (hasBingo) {
    requireCondition(stable(bingoTables) === stable(bingo.tables), "SCHEMA_SECURITY_REVIEW_REQUIRED");
    assertBingoMigrationChecksums(bingo.migrations.map(migration => {
      const bytes = readFileSync(new URL(`../../prisma/migrations/${migration.name}/migration.sql`, import.meta.url));
      return {name:migration.name,sha256:createHash("sha256").update(bytes.toString("utf8").replaceAll("\r\n", "\n")).digest("hex")};
    }));
  }
  const roleTables = data.roleTables ?? [];
  requireCondition(Array.isArray(roleTables), "SCHEMA_SECURITY_REVIEW_REQUIRED");
  const hasRoleGuards = roleTables.length > 0;
  if (hasRoleGuards) requireCondition(stable(roleTables) === stable(roleGuards.tables), "SCHEMA_SECURITY_REVIEW_REQUIRED");
  if (!data.tables.length && !data.routines.length && !data.triggers.length && !hasRoleGuards && !hasBingo) return undefined;
  requireCondition(stable(data.tables) === stable(["meme_archive_entries", "meme_archive_sources"]), "SCHEMA_SECURITY_REVIEW_REQUIRED");
  const routines = data.routines.map((item: unknown): Record<string, unknown> => {
    requireCondition(Boolean(item) && typeof item === "object" && !Array.isArray(item), "SCHEMA_SECURITY_REVIEW_REQUIRED");
    const { source, ...attributes } = item as Record<string, unknown>;
    requireCondition(typeof source === "string", "SCHEMA_SECURITY_REVIEW_REQUIRED");
    return {...attributes, sourceSha256: createHash("sha256").update(source.replaceAll("\r\n", "\n")).digest("hex")};
  }).sort((a, b) => String(a.name).localeCompare(String(b.name), "en"));
  const expectedRoutines = [...reference.routines, ...(hasRoleGuards ? roleGuards.routines : []), ...(hasBingo ? bingo.routines : [])];
  const expectedTriggers = [trigger, ...(hasRoleGuards ? roleGuards.triggers : []), ...(hasBingo ? bingo.triggers : []), ...(hasLive ? bingoLive.triggers : [])];
  const byName = (a: {name: unknown}, b: {name: unknown}) => String(a.name).localeCompare(String(b.name), "en");
  requireCondition(stable(routines) === stable(expectedRoutines.sort(byName)) &&
    stable(data.triggers.slice().sort(byName)) === stable(expectedTriggers.sort(byName)), "SCHEMA_SECURITY_REVIEW_REQUIRED");
  return {version: 1, migrationSha256: reference.migrationSha256,
    executableSha256: createHash("sha256").update(stable({routines, triggers: data.triggers})).digest("hex"),
    ...(hasRoleGuards ? {roleGuardMigrations: roleGuards.migrations} : {}),
    ...(hasBingo ? {bingoMigrations: bingo.migrations} : {}),
    ...(hasLive ? {bingoLiveMigrations: bingoLive.migrations} : {})};
}

function bytea(value: unknown, maximum: number, exact?: number) {
  requireCondition(typeof value === "string" && /^\\x(?:[a-f0-9]{2})*$/.test(value), "MEME_ARCHIVE_BINARY_REVIEW_REQUIRED");
  const bytes = (value.length - 2) / 2;
  requireCondition(bytes <= maximum && (exact === undefined || bytes === exact), "MEME_ARCHIVE_BINARY_REVIEW_REQUIRED");
}

/** Keep every byte in the dump; only classify which external objects remain dependencies. */
export function inspectMemeArchiveRow(row: Record<string, unknown>, media: Set<string>, table: string, requiredOriginals: ReadonlySet<number>) {
  if (table === "meme_archive_sources") {
    const {image_url, image_bytes, ...rest} = row;
    if (image_bytes !== null) bytea(image_bytes, 12_000_000);
    requireCondition(Number.isSafeInteger(row.source_id) && typeof image_url === "string", "MEME_ARCHIVE_ROW_REVIEW_REQUIRED");
    // A completed/deleted archive no longer depends on the old original URL.
    // URL/credential validation still runs; only dependency collection differs.
    inspectValue(image_url, requiredOriginals.has(row.source_id as number) ? media : new Set(), "image_url");
    inspectValue(rest, media); inspectValue(image_bytes, media, "image_bytes");
    return;
  }
  requireCondition(table === "meme_archive_entries" && typeof row.entry_id === "string" && /^[a-f0-9-]{36}$/.test(row.entry_id) &&
    ["PENDING", "READY", "ERROR", "DELETING", "DELETED"].includes(String(row.status)), "MEME_ARCHIVE_ROW_REVIEW_REQUIRED");
  const {blob_url, ...rest} = row;
  if (row.encryption_key !== null) bytea(row.encryption_key, 32, 32);
  if (row.pending_file !== null) bytea(row.pending_file, 12_000_028);
  requireCondition(row.png_sha256 === null || (typeof row.png_sha256 === "string" && /^[a-f0-9]{64}$/.test(row.png_sha256)), "MEME_ARCHIVE_ROW_REVIEW_REQUIRED");
  if (blob_url !== null) requireCondition(blob_url === `https://bix6h2j23vjzi240.public.blob.vercel-storage.com/prod/meme-archive/${row.entry_id}.bin`, "MEME_ARCHIVE_ROW_REVIEW_REQUIRED");
  if (row.status === "READY") requireCondition(typeof blob_url === "string" && row.encryption_key !== null && row.png_sha256 !== null &&
    Number.isSafeInteger(row.png_size) && Number(row.png_size) > 0 && Number(row.png_size) <= 12_000_000 && row.pending_file === null, "MEME_ARCHIVE_ROW_REVIEW_REQUIRED");
  if (row.status === "DELETED") requireCondition([blob_url, row.encryption_key, row.png_sha256, row.png_size, row.pending_file].every(v => v === null), "MEME_ARCHIVE_ROW_REVIEW_REQUIRED");
  inspectValue(rest, media);
  inspectValue(blob_url, row.status === "READY" ? media : new Set(), "blob_url");
}
