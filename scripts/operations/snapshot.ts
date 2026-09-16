import { createHash } from "node:crypto";
import { AUTH_COLUMNS, auditColumns, inspectRow, inspectValue, projection, tableName, type Column } from "./acceptance-policy";
import { requireCondition } from "./guards";
import type { PgSession } from "./pg-session";
import { canonicalCatalog } from "./catalog-comparison";

export const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export const COLUMN_SQL = `SELECT coalesce(json_agg(x ORDER BY schema,"table",ordinal),'[]') FROM (
 SELECT n.nspname AS schema,c.relname AS "table",a.attname AS "column",a.attnum AS ordinal,
 format_type(a.atttypid,a.atttypmod) AS type,a.attgenerated AS generated,a.attidentity AS identity,
 NOT a.attnotnull AS nullable,pg_get_expr(d.adbin,d.adrelid) AS default
 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
 WHERE n.nspname IN ('public','pubquiz') AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped) x`;
export const CATALOG_SQL = `SELECT json_build_object(
 'schemas',(SELECT json_agg(nspname ORDER BY nspname) FROM pg_namespace WHERE nspname IN ('public','pubquiz')),
 'constraints',(SELECT coalesce(json_agg(x ORDER BY schema,"table",name),'[]') FROM
 (SELECT n.nspname AS schema,c.relname AS "table",k.conname AS name,k.contype AS type,k.convalidated AS validated,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','pubquiz')) x),
 'indexes',(SELECT coalesce(json_agg(x ORDER BY schemaname,tablename,indexname),'[]') FROM (SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes WHERE schemaname IN ('public','pubquiz')) x),
 'sequences',(SELECT coalesce(json_agg(x ORDER BY schema,name),'[]') FROM (SELECT n.nspname AS schema,c.relname AS name,format_type(s.seqtypid,NULL) AS type,s.seqstart::text,s.seqincrement::text,s.seqmax::text,s.seqmin::text,s.seqcache::text,s.seqcycle FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','pubquiz')) x),
 'enums',(SELECT coalesce(json_agg(x ORDER BY schema,name,position),'[]') FROM (SELECT n.nspname AS schema,t.typname AS name,e.enumlabel AS label,e.enumsortorder AS position FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname IN ('public','pubquiz')) x),
 'views',(SELECT coalesce(json_agg(x ORDER BY schemaname,viewname),'[]') FROM (SELECT schemaname,viewname,definition FROM pg_views WHERE schemaname IN ('public','pubquiz')) x))`;
export type TableEvidence = { schema: string; table: string; rows: number; sha256: string; samples: string[] };
export type Snapshot = { columns: Column[]; catalog: unknown; tables: TableEvidence[]; media: string[]; authRows: Record<string, string>; resultRows: string[] };

export async function collectSnapshot(session: PgSession): Promise<Snapshot> {
  // Foreign tables, partitions, custom schemas and executable user routines require
  // an explicit review instead of silently omitting data or exporting connection options.
  const unsafe = await session.json<number>(`SELECT (
    (SELECT count(*) FROM pg_namespace WHERE nspname NOT IN ('public','pubquiz','information_schema') AND nspname !~ '^pg_') +
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','pubquiz') AND c.relkind IN ('f','p','m')) +
    (SELECT count(*) FROM pg_foreign_server) + (SELECT count(*) FROM pg_publication) +
    (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','pubquiz') AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e'))
  )::int`, "SCHEMA_AUDIT");
  requireCondition(unsafe === 0, "SCHEMA_SECURITY_REVIEW_REQUIRED");
  const columns = await session.json<Column[]>(COLUMN_SQL, "COLUMN_AUDIT"); auditColumns(columns);
  const tables: TableEvidence[] = []; const media = new Set<string>(); const authRows: Record<string, string> = {};
  for (const key of [...new Set(columns.map(c => `${c.schema}.${c.table}`))].sort()) {
    const cols = columns.filter(c => `${c.schema}.${c.table}` === key);
    const { schema, table } = cols[0];
    // Each row is JSON TEXT inside the outer JSON array: keep bigints/decimals exact.
    const rows = await session.json<string[]>(`SELECT coalesce(json_agg(v ORDER BY v COLLATE "C"),'[]') FROM
      (SELECT row_to_json(r)::text AS v FROM (SELECT ${projection(cols)} FROM ${tableName(schema, table)}) r) s`, "TABLE_ROWS");
    for (const row of rows) inspectRow(JSON.parse(row), media, schema, table);
    tables.push({ schema, table, rows: rows.length, sha256: sha256(JSON.stringify(rows)), samples: rows.slice(0, 5).map(sha256) });
    if (cols.some(c => `${key}.${c.column}` in AUTH_COLUMNS)) authRows[key] = `[${rows.join(",")}]`;
  }
  // Result reconstruction is derived from persisted final points, not from drafts.
  const resultRows = await session.json<string[]>(`SELECT coalesce(json_agg(v ORDER BY v COLLATE "C"),'[]') FROM
    (SELECT row_to_json(r)::text v FROM (SELECT s.quiz_id,s.team_id,
     coalesce(sum(a.vergebene_punkte) FILTER (WHERE a.bewertung_final),0)::text AS final_points,
     count(a.team_antwort_id) FILTER (WHERE NOT a.bewertung_final)::text AS pending
     FROM pubquiz.quiz_team_sessions s LEFT JOIN pubquiz.team_antworten a USING(quiz_team_session_id)
     GROUP BY s.quiz_id,s.team_id) r) x`, "RESULT_ROWS");
  return { columns, catalog: await session.json(CATALOG_SQL, "CATALOG"), tables, media: [...media].sort(), authRows, resultRows };
}
export function compareSnapshots(expected: Omit<Snapshot, "authRows">, actual: Snapshot) {
  for (const part of ["columns", "catalog", "tables", "media", "resultRows"] as const) {
    const left = part === "catalog" ? canonicalCatalog(expected[part]) : expected[part];
    const right = part === "catalog" ? canonicalCatalog(actual[part]) : actual[part];
    requireCondition(JSON.stringify(left) === JSON.stringify(right), `RESTORE_${part.toUpperCase()}_MISMATCH`);
  }
}
export function authInsertSql(data: Record<string, string>, columns: Column[]) {
  requireCondition(Object.keys(data).sort().join(",") === "pubquiz.teams,pubquiz.users", "AUTH_OVERLAY_TABLES_INVALID");
  return Object.entries(data).map(([key, json]) => {
    const cols = columns.filter(c => `${c.schema}.${c.table}` === key);
    requireCondition(cols.length > 0, "AUTH_OVERLAY_COLUMNS_MISSING");
    const rows = JSON.parse(json) as Record<string, unknown>[];
    requireCondition(Array.isArray(rows), "AUTH_OVERLAY_INVALID");
    for (const row of rows) {
      requireCondition(Object.keys(row).sort().join() === cols.map(c => c.column).sort().join(), "AUTH_OVERLAY_COLUMNS_INVALID");
      requireCondition(key === "pubquiz.users" ? row.password_hash === "" : row.team_passwort === null, "AUTH_VALUE_NOT_REDACTED");
      inspectValue(row, new Set());
    }
    const target = tableName(cols[0].schema, cols[0].table);
    return `INSERT INTO ${target} SELECT * FROM json_populate_recordset(NULL::${target}, '${json.replaceAll("'", "''")}');`;
  }).join("\n");
}
