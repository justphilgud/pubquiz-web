import { Prisma, type PrismaClient } from "@/app/generated/prisma/client";
import { getActorPermissions } from "@/app/roles/roleAssignments.server";
import { normalizeCategoryComparisonKey } from "../../editor/categoryPolicy";
import { classicAnswerContent, findStandardAnswerType, newQuestionContent, questionCategoryConnections } from "../../editor/questionCreationPersistence";
import { canUseQuestionScope } from "../../editor/questionScopePolicy";
import { DraftValidationError } from "../../editor/questionValidation";
import { questionTemplateIds } from "../../editor/templates/questionTemplateRegistry";
import type { ConfirmResult, ImportQuestion, ImportReceipt, ImportTarget, Issue, PreviewResult } from "./format";
import { findImportDuplicates } from "./importDuplicates";
import { batchContentDigest, planDigest, signPlan, toDraft, verifyPlan, type ResolvedQuestion } from "./importPlan";
import { parseImport } from "./parseImport";

class ImportError extends Error {
  constructor(readonly issues: Issue[]) {
    super("Excel-Fragenimport abgebrochen");
  }
}

function fileIssue(message: string): Issue {
  return { sheet: "Datei", field: "Import", message };
}

async function authorizedActor(db: Prisma.TransactionClient, actorId: number, target: ImportTarget, lock = false) {
  const actor = await getActorPermissions(actorId, db);
  if (!canUseQuestionScope(actor, target.scope, target.eventSeriesIds)) {
    throw new ImportError([{ sheet: "Zielbereich", field: "Eventreihe", message: "Für diesen Zielbereich fehlt die Anlagerechtigung." }]);
  }
  if (target.scope === "EVENT_SERIES") {
    const active = lock
      ? (await db.$queryRaw<{ eventreihe_id: number }[]>`
        SELECT eventreihe_id FROM pubquiz.eventreihen
        WHERE eventreihe_id IN (${Prisma.join(target.eventSeriesIds)}) AND NOT ist_archiviert FOR SHARE
      `).length
      : await db.eventreihen.count({ where: { eventreihe_id: { in: target.eventSeriesIds }, ist_archiviert: false } });
    if (active !== target.eventSeriesIds.length) {
      throw new ImportError([{ sheet: "Zielbereich", field: "Eventreihe", message: "Mindestens eine Eventreihe ist ungültig oder archiviert." }]);
    }
  }
  return actor;
}

async function resolveQuestions(db: Prisma.TransactionClient, questions: ImportQuestion[], lock = false) {
  const categories = questions.some(question => question.categories.length)
    ? await db.fragenkategorie.findMany({
      where: { status: "ACTIVE" },
      select: { fragenkategorie_id: true, kategorie: true },
    }) : [];
  const byName = new Map<string, typeof categories>();
  for (const category of categories) {
    const key = normalizeCategoryComparisonKey(category.kategorie, "de-DE");
    const matches = byName.get(key) ?? [];
    matches.push(category);
    byName.set(key, matches);
  }
  const errors: Issue[] = [];
  const resolved = questions.map(question => {
    const categoryIds: number[] = [];
    const resolvedCategories: string[] = [];
    for (const name of question.categories) {
      const matches = byName.get(normalizeCategoryComparisonKey(name, "de-DE"));
      if (matches?.length === 1) {
        categoryIds.push(matches[0].fragenkategorie_id);
        resolvedCategories.push(matches[0].kategorie);
      } else {
        errors.push({ sheet: "Fragen", row: question.row, field: "Kategorien", message: matches?.length
          ? `„${name}“ ist als aktiver Kategoriename mehrdeutig.`
          : `„${name}“ ist keine vorhandene aktive Kategorie.` });
      }
    }
    return { ...question, categoryIds, resolvedCategories };
  });
  const selected = [...new Set(resolved.flatMap(question => question.categoryIds))];
  if (lock && selected.length) {
    const locked = await db.$queryRaw<{ fragenkategorie_id: number; kategorie: string }[]>`
      SELECT fragenkategorie_id, kategorie FROM pubquiz.fragenkategorie
      WHERE fragenkategorie_id IN (${Prisma.join(selected)}) AND status = 'ACTIVE' FOR SHARE
    `;
    const names = new Map(locked.map(row => [row.fragenkategorie_id, row.kategorie]));
    for (const question of resolved) {
      if (question.categoryIds.some((id, index) => names.get(id) !== question.resolvedCategories[index])) {
        errors.push({ sheet: "Fragen", row: question.row, field: "Kategorien", message: "Eine Kategorie hat sich geändert. Bitte erneut prüfen." });
      }
    }
  }
  return { errors, questions: resolved };
}

function validateDrafts(questions: ResolvedQuestion[], target: ImportTarget) {
  const drafts: ReturnType<typeof toDraft>[] = [];
  const errors: Issue[] = [];
  for (const question of questions) {
    try {
      drafts.push(toDraft(question, target));
    } catch (error) {
      if (!(error instanceof DraftValidationError)) throw error;
      const fields = { answers: "Fragekürzel", questionText: "Fragetext", validUntil: "Veraltet ab", reviewFrom: "Prüfen ab", categories: "Kategorien" };
      const target = error.validationTarget;
      const field = target && target in fields ? fields[target as keyof typeof fields] : "Fragetext";
      errors.push({ sheet: "Fragen", row: question.row, field, message: error.message });
    }
  }
  return { errors, drafts };
}

export function readImport(bytes: Buffer) {
  try {
    return parseImport(bytes);
  } catch {
    throw new ImportError([fileIssue("Die XLSX-Datei ist beschädigt, unzulässig oder überschreitet die Dateigrenzen.")]);
  }
}

export async function previewImport(
  db: PrismaClient, actorId: number, target: ImportTarget, bytes: Buffer, secret: string,
): Promise<PreviewResult> {
  try {
    const actor = await authorizedActor(db, actorId, target);
    const parsed = readImport(bytes);
    const resolved = await resolveQuestions(db, parsed.questions);
    const errors = [...parsed.errors, ...resolved.errors];
    const warnings = parsed.warnings;
    if (!parsed.errors.length) errors.push(...validateDrafts(resolved.questions, target).errors);
    if (!errors.length) {
      const duplicates = await findImportDuplicates(db, actor, target, resolved.questions, true);
      errors.push(...duplicates.errors);
      warnings.push(...duplicates.warnings);
      const previouslyImported = await db.excel_question_import_receipts.findFirst({
        where: { actor_id: actorId, content_digest: batchContentDigest(target, resolved.questions) }, select: { request_id: true },
      });
      if (previouslyImported && !duplicates.errors.length) errors.push(fileIssue("Diese Fragen wurden bereits gemeinsam in diesem Zielbereich importiert."));
    }
    return {
      questions: parsed.questions.map((question, index) => ({
        ...question, resolvedCategories: resolved.questions[index].resolvedCategories,
      })), errors, warnings,
      ...(!errors.length ? { token: signPlan(actorId, planDigest(target, resolved.questions), secret) } : {}),
    };
  } catch (error) {
    if (error instanceof ImportError) return { questions: [], warnings: [], errors: error.issues };
    throw error;
  }
}

export async function confirmImport(
  db: PrismaClient, actorId: number, target: ImportTarget, bytes: Buffer, token: string, secret: string,
): Promise<ConfirmResult> {
  const plan = verifyPlan(token, actorId, secret);
  if (!plan) return { ok: false, errors: [fileIssue("Die Bestätigung ist ungültig. Bitte die Datei erneut prüfen.")] };
  try {
    const parsed = readImport(bytes);
    if (parsed.errors.length) return { ok: false, errors: parsed.errors };
    const questions = await db.$transaction(async tx => {
      // Serialize import commits so even different preview IDs cannot race the duplicate check.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(114611181, 1)::text`;
      const actor = await authorizedActor(tx, actorId, target, true);
      const resolved = await resolveQuestions(tx, parsed.questions, true);
      if (resolved.errors.length) throw new ImportError(resolved.errors);
      const digest = planDigest(target, resolved.questions);
      if (digest !== plan.digest) throw new ImportError([fileIssue("Datei, Zielbereich oder Kategorien haben sich geändert. Bitte erneut prüfen.")]);
      const receipt = await tx.excel_question_import_receipts.findUnique({
        where: { actor_id_request_id: { actor_id: actorId, request_id: plan.requestId } },
      });
      if (receipt) {
        if (receipt.plan_digest !== digest) throw new ImportError([fileIssue("Diese Bestätigung gehört zu einem anderen Import.")]);
        return receipt.result_json as ImportReceipt;
      }
      if (plan.expires < Date.now()) throw new ImportError([fileIssue("Die Vorschau ist abgelaufen. Bitte die Datei erneut prüfen.")]);
      const contentDigest = batchContentDigest(target, resolved.questions);
      const previousBatch = await tx.excel_question_import_receipts.findFirst({
        where: { actor_id: actorId, content_digest: contentDigest }, select: { plan_digest: true, result_json: true },
      });
      if (previousBatch) {
        if (previousBatch.plan_digest === digest) return previousBatch.result_json as ImportReceipt;
        throw new ImportError([fileIssue("Diese Fragen wurden bereits gemeinsam in diesem Zielbereich importiert.")]);
      }
      const duplicates = await findImportDuplicates(tx, actor, target, resolved.questions, false);
      if (duplicates.errors.length) throw new ImportError(duplicates.errors);
      const { errors, drafts } = validateDrafts(resolved.questions, target);
      if (errors.length) throw new ImportError(errors);
      const standard = drafts.some(draft => draft.answers.length) ? await findStandardAnswerType(tx) : null;
      if (!standard && drafts.some(draft => draft.answers.length)) throw new ImportError([fileIssue("Der Standard-Antworttyp ist nicht konfiguriert.")]);
      const pairs = drafts.some(draft => draft.templateId === questionTemplateIds.pairs)
        ? await tx.frage_vorlagen.findUnique({ where: { code: questionTemplateIds.pairs }, select: { vorlage_id: true } }) : null;
      if (!pairs && drafts.some(draft => draft.templateId === questionTemplateIds.pairs)) {
        throw new ImportError([fileIssue("Die Vorlage „Paare bilden“ ist in dieser Umgebung nicht verfügbar.")]);
      }
      const result: ImportReceipt = [];
      for (const [index, draft] of drafts.entries()) {
        const question = resolved.questions[index];
        try {
          const { fragen_id: id } = await tx.fragen.create({
            data: {
              ...newQuestionContent(draft, target, actorId, draft.templateId ? pairs!.vorlage_id : null),
              review_status: "DRAFT", freigegeben: false, ist_unfertig: true,
              fragen_kategorien: { create: questionCategoryConnections(draft.categoryIds) },
            },
            select: { fragen_id: true },
          });
          if (standard && draft.answers.length) {
            // PostgreSQL allocates answer IDs in VALUES order.
            await tx.antworten.createMany({
              data: draft.answers.map(answer => classicAnswerContent(id, answer, standard.antworttyp_id)),
            });
          }
          result.push({ id, key: question.key, text: draft.questionText });
        } catch (error) {
          console.error("Excel-Fragenimport: Transaktion abgebrochen", error instanceof Error ? error.name : "DatabaseError");
          throw new ImportError([{ sheet: "Fragen", row: question.row, field: "Fragetext", message: "Speichern fehlgeschlagen. Es wurden keine Fragen aus der Datei angelegt." }]);
        }
      }
      await tx.excel_question_import_receipts.create({
        data: { actor_id: actorId, request_id: plan.requestId, plan_digest: digest, content_digest: contentDigest, result_json: result },
      });
      return result;
    }, { maxWait: 10_000, timeout: 60_000 });
    return { ok: true, questions };
  } catch (error) {
    if (error instanceof ImportError) return { ok: false, errors: error.issues };
    throw error;
  }
}
