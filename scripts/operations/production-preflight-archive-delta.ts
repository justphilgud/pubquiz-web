import { compareFullSchema, type SchemaEvidence } from "./production-preflight-schema";

type Row = Record<string, unknown>;
const TABLES = ["meme_archive_sources", "meme_archive_entries"];
const COLUMNS: Record<string, string[]> = {
  meme_archive_sources: ["source_id", "quiz_id", "lifecycle_revision", "quiz_question_id", "quiz_title", "question_text", "image_url", "layout", "image_bytes"],
  meme_archive_entries: ["entry_id", "source_id", "submission_id", "session_id", "team_id", "team_name", "submission_version", "payload", "submitted_at", "status", "attempts", "error_message", "blob_url", "encryption_key", "png_sha256", "png_size", "pending_file"],
};
const ROUTINES = ["archive_meme_submission", "capture_confirmed_meme", "assert_meme_archive_reset_safe"];
function rows(value: unknown): Row[] {
  if (!Array.isArray(value) || value.some(row => !row || typeof row !== "object" || Array.isArray(row))) throw new Error("DELTA_CATALOG_INCOMPLETE");
  return value as Row[];
}
function record(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("DELTA_CATALOG_INCOMPLETE");
  return value as Row;
}
const archiveTable = (row: Row) => (row.schema ?? row.schemaname) === "pubquiz" && TABLES.includes(String(row.table ?? row.tablename));

/** Remove only the exact new archive objects, then compare EVERY old schema section.
 * Called only against disposable offline PostgreSQL after checksum-pinned SQL.
 */
export function assertOnlyArchiveSchemaAdded(before: SchemaEvidence, after: {major: number; columns: unknown; catalog: unknown; objects: unknown}) {
  const columns = rows(after.columns), catalog = record(after.catalog), objects = record(after.objects);
  for (const table of TABLES) {
    const actual = columns.filter(row => row.schema === "pubquiz" && row.table === table).map(row => String(row.column)).sort();
    if (JSON.stringify(actual) !== JSON.stringify([...COLUMNS[table]].sort())) throw new Error("UNEXPECTED_ARCHIVE_COLUMNS");
  }
  const withoutArchive = { ...catalog };
  for (const [section, count] of [["constraints", 7], ["indexes", 6], ["indexHealth", 6]] as const) {
    const values = rows(catalog[section]);
    if (values.filter(archiveTable).length !== count) throw new Error("UNEXPECTED_ARCHIVE_CATALOG");
    withoutArchive[section] = values.filter(row => !archiveTable(row));
  }
  const selectors = {
    relations: (row: Row) => row.schema === "pubquiz" && TABLES.includes(String(row.name)) && row.kind === "r",
    routines: (row: Row) => row.schema === "pubquiz" && ROUTINES.includes(String(row.name)),
    triggers: (row: Row) => row.schema === "pubquiz" && row.name === "capture_confirmed_meme",
  };
  const withoutObjects = { ...objects };
  for (const [section, predicate] of Object.entries(selectors)) {
    const values = rows(objects[section]);
    const count = section === "relations" ? 2 : section === "routines" ? 3 : 1;
    if (values.filter(predicate).length !== count) throw new Error("UNEXPECTED_ARCHIVE_OBJECTS");
    withoutObjects[section] = values.filter(row => !predicate(row));
  }
  const result = compareFullSchema(before, { ...after, columns: columns.filter(row => !archiveTable(row)), catalog: withoutArchive, objects: withoutObjects }, before.baselineSha, before.manifest);
  if (result.status !== "PASS") throw new Error("UNEXPECTED_DELTA_SCHEMA");
}

// Ordinary old-application columns only; identifiers are fixed and the fixture is
// executed exclusively inside the disposable, network-isolated PostgreSQL.
export const ARCHIVE_CAPTURE_FIXTURE_SQL = `
WITH series AS (INSERT INTO pubquiz.eventreihen(name,slug) VALUES('PR116 isolated','pr116-isolated') RETURNING eventreihe_id),
quiz AS (INSERT INTO pubquiz.quiz(eventreihe_id,titel) SELECT eventreihe_id,'PR116 isolated' FROM series RETURNING quiz_id),
block AS (INSERT INTO pubquiz.quiz_abschnitte(quiz_id,titel,abschnitt_typ,sortierung) SELECT quiz_id,'QA','FRAGEN',1 FROM quiz RETURNING *),
question AS (INSERT INTO pubquiz.fragen(frage) VALUES('PR116 isolated Meme') RETURNING fragen_id),
assignment AS (INSERT INTO pubquiz.quiz_fragen(quiz_id,fragen_id,quiz_abschnitt_id) SELECT block.quiz_id,question.fragen_id,block.quiz_abschnitt_id FROM block,question RETURNING *),
team AS (INSERT INTO pubquiz.teams(teamname,teamname_normalisiert) VALUES('PR116 isolated','pr116-isolated') RETURNING team_id),
session AS (INSERT INTO pubquiz.quiz_team_sessions(quiz_id,team_id,teamname) SELECT quiz.quiz_id,team.team_id,'PR116 isolated' FROM quiz,team RETURNING *),
run AS (INSERT INTO pubquiz.quiz_interaction_runs(quiz_id,quiz_fragen_id,interaction_type,state,config_snapshot)
 SELECT assignment.quiz_id,assignment.quiz_fragen_id,'MEME_CAPTION','OPEN','{"interaction":{"imageUrl":"/medien/isolated.png","layout":{"version":1,"mode":"STANDARD"}}}'::jsonb FROM assignment RETURNING *),
answer AS (INSERT INTO pubquiz.team_antworten(quiz_id,quiz_abschnitt_id,quiz_fragen_id,quiz_team_session_id,interaction_run_id)
 SELECT assignment.quiz_id,assignment.quiz_abschnitt_id,assignment.quiz_fragen_id,session.quiz_team_session_id,run.interaction_run_id FROM assignment,session,run RETURNING *)
INSERT INTO pubquiz.team_answer_submissions(interaction_run_id,team_antwort_id,quiz_team_session_id,submission_version,draft_revision,interaction_type,status,payload)
 SELECT interaction_run_id,team_antwort_id,quiz_team_session_id,1,1,'MEME_CAPTION','SUBMITTED','{"topText":"Isolated ÄÖÜ","bottomText":"No production data"}'::jsonb FROM answer;
`;
