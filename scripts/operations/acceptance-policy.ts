import {parseEventEnvelope} from "../../app/bingo/live/eventEnvelope";
import {parseRoundSnapshot} from "../../app/bingo/live/roundSnapshot";
import { parseQuizDesignSnapshot, parseSharedDesign } from "../../app/rendering/sharedDesign/sharedDesign";
import { assertRestoreTarget, requireCondition } from "./guards";
import { brandFontOptions } from "../../app/rendering/templateRegistry";
import { isSafeTemplateAssetReference } from "../../app/rendering/presentationTemplates/presentationTemplateAssets";
import { parsePrintSnapshot } from "../../app/bingo/preparation/printSnapshot";
import { decodeCard } from "../../app/bingo/preparation/policy";
import { parseLiveAssets } from "../../app/bingo/live/visualAssets";
import {parseTermSet} from '../../app/bingo/preparation/termSet';
import {canonical,sha256} from '../../app/bingo/preparation/printSnapshot';
import {matchingContentType} from '../../app/bingo/matching/mediaFormat';

export const RESTORE_TARGET = {
  project: "icy-leaf-46256271", branch: "br-bitter-paper-b20sx4lu",
  endpoint: "ep-small-poetry-b2jfzg9w",
  host: "ep-small-poetry-b2jfzg9w.c-6.eu-central-1.aws.neon.tech",
  database: "neondb", role: "neondb_owner", major: 17,
} as const;
export const PRIVATE_HOST = "bvrjatgcrbw0fbef.private.blob.vercel-storage.com";
export type Environment = Readonly<Record<string, string | undefined>>;
export function assertManualAcceptance(env: Environment) {
  requireCondition(env.GITHUB_REPOSITORY === "justphilgud/pubquiz-web" && env.GITHUB_REF === "refs/heads/main" &&
    env.GITHUB_EVENT_NAME === "workflow_dispatch" && env.AP94_MANUAL_ACCEPTANCE === "true", "MANUAL_ACCEPTANCE_REQUIRED");
  requireCondition(env.BACKUP_AUTOMATION_ENABLED === "false" && env.BACKUP_RETENTION_VERIFIED === "false", "ACCEPTANCE_SWITCHES_MUST_STAY_FALSE");
}
export function assertRestoreAcceptance(env: Environment) {
  requireCondition(env.GITHUB_REPOSITORY === "justphilgud/pubquiz-web" && env.GITHUB_REF === "refs/heads/main" &&
    env.GITHUB_EVENT_NAME === "workflow_dispatch" && env.AP94_MANUAL_ACCEPTANCE === "true" &&
    (env.AP96_RUN_RESTORE === "true" || (env.AP94_RESTORE_PREFLIGHT === "true" && env.AP96_RUN_RESTORE === "false")), "MANUAL_RESTORE_ACCEPTANCE_REQUIRED");
}
export function pinnedRestoreConnection(env: Environment) {
  const value = env.RESTORE_TEST_DATABASE_URL;
  assertRestoreTarget(value, "restore-test", env.RESTORE_TEST_EXPECTED_HOST ?? "");
  const url = new URL(value!);
  requireCondition(url.hostname === RESTORE_TARGET.host && env.RESTORE_TEST_EXPECTED_HOST === RESTORE_TARGET.host &&
    decodeURIComponent(url.username) === RESTORE_TARGET.role && !!url.password, "PINNED_RESTORE_TARGET_REQUIRED");
  url.searchParams.delete("schema");
  return url.toString();
}
export function identifier(value: string) {
  requireCondition(/^[A-Za-z_][A-Za-z0-9_]*$/.test(value), "UNREVIEWED_IDENTIFIER");
  return `"${value}"`;
}
export function tableName(schema: string, table: string) {
  requireCondition(["public", "pubquiz"].includes(schema), "UNREVIEWED_SCHEMA");
  return `${identifier(schema)}.${identifier(table)}`;
}
export const AUTH_COLUMNS: Readonly<Record<string, string>> = {
  "pubquiz.users.password_hash": "''::text", "pubquiz.teams.team_passwort": "NULL::text",
};
export type Column = { schema: string; table: string; column: string; type: string; generated: string; identity: string; nullable: boolean; default: string | null };
export function auditColumns(columns: Column[]) {
  requireCondition(Object.keys(AUTH_COLUMNS).every(key => columns.some(c => `${c.schema}.${c.table}.${c.column}` === key)), "AUTH_COLUMNS_MISSING");
  for (const c of columns) {
    tableName(c.schema, c.table); identifier(c.column);
    const key = `${c.schema}.${c.table}.${c.column}`;
    if (key in AUTH_COLUMNS) requireCondition(c.default === null && c.type === "text", "AUTH_COLUMN_DEFAULT_REVIEW_REQUIRED");
    if(key==='pubquiz.bingo_matching_assets.content')requireCondition(c.type==='bytea','MATCHING_BINARY_COLUMN_REQUIRED');
    requireCondition(!/(password|passwort|secret|token|credential|api_?key|authorization|private_?key)/i.test(c.column) ||
      key in AUTH_COLUMNS || key === "pubquiz.users.must_change_password", "UNREVIEWED_SECRET_COLUMN");
    requireCondition(!c.generated && !c.identity, "UNREVIEWED_GENERATED_COLUMN");
  }
}
export function projection(columns: Column[]) {
  return columns.map(c => `${AUTH_COLUMNS[`${c.schema}.${c.table}.${c.column}`] ?? identifier(c.column)} AS ${identifier(c.column)}`).join(",");
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function exactKeys(value: unknown, keys: string): asserts value is Record<string, unknown> {
  requireCondition(record(value) && Object.keys(value).sort().join(",") === keys.split(",").sort().join(","), "DESIGN_TOKEN_STRUCTURE_REVIEW_REQUIRED");
}
// Only this persisted presentation field uses "tokens" for design, not authentication.
// Check exact shape and bounded design values, then retain the ordinary recursive scan.
export function inspectRow(value: Record<string, unknown>, media: Set<string>, schema: string, table: string) {
  if(schema==='pubquiz'&&table==='bingo_term_sets'){
    const config=parseTermSet(value.config);if(config.version===2)requireCondition(value.config_hash===sha256(canonical(config)),'MATCHING_CONFIG_CHECKSUM_REQUIRED');
  }
  if(schema==='pubquiz'&&table==='bingo_matching_assets'){
    exactKeys(value,'id,game_id,source_question_id,source_media_id,source_revision,kind,variant,content_type,sha256,answers,content,created_at');
    requireCondition(Array.isArray(value.answers)&&value.answers.every(a=>record(a)&&Object.keys(a).sort().join()==='key,label,text'&&typeof a.key==='string'&&typeof a.label==='string'&&typeof a.text==='string'&&a.text.trim()),'MATCHING_ANSWERS_STRUCTURE_REQUIRED');
    requireCondition(typeof value.id==='string'&&/^[a-f0-9-]{36}$/i.test(value.id)&&typeof value.game_id==='string'&&/^[a-f0-9-]{36}$/i.test(value.game_id)&&Number.isSafeInteger(value.source_question_id)&&Number(value.source_question_id)>0&&Number.isSafeInteger(value.source_media_id)&&Number(value.source_media_id)>0&&typeof value.source_revision==='string'&&/^[a-f0-9]{64}$/.test(value.source_revision),'MATCHING_ASSET_STRUCTURE_REQUIRED');
    // collectSnapshot derives this compact proof from bytea in PostgreSQL. The dump
    // retains every byte; restored bytes are hashed again, not trusted from a stored hash.
    let proof:Record<string,unknown>;
    if(typeof value.content==='string'&&/^\\x(?:[a-f0-9]{2})+$/.test(value.content)){const bytes=Buffer.from(value.content.slice(2),'hex');proof={size:bytes.length,sha256:sha256(bytes),signature:bytes.subarray(0,12).toString('hex')};}
    else{exactKeys(value.content,'size,sha256,signature');proof=value.content;}
    const limits:Record<string,number>={AUDIO:25*1024*1024,IMAGE:10*1024*1024,VIDEO:100*1024*1024};
    requireCondition(Number.isSafeInteger(proof.size)&&Number(proof.size)>0&&Number(proof.size)<=limits[String(value.kind)]&&value.sha256===proof.sha256&&typeof proof.signature==='string'&&/^(?:[a-f0-9]{2}){1,12}$/.test(proof.signature),'MATCHING_ASSET_CHECKSUM_REQUIRED');
    requireCondition(matchingContentType(Buffer.from(proof.signature as string,'hex'),String(value.kind))===value.content_type,'MATCHING_ASSET_FORMAT_REQUIRED');
    requireCondition(typeof value.content_type==='string'&&({AUDIO:['audio/mpeg','audio/mp4','audio/wav','audio/ogg'],IMAGE:['image/png','image/jpeg','image/webp'],VIDEO:['video/mp4','video/webm']} as Record<string,string[]>)[String(value.kind)]?.includes(value.content_type),'MATCHING_ASSET_FORMAT_REQUIRED');
    // Binary bytes are retained and hashed, not mistaken for text or an external URL.
    const {content:_content,...rest}=value;void _content;inspectValue(rest,media);return;
  }
  if(schema==="pubquiz"&&table==="bingo_event_rounds")parseRoundSnapshot(value.round_snapshot);
  if(schema==="pubquiz"&&table==="bingo_live_events"&&value.event_round_id!=null)parseEventEnvelope(value.command);
  if (schema === "pubquiz" && table === "bingo_live_runs") {
    const design = parseSharedDesign(value.design_snapshot);
    requireCondition(design !== null, "DESIGN_TOKEN_STRUCTURE_REVIEW_REQUIRED");
    const assets = parseLiveAssets(value.visual_assets);
    const { design_snapshot: _snapshot, visual_assets: _assets, ...rest } = value;
    void _snapshot;
    void _assets;
    inspectValue([assets.display.name, assets.body.name, assets.logo?.name ?? null, assets.background?.name ?? null], media);
    inspectValue(rest, media);
    inspectValue({ version: design.version, templateId: design.templateId, name: design.name }, media);
    return inspectRow({ theme_config_json: design.config }, new Set<string>(), "pubquiz", "presentation_templates");
  }
  if (schema === "pubquiz" && (table === "bingo_card_series" || table === "bingo_print_versions")) {
    const snapshotField=table==='bingo_card_series'?'print_snapshot':'snapshot';
    const snapshot = parsePrintSnapshot(value[snapshotField]);
    const { [snapshotField]: _snapshot, ...rest } = value;
    void _snapshot;
    inspectValue(rest, media);
    inspectValue({ title: snapshot.title, roundLabel: snapshot.roundLabel, name: snapshot.design.name, templateId: snapshot.design.templateId, displayName: snapshot.display.name, bodyName: snapshot.body.name, logoName: snapshot.logo?.name ?? null }, media);
    if(snapshot.version===4)inspectValue({codeFont:snapshot.codeFont.name,templateSource:snapshot.templateSource??null},media);
    if(snapshot.version===3||snapshot.version===4)inspectValue({textFont:snapshot.text.name,terms:snapshot.terms},media);
    // Exact version/shape, canonical base64 and checksums have been checked above.
    // Frozen binary assets are carried in the dump itself; design references retain
    // the existing media inventory rules rather than granting arbitrary URL access.
    // Source references remain strictly validated, but frozen logo/font bytes are
    // already in this row. Do not make its backup depend on an old source URL
    // still existing; print v1 does not render the scene background image.
    return inspectRow({ theme_config_json: snapshot.design.config }, new Set<string>(), "pubquiz", "presentation_templates");
  }
  if (schema === "pubquiz" && table === "bingo_cards") decodeCard(value.cells);
  if (schema === "pubquiz" && table === "quiz" && value.shared_design_snapshot != null) {
    const snapshot=parseQuizDesignSnapshot(value.shared_design_snapshot);
    requireCondition(snapshot !== null, "DESIGN_TOKEN_STRUCTURE_REVIEW_REQUIRED");
    const { shared_design_snapshot: _snapshot, ...rest }=value;
    void _snapshot;
    inspectValue(rest,media);
    inspectValue({version:snapshot.version,templateId:snapshot.design.templateId,name:snapshot.design.name,answerId:snapshot.answerForm.id,answerName:snapshot.answerForm.name},media);
    inspectRow({theme_config_json:snapshot.answerForm.config},media,"pubquiz","presentation_templates");
    return inspectRow({theme_config_json:snapshot.design.config},media,"pubquiz","presentation_templates");
  }
  if (schema !== "pubquiz" || table !== "presentation_templates") return inspectValue(value, media);
  const { theme_config_json: config, ...rest } = value;
  requireCondition(record(config) && config.version === 1, "DESIGN_TOKEN_STRUCTURE_REVIEW_REQUIRED");
  const { tokens, ...configRest } = config;
  exactKeys(tokens, "colors,typography,radii,spacing,assets");
  // The application supports legacy palettes without `correct` (derived at render time
  // from warning). Preserve the original backup row; do not normalize or add a color.
  const paletteKeys = "primary,secondary,accent,background,surface,surfaceStrong,text,textMuted,border,success,warning,danger";
  exactKeys(tokens.colors, paletteKeys + (record(tokens.colors) && Object.hasOwn(tokens.colors, "correct") ? ",correct" : ""));
  requireCondition(Object.values(tokens.colors).every(v => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v)), "DESIGN_TOKEN_VALUE_REVIEW_REQUIRED");
  exactKeys(tokens.typography, "family,displayWeight,bodyWeight" + (record(tokens.typography) && Object.hasOwn(tokens.typography,"displayFamily") ? ",displayFamily" : ""));
  const typography = tokens.typography;
  requireCondition(brandFontOptions.some(f => f.value === typography.family) &&
    (typography.displayFamily === undefined || brandFontOptions.some(f=>f.value===typography.displayFamily)) &&
    typeof typography.displayWeight === "number" && [400, 700, 800, 900].includes(typography.displayWeight) &&
    typeof typography.bodyWeight === "number" && [400, 500, 600].includes(typography.bodyWeight), "DESIGN_TOKEN_VALUE_REVIEW_REQUIRED");
  for (const group of ["radii", "spacing"] as const) {
    exactKeys(tokens[group], "small,medium,large");
    requireCondition(Object.values(tokens[group]).every(v => typeof v === "string" && /^(0\.5|0\.75|1|1\.5|2|2\.5)rem$/.test(v)), "DESIGN_TOKEN_VALUE_REVIEW_REQUIRED");
  }
  exactKeys(tokens.assets, "logo,backgroundImage");
  requireCondition(Object.values(tokens.assets).every(v => v === null || isSafeTemplateAssetReference(v)), "DESIGN_TOKEN_VALUE_REVIEW_REQUIRED");
  inspectValue(rest, media); inspectValue(configRest, media); inspectValue(tokens, media);
}
// Review persisted JSON/string values before any pg_dump. Never print offending content.
export function inspectValue(value: unknown, media: Set<string>, key = "") {
  if (value === null || value === "" || typeof value === "boolean" || typeof value === "number") return;
  requireCondition(!/(password|passwort|secret|token|credential|api_?key|authorization|private_?key)/i.test(key), "EMBEDDED_SECRET_REVIEW_REQUIRED");
  if (Array.isArray(value)) { for (const item of value) inspectValue(item, media); return; }
  if (value && typeof value === "object") { for (const [k, v] of Object.entries(value)) inspectValue(v, media, k); return; }
  if (typeof value !== "string") return;
  requireCondition(!/vercel_blob_rw_|-----BEGIN .*PRIVATE KEY|\$2[aby]\$\d\d\$|(?:postgres(?:ql)?):\/\/|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(value), "EMBEDDED_CREDENTIAL_REVIEW_REQUIRED");
  for (const match of value.matchAll(/https?:\/\/[^\s<>"'\\)]+/g)) {
    const url = new URL(match[0]);
    requireCondition(!url.username && !url.password && ![...url.searchParams.keys()].some(k => /token|secret|signature|api.?key|password/i.test(k)), "SIGNED_URL_REVIEW_REQUIRED");
    if (url.hostname.endsWith(".blob.vercel-storage.com")) {
      requireCondition(url.protocol === "https:" && !url.port && !url.search && !url.hash &&
        url.hostname === "bix6h2j23vjzi240.public.blob.vercel-storage.com", "MEDIA_SOURCE_REVIEW_REQUIRED");
      media.add(url.toString());
    } else if (/(image|photo|foto|bild|audio|video|media|medien)/i.test(key)) {
      requireCondition(false, "EXTERNAL_MEDIA_REVIEW_REQUIRED");
    }
  }
  if (/^\s*[{[]/.test(value)) {
    let parsed: unknown;
    try { parsed = JSON.parse(value); } catch { return; }
    inspectValue(parsed, media);
  }
}
