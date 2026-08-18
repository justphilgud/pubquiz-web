"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { requireQuestionEditor } from "@/app/lib/permissions";
import { getCurrentUserId } from "@/app/services/questionService";
import { getQuestionDeletionBlocker } from "./questionDeletionPolicy";
import { getQuestionActor, mapQuestionAccessContext } from "./questionAccess.server";
import { canApproveScopedQuestion, canCloneScopedQuestion, canEditScopedQuestion } from "./questionScopePolicy";

export type QuestionManagementErrorCode =
  | "QUESTION_NOT_FOUND"
  | "PERMISSION_DENIED"
  | "QUESTION_IN_USE"
  | "QUESTION_HAS_RELATIONS"
  | "QUESTION_HAS_MEDIA"
  | "UNEXPECTED_ERROR";

type ManagementResult =
  | { ok: true; questionId: number }
  | {
      ok: false;
      code: QuestionManagementErrorCode;
    };

const accessSelect = {
  created_by_user_id: true,
  review_status: true,
  ist_archiviert: true,
  freigegeben: true,
  geltungsbereich: true,
  eventreihen: { select: { eventreihe_id: true } },
} as const;

export async function cloneQuestion(questionId: number): Promise<ManagementResult> {
  const session = await requireQuestionEditor();
  if (!Number.isInteger(questionId) || questionId <= 0) {
    return { ok: false, code: "QUESTION_NOT_FOUND" };
  }

  try {
    const source = await prisma.fragen.findUnique({
      where: { fragen_id: questionId },
      select: {
        ...accessSelect,
        frage: true,
        quelle: true,
        fragentyp: true,
        schwierigkeitslevel: true,
        vorlage_id: true,
        source_vorlage_id: true,
        moderationsnotizen: true,
        kategorienwunsch: true,
        gueltig_bis: true,
        template_config_json: true,
        fragen_kategorien: { select: { fragenkategorie_id: true } },
        medien: {
          orderBy: [{ sortierung: "asc" }, { medien_id: "asc" }],
          select: {
            medientyp_id: true,
            datei: true,
            sortierung: true,
            bemerkung: true,
            slot_key: true,
          },
        },
        antworten: {
          orderBy: { antwort_id: "asc" },
          select: {
            antwort: true,
            ist_richtig: true,
            antworttyp_id: true,
            zusatzinformation: true,
            medien: {
              orderBy: [{ sortierung: "asc" }, { medien_id: "asc" }],
              select: {
                medientyp_id: true,
                datei: true,
                sortierung: true,
                bemerkung: true,
                slot_key: true,
              },
            },
          },
        },
        antwortfelder: {
          orderBy: [{ sortierung: "asc" }, { antwortfeld_id: "asc" }],
          select: {
            label: true,
            sortierung: true,
            ist_pflicht: true,
            medien: {
              orderBy: [{ sortierung: "asc" }, { medien_id: "asc" }],
              select: {
                medientyp_id: true,
                datei: true,
                sortierung: true,
                bemerkung: true,
                slot_key: true,
              },
            },
            loesungen: {
              orderBy: [{ sortierung: "asc" }, { loesung_id: "asc" }],
              select: {
                loesung_text: true,
                sortierung: true,
                ist_akzeptiert: true,
                zusatzinformation: true,
              },
            },
          },
        },
      },
    });
    if (!source) return { ok: false, code: "QUESTION_NOT_FOUND" };
    const actor = await getQuestionActor(session);
    if (!canCloneScopedQuestion(actor, mapQuestionAccessContext(source))) {
      return { ok: false, code: "PERMISSION_DENIED" };
    }

    const userId = getCurrentUserId(session);
    const clone = await prisma.fragen.create({
      data: {
        frage: source.frage,
        geltungsbereich: source.geltungsbereich,
        quelle: source.quelle,
        fragentyp: source.fragentyp,
        schwierigkeitslevel: source.schwierigkeitslevel,
        vorlage_id: source.vorlage_id,
        source_vorlage_id: source.source_vorlage_id,
        moderationsnotizen: source.moderationsnotizen,
        kategorienwunsch: source.kategorienwunsch,
        gueltig_bis: source.gueltig_bis,
        template_config_json: source.template_config_json ?? undefined,
        ist_archiviert: false,
        archivierungsgrund: null,
        ist_unfertig: true,
        freigegeben: false,
        review_status: "DRAFT",
        created_by_user_id: userId,
        last_modified_by_user_id: userId,
        fragen_kategorien: {
          create: source.fragen_kategorien.map((category) => ({
            fragenkategorie: {
              connect: { fragenkategorie_id: category.fragenkategorie_id },
            },
          })),
        },
        eventreihen: source.geltungsbereich === "EVENT_SERIES"
          ? { create: source.eventreihen.map((entry) => ({ eventreihe_id: entry.eventreihe_id })) }
          : undefined,
        medien: {
          create: source.medien.map((medium) => ({
            medientyp_id: medium.medientyp_id,
            datei: medium.datei,
            sortierung: medium.sortierung,
            bemerkung: medium.bemerkung,
            slot_key: medium.slot_key,
          })),
        },
        antworten: {
          create: source.antworten.map((answer) => ({
            antwort: answer.antwort,
            ist_richtig: answer.ist_richtig,
            antworttyp_id: answer.antworttyp_id,
            zusatzinformation: answer.zusatzinformation,
            medien: {
              create: answer.medien.map((medium) => ({
                medientyp_id: medium.medientyp_id,
                datei: medium.datei,
                sortierung: medium.sortierung,
                bemerkung: medium.bemerkung,
                slot_key: medium.slot_key,
              })),
            },
          })),
        },
        antwortfelder: {
          create: source.antwortfelder.map((field) => ({
            label: field.label,
            sortierung: field.sortierung,
            ist_pflicht: field.ist_pflicht,
            medien: {
              create: field.medien.map((medium) => ({
                medientyp_id: medium.medientyp_id,
                datei: medium.datei,
                sortierung: medium.sortierung,
                bemerkung: medium.bemerkung,
                slot_key: medium.slot_key,
              })),
            },
            loesungen: { create: field.loesungen },
          })),
        },
      },
      select: { fragen_id: true },
    });
    revalidatePath("/fragen");
    return { ok: true, questionId: clone.fragen_id };
  } catch (error) {
    console.error("Frage konnte nicht geklont werden", {
      questionId,
      errorClass: error instanceof Error ? error.name : "UnknownError",
    });
    return { ok: false, code: "UNEXPECTED_ERROR" };
  }
}

export async function setQuestionArchived(
  questionId: number,
  archived: boolean,
  reason = "",
): Promise<ManagementResult> {
  const session = await requireQuestionEditor();
  const question = await prisma.fragen.findUnique({
    where: { fragen_id: questionId },
    select: accessSelect,
  });
  if (!question) return { ok: false, code: "QUESTION_NOT_FOUND" };
  const actor = await getQuestionActor(session);
  if (!canEditScopedQuestion(actor, mapQuestionAccessContext(question))) {
    return { ok: false, code: "PERMISSION_DENIED" };
  }
  await prisma.fragen.update({
    where: { fragen_id: questionId },
    data: {
      ist_archiviert: archived,
      archivierungsgrund: archived ? reason.trim().slice(0, 500) || null : null,
      last_modified_by_user_id: getCurrentUserId(session),
    },
  });
  revalidatePath("/fragen");
  revalidatePath(`/fragen/editor/${questionId}`);
  revalidatePath(`/content/questions/${questionId}`);
  return { ok: true, questionId };
}

export async function deleteQuestionPermanently(
  questionId: number,
): Promise<ManagementResult> {
  const session = await requireQuestionEditor();
  const question = await prisma.fragen.findUnique({
    where: { fragen_id: questionId },
    select: {
      fragen_id: true,
      ...accessSelect,
      _count: {
        select: {
          quiz_fragen: true,
          medien: true,
          generator_laefe: true,
          relationen_als_quelle: true,
          relationen_als_ziel: true,
        },
      },
      antworten: { select: { _count: { select: { medien: true, team_antworten: true } } } },
      antwortfelder: { select: { _count: { select: { medien: true, team_antworten: true } } } },
    },
  });
  if (!question) return { ok: false, code: "QUESTION_NOT_FOUND" };
  const actor = await getQuestionActor(session);
  if (!canApproveScopedQuestion(actor, mapQuestionAccessContext(question))) {
    return { ok: false, code: "PERMISSION_DENIED" };
  }
  const blocker = getQuestionDeletionBlocker({
    quizAssignments: question._count.quiz_fragen,
    teamAnswers:
      question.antworten.reduce((sum, answer) => sum + answer._count.team_antworten, 0) +
      question.antwortfelder.reduce((sum, field) => sum + field._count.team_antworten, 0),
    relations:
      question._count.relationen_als_quelle + question._count.relationen_als_ziel,
    media:
      question._count.medien +
      question.antworten.reduce((sum, answer) => sum + answer._count.medien, 0) +
      question.antwortfelder.reduce((sum, field) => sum + field._count.medien, 0),
    generatorRuns: question._count.generator_laefe,
  });
  if (blocker) return { ok: false, code: blocker };

  await prisma.fragen.delete({ where: { fragen_id: questionId } });
  revalidatePath("/fragen");
  return { ok: true, questionId };
}
