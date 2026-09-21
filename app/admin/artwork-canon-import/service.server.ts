import "server-only";

import { createHash } from "node:crypto";
import { get, put } from "@vercel/blob";
import sharp from "sharp";
import catalogueFile from "@/data/artworks/artwork-canon-200.json";
import { prisma } from "@/app/lib/prisma";
import { buildQuestionMediaPathname } from "@/app/fragen/editor/questionMedia";
import { getMediaVerificationServerConfig } from "@/app/fragen/editor/mediaUploadEnvironment";
import { getLogicalEnvironment } from "@/config/environment";

const QUESTION_TEXT = "Von welchem Künstler stammt dieses Kunstwerk und wie heißt es?";
const SOURCE_MARKER = "ARTWORK_CANON_V1";
const LEGACY_CATEGORY = "Kunstwerk E2E 2026-09-21";
const CLEANUP_CONFIRMATION = "DELETE_EXACT_ARTWORK_E2E_QUESTIONS_109_110";

type CatalogueWork = {
  catalogueNumber: number;
  status: "bereits vorhanden" | "neu";
  wikidataId: string;
  wikidataUrl: string;
  artist: { wikidataId: string; name: string };
  title: string;
  alternativeTitles: string[];
  year: number;
  yearLabel: string;
  collection: { wikidataId: string; name: string };
  commons: {
    pageUrl: string;
    pageTitle: string;
    license: string;
  };
  importMedia?: {
    sourceUrl: string;
    sourceMime: string;
    sourceBytes: number;
    sourceWidth: number;
    sourceHeight: number;
    sourceSha256: string;
    outputMime: "image/webp";
    outputBytes: number;
    outputWidth: number;
    outputHeight: number;
    outputSha256: string;
  };
};

const catalogue = (catalogueFile as { works: CatalogueWork[] }).works;
const newWorks = catalogue.filter((work) => work.status === "neu");

function assertPreviewOnly() {
  if (process.env.VERCEL_ENV !== "preview" || getLogicalEnvironment() !== "preview") {
    throw new Error("ARTWORK_IMPORT_PREVIEW_ONLY");
  }
  const config = getMediaVerificationServerConfig();
  if (config.environment !== "preview" || config.environmentPrefix !== "preview") {
    throw new Error("ARTWORK_IMPORT_MEDIA_ENVIRONMENT_MISMATCH");
  }
  return config;
}

function parseQid(source: string | null) {
  return source?.match(/ARTWORK_CANON_V1;QID=(Q\d+);/)?.[1] ?? null;
}

function hasSolution(question: ArtworkQuestion, fieldLabel: string, solution: string) {
  return question.antwortfelder.some((field) =>
    field.label === fieldLabel && field.loesungen.some((entry) => entry.loesung_text === solution),
  );
}

type ArtworkQuestion = Awaited<ReturnType<typeof loadArtworkQuestions>>[number];

async function loadArtworkQuestions() {
  return prisma.fragen.findMany({
    where: { vorlage: { code: "kunstwerk" }, ist_archiviert: false },
    orderBy: { fragen_id: "asc" },
    select: {
      fragen_id: true,
      frage: true,
      quelle: true,
      geltungsbereich: true,
      vorlage_id: true,
      source_vorlage_id: true,
      template_config_json: true,
      ist_unfertig: true,
      freigegeben: true,
      review_status: true,
      created_by_user_id: true,
      last_modified_by_user_id: true,
      approved_by_user_id: true,
      approved_at: true,
      reviewed_by_user_id: true,
      reviewed_at: true,
      fragen_kategorien: {
        select: {
          fragenkategorie_id: true,
          fragenkategorie: { select: { kategorie: true } },
        },
      },
      medien: {
        orderBy: [{ sortierung: "asc" }, { medien_id: "asc" }],
        select: { medien_id: true, datei: true, medientyp_id: true, slot_key: true, sortierung: true },
      },
      antwortfelder: {
        orderBy: [{ sortierung: "asc" }, { antwortfeld_id: "asc" }],
        select: {
          label: true,
          sortierung: true,
          ist_pflicht: true,
          loesungen: {
            orderBy: [{ sortierung: "asc" }, { loesung_id: "asc" }],
            select: { loesung_text: true, sortierung: true, ist_akzeptiert: true, zusatzinformation: true },
          },
        },
      },
    },
  });
}

function findReference(questions: ArtworkQuestion[]) {
  return questions.find((question) =>
    question.frage === QUESTION_TEXT &&
    hasSolution(question, "Künstler", "Leonardo da Vinci") &&
    question.antwortfelder.some((field) =>
      field.label === "Titel" && field.loesungen.some((entry) => entry.loesung_text.startsWith("Mona Lisa")),
    ),
  ) ?? null;
}

function describeLegacy(question: ArtworkQuestion) {
  const artist = question.antwortfelder.find((field) => field.label === "Künstler")?.loesungen[0]?.loesung_text ?? "";
  const title = question.antwortfelder.find((field) => field.label === "Titel")?.loesungen[0]?.loesung_text ?? "";
  return { questionId: question.fragen_id, artist, title, categories: question.fragen_kategorien.map((entry) => entry.fragenkategorie.kategorie) };
}

export async function getArtworkImportStatus() {
  assertPreviewOnly();
  const questions = await loadArtworkQuestions();
  const reference = findReference(questions);
  const imported = questions.flatMap((question) => {
    const qid = parseQid(question.quelle);
    return qid ? [{ question, qid }] : [];
  });
  const legacy = questions.filter((question) => question.fragen_id !== reference?.fragen_id && !parseQid(question.quelle));
  const importedIds = new Set(imported.map((entry) => entry.qid));
  const remaining = newWorks.filter((work) => !importedIds.has(work.wikidataId));
  return {
    environment: "preview" as const,
    questionText: QUESTION_TEXT,
    reference: reference ? { questionId: reference.fragen_id, untouched: true } : null,
    totalArtworkQuestions: questions.length,
    imported: imported.length,
    remaining: remaining.length,
    next: remaining[0] ? { wikidataId: remaining[0].wikidataId, artist: remaining[0].artist.name, title: remaining[0].title } : null,
    legacy: legacy.map(describeLegacy),
    cleanupConfirmation: legacy.length ? CLEANUP_CONFIRMATION : null,
    readyToImport: Boolean(reference) && legacy.length === 0,
    complete: Boolean(reference) && legacy.length === 0 && imported.length === 199 && questions.length === 200,
  };
}

function verifyReference(reference: ArtworkQuestion | null) {
  if (!reference) throw new Error("ARTWORK_IMPORT_MONA_REFERENCE_MISSING");
  if (
    reference.frage !== QUESTION_TEXT ||
    reference.antwortfelder.length !== 2 ||
    reference.medien.length !== 1 ||
    reference.medien[0].slot_key !== "question_image" ||
    !reference.created_by_user_id ||
    !reference.vorlage_id ||
    !reference.freigegeben ||
    reference.review_status !== "APPROVED"
  ) {
    throw new Error("ARTWORK_IMPORT_MONA_REFERENCE_INVALID");
  }
  const labels = reference.antwortfelder.map((field) => field.label).sort();
  if (labels.join("|") !== "Künstler|Titel") throw new Error("ARTWORK_IMPORT_MONA_ANSWER_STRUCTURE_INVALID");
  return reference;
}

function buildSource(work: CatalogueWork) {
  return [
    `${SOURCE_MARKER};QID=${work.wikidataId};`,
    `Wikidata: ${work.wikidataUrl}`,
    `Commons: ${work.commons.pageUrl}`,
    `Lizenz: ${work.commons.license}`,
    `Sammlung: ${work.collection.name}`,
    `Jahr: ${work.yearLabel}`,
  ].join(" | ");
}

async function prepareAndUpload(work: CatalogueWork) {
  const config = assertPreviewOnly();
  const expected = work.importMedia;
  if (!expected) throw new Error(`ARTWORK_IMPORT_MEDIA_MANIFEST_MISSING:${work.wikidataId}`);
  const response = await fetch(expected.sourceUrl, {
    headers: { "user-agent": "PubQuiz artwork canon preview import/1.0 (https://github.com/justphilgud/pubquiz-web)" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`ARTWORK_IMPORT_SOURCE_HTTP_${response.status}:${work.wikidataId}`);
  const source = Buffer.from(await response.arrayBuffer());
  const sourceHash = createHash("sha256").update(source).digest("hex");
  const responseMime = response.headers.get("content-type")?.split(";", 1)[0]?.toLowerCase();
  if (responseMime !== expected.sourceMime || source.length !== expected.sourceBytes) {
    throw new Error(`ARTWORK_IMPORT_SOURCE_METADATA_MISMATCH:${work.wikidataId}`);
  }
  if (sourceHash !== expected.sourceSha256) throw new Error(`ARTWORK_IMPORT_SOURCE_HASH_MISMATCH:${work.wikidataId}`);
  const sourceMetadata = await sharp(source, { failOn: "warning" }).metadata();
  if (sourceMetadata.width !== expected.sourceWidth || sourceMetadata.height !== expected.sourceHeight) {
    throw new Error(`ARTWORK_IMPORT_SOURCE_DIMENSION_MISMATCH:${work.wikidataId}`);
  }
  const output = await sharp(source, { failOn: "warning" })
    .rotate()
    .resize({ width: 2560, height: 2560, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 88, effort: 4, smartSubsample: true })
    .toBuffer({ resolveWithObject: true });
  if (output.data.length > 10 * 1024 * 1024) throw new Error(`ARTWORK_IMPORT_OUTPUT_TOO_LARGE:${work.wikidataId}`);
  const outputHash = createHash("sha256").update(output.data).digest("hex");
  if (
    output.data.length !== expected.outputBytes ||
    output.info.width !== expected.outputWidth ||
    output.info.height !== expected.outputHeight ||
    outputHash !== expected.outputSha256
  ) throw new Error(`ARTWORK_IMPORT_OUTPUT_MANIFEST_MISMATCH:${work.wikidataId}`);
  const pathname = buildQuestionMediaPathname("preview", "QUESTION", "IMAGE", "question_image", `artwork-canon-v1-${work.wikidataId.toLowerCase()}.webp`);
  const blob = await put(pathname, output.data, {
    ...config.blobAuthentication,
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "image/webp",
  });
  if (blob.pathname !== pathname) throw new Error(`ARTWORK_IMPORT_BLOB_PATH_MISMATCH:${work.wikidataId}`);
  const readback = await get(blob.url, { ...config.blobAuthentication, access: "public" });
  if (!readback || readback.statusCode !== 200 || readback.blob.pathname !== pathname) throw new Error(`ARTWORK_IMPORT_READBACK_FAILED:${work.wikidataId}`);
  const readbackBytes = Buffer.from(await new Response(readback.stream).arrayBuffer());
  const readbackHash = createHash("sha256").update(readbackBytes).digest("hex");
  if (outputHash !== readbackHash || readbackBytes.length !== output.data.length) throw new Error(`ARTWORK_IMPORT_READBACK_HASH_MISMATCH:${work.wikidataId}`);
  const readbackMetadata = await sharp(readbackBytes, { failOn: "warning" }).metadata();
  if (readbackMetadata.width !== output.info.width || readbackMetadata.height !== output.info.height) throw new Error(`ARTWORK_IMPORT_READBACK_DIMENSION_MISMATCH:${work.wikidataId}`);
  return { url: blob.url, pathname, bytes: readbackBytes.length, width: output.info.width, height: output.info.height, sha256: readbackHash };
}

export async function importNextArtwork() {
  const status = await getArtworkImportStatus();
  if (!status.readyToImport) throw new Error("ARTWORK_IMPORT_PREFLIGHT_BLOCKED");
  if (!status.next) return { imported: false, status };
  const work = newWorks.find((candidate) => candidate.wikidataId === status.next?.wikidataId);
  if (!work) throw new Error("ARTWORK_IMPORT_CATALOGUE_MISMATCH");
  const questions = await loadArtworkQuestions();
  const reference = verifyReference(findReference(questions));
  const media = await prepareAndUpload(work);
  const source = buildSource(work);

  const result = await prisma.$transaction(async (tx) => {
    const duplicate = await tx.fragen.findFirst({ where: { quelle: { contains: `${SOURCE_MARKER};QID=${work.wikidataId};` } }, select: { fragen_id: true } });
    if (duplicate) return { questionId: duplicate.fragen_id, created: false };
    const created = await tx.fragen.create({
      data: {
        frage: reference.frage,
        quelle: source,
        geltungsbereich: reference.geltungsbereich,
        vorlage_id: reference.vorlage_id,
        source_vorlage_id: reference.source_vorlage_id,
        template_config_json: reference.template_config_json ?? undefined,
        ist_archiviert: false,
        ist_unfertig: false,
        freigegeben: true,
        review_status: "APPROVED",
        created_by_user_id: reference.created_by_user_id,
        last_modified_by_user_id: reference.last_modified_by_user_id ?? reference.created_by_user_id,
        approved_by_user_id: reference.approved_by_user_id,
        approved_at: new Date(),
        reviewed_by_user_id: reference.reviewed_by_user_id ?? reference.approved_by_user_id,
        reviewed_at: new Date(),
        fragen_kategorien: { create: reference.fragen_kategorien.map((entry) => ({ fragenkategorie_id: entry.fragenkategorie_id })) },
      },
      select: { fragen_id: true },
    });
    await tx.medien.create({
      data: { fragen_id: created.fragen_id, antwort_id: null, antwortfeld_id: null, medientyp_id: reference.medien[0].medientyp_id, datei: media.url, slot_key: "question_image", sortierung: 1 },
    });
    const referenceArtistField = reference.antwortfelder.find((field) => field.label === "Künstler")!;
    const referenceTitleField = reference.antwortfelder.find((field) => field.label === "Titel")!;
    const artistField = await tx.frage_antwortfelder.create({ data: { fragen_id: created.fragen_id, label: "Künstler", sortierung: referenceArtistField.sortierung, ist_pflicht: referenceArtistField.ist_pflicht } });
    const titleField = await tx.frage_antwortfelder.create({ data: { fragen_id: created.fragen_id, label: "Titel", sortierung: referenceTitleField.sortierung, ist_pflicht: referenceTitleField.ist_pflicht } });
    await tx.frage_antwortfeld_loesungen.create({ data: { antwortfeld_id: artistField.antwortfeld_id, loesung_text: work.artist.name, sortierung: 1, ist_akzeptiert: true } });
    const titleSolutions = [work.title, ...work.alternativeTitles.filter((title) => title !== work.title)];
    await tx.frage_antwortfeld_loesungen.createMany({ data: titleSolutions.map((title, index) => ({ antwortfeld_id: titleField.antwortfeld_id, loesung_text: title, sortierung: index + 1, ist_akzeptiert: true })) });
    return { questionId: created.fragen_id, created: true };
  });
  return { imported: result.created, questionId: result.questionId, work: { wikidataId: work.wikidataId, artist: work.artist.name, title: work.title }, media, status: await getArtworkImportStatus() };
}

export async function deleteExactLegacyE2eQuestions(confirmation: string) {
  assertPreviewOnly();
  if (confirmation !== CLEANUP_CONFIRMATION) throw new Error("ARTWORK_IMPORT_CLEANUP_CONFIRMATION_INVALID");
  const questions = await loadArtworkQuestions();
  const reference = findReference(questions);
  const legacy = questions.filter((question) => question.fragen_id !== reference?.fragen_id && !parseQid(question.quelle));
  const described = legacy.map(describeLegacy);
  const expected = [
    { questionId: 109, artist: "Vincent van Gogh", title: "Sternennacht" },
    { questionId: 110, artist: "Edvard Munch", title: "Der Schrei" },
  ];
  if (described.length !== expected.length || expected.some((item) => !described.some((question) =>
    question.questionId === item.questionId && question.artist === item.artist && question.title === item.title && question.categories.length === 1 && question.categories[0] === LEGACY_CATEGORY,
  ))) throw new Error("ARTWORK_IMPORT_LEGACY_SET_MISMATCH");
  await prisma.fragen.deleteMany({ where: { fragen_id: { in: expected.map((item) => item.questionId) } } });
  return getArtworkImportStatus();
}

export async function validateImportedCatalogue() {
  const status = await getArtworkImportStatus();
  const questions = await loadArtworkQuestions();
  const reference = findReference(questions);
  const failures: string[] = [];
  if (!status.complete) failures.push("Der Importbestand ist nicht vollständig.");
  if (!reference) failures.push("Mona Lisa fehlt.");
  const importedByQid = new Map(questions.flatMap((question) => {
    const qid = parseQid(question.quelle);
    return qid ? [[qid, question] as const] : [];
  }));
  for (const work of newWorks) {
    const question = importedByQid.get(work.wikidataId);
    if (!question) { failures.push(`${work.wikidataId}: Frage fehlt.`); continue; }
    if (question.frage !== QUESTION_TEXT || question.medien.length !== 1 || question.medien[0].slot_key !== "question_image") failures.push(`${work.wikidataId}: Grundstruktur weicht ab.`);
    if (!hasSolution(question, "Künstler", work.artist.name) || !hasSolution(question, "Titel", work.title)) failures.push(`${work.wikidataId}: Antwortstruktur weicht ab.`);
    if (!question.quelle?.includes(`Commons: ${work.commons.pageUrl}`) || !question.quelle.includes(`Lizenz: ${work.commons.license}`)) failures.push(`${work.wikidataId}: Provenance fehlt.`);
  }
  return { ok: failures.length === 0, failures, status };
}

export { CLEANUP_CONFIRMATION };
