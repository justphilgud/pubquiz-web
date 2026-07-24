import { prisma } from "@/app/lib/prisma";
import type {
  QuestionAnswerDraft,
  QuestionEditorDraft,
  QuestionEditorRecord,
} from "./types";
import {
  createAnswerMediaDraftFromStoredMedia,
  createQuestionMediaDraftFromStoredMedia,
} from "./questionMedia";
import { resolveCanonicalQuestionTemplateId } from "./templates/questionTemplateRegistry";
import { mapGeneratorRun } from "./generators/runState";
import {
  DEFAULT_PIXEL_TEMPLATE_CONFIG,
  parseQuestionTemplateConfigDraft,
} from "./pixelTemplateConfig";
import { resolveQuestionText } from "./templates/questionTemplateData";

export async function loadQuestionForEditor(questionId: number) {
  const question = await prisma.fragen.findUnique({
    where: { fragen_id: questionId },
    select: {
      fragen_id: true,
      frage: true,
      quelle: true,
      moderationsnotizen: true,
      kategorienwunsch: true,
      gueltig_bis: true,
      ist_unfertig: true,
      ist_archiviert: true,
      freigegeben: true,
      review_status: true,
      review_feedback: true,
      submitted_at: true,
      submitted_by_user_id: true,
      reviewed_at: true,
      reviewed_by_user_id: true,
      approved_at: true,
      approved_by_user_id: true,
      created_at: true,
      created_by_user_id: true,
      updated_at: true,
      last_modified_by_user_id: true,
      template_config_json: true,
      geltungsbereich: true,
      eventreihen: {
        orderBy: { eventreihe: { name: "asc" } },
        select: { eventreihe_id: true, eventreihe: { select: { name: true } } },
      },
      vorlage: {
        select: { code: true, name: true },
      },
      fragen_kategorien: {
        orderBy: { fragenkategorie_id: "asc" },
        select: { fragenkategorie_id: true },
      },
      medien: {
        orderBy: [{ sortierung: "asc" }, { medien_id: "asc" }],
        select: {
          medien_id: true,
          datei: true,
          slot_key: true,
          medientyp: { select: { medientyp: true } },
        },
      },
      generator_laefe: {
        orderBy: { created_at: "desc" },
        select: {
          generator_lauf_id: true,
          generator_id: true,
          generator_version: true,
          status: true,
          input_fingerprint: true,
          error_code: true,
          parameters_json: true,
          medien: { select: { medien_id: true, rolle: true } },
        },
      },
      antworten: {
        orderBy: { antwort_id: "asc" },
        select: {
          antwort_id: true,
          antwort: true,
          ist_richtig: true,
          zusatzinformation: true,
          medien: {
            orderBy: [{ sortierung: "asc" }, { medien_id: "asc" }],
            select: {
              medien_id: true,
              datei: true,
              medientyp: { select: { medientyp: true } },
            },
          },
        },
      },
      antwortfelder: {
        orderBy: [{ sortierung: "asc" }, { antwortfeld_id: "asc" }],
        select: {
          antwortfeld_id: true,
          label: true,
          ist_pflicht: true,
          medien: {
            orderBy: [{ sortierung: "asc" }, { medien_id: "asc" }],
            select: {
              medien_id: true,
              datei: true,
              medientyp: { select: { medientyp: true } },
            },
          },
          loesungen: {
            orderBy: [{ sortierung: "asc" }, { loesung_id: "asc" }],
            select: {
              loesung_id: true,
              loesung_text: true,
              ist_akzeptiert: true,
              zusatzinformation: true,
            },
          },
        },
      },
    },
  });

  if (!question) {
    return null;
  }

  const userIds = [
    question.created_by_user_id,
    question.last_modified_by_user_id,
    question.submitted_by_user_id,
    question.reviewed_by_user_id,
    question.approved_by_user_id,
  ].filter((id): id is number => id !== null);
  const users = userIds.length
    ? await prisma.users.findMany({
        where: { id: { in: [...new Set(userIds)] } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const userNames = new Map(
    users.map((user) => [user.id, user.name?.trim() || user.email]),
  );
  const getUserName = (userId: number | null) =>
    userId === null ? null : (userNames.get(userId) ?? null);

  const classicAnswers: QuestionAnswerDraft[] = question.antworten.map(
    (answer) => ({
      id: `answer-${answer.antwort_id}`,
      answerId: answer.antwort_id,
      text: answer.antwort,
      isCorrect: answer.ist_richtig,
      additionalInfo: answer.zusatzinformation ?? "",
      media: createAnswerMediaDraftFromStoredMedia(answer.medien),
    }),
  );
  const labeledAnswers: QuestionAnswerDraft[] = question.antwortfelder.flatMap<QuestionAnswerDraft>(
    (field) => {
      const fieldGroupId = `field-${field.antwortfeld_id}`;
      const media = createAnswerMediaDraftFromStoredMedia(field.medien);

      if (field.loesungen.length === 0) {
        return [
          {
            id: `${fieldGroupId}-empty`,
            answerFieldId: field.antwortfeld_id,
            fieldGroupId,
            fieldLabel: field.label,
            isRequired: field.ist_pflicht,
            text: "",
            isCorrect: false,
            additionalInfo: "",
            media,
          },
        ];
      }

      return field.loesungen.map((solution) => ({
        id: `solution-${solution.loesung_id}`,
        answerFieldId: field.antwortfeld_id,
        solutionId: solution.loesung_id,
        fieldGroupId,
        fieldLabel: field.label,
        isRequired: field.ist_pflicht,
        text: solution.loesung_text,
        isCorrect: solution.ist_akzeptiert,
        additionalInfo: solution.zusatzinformation ?? "",
        media,
      }));
    },
  );
  const answers = [...classicAnswers, ...labeledAnswers];
  const templateId = resolveCanonicalQuestionTemplateId(
    question.vorlage?.code ?? null,
  );
  const questionMedia = createQuestionMediaDraftFromStoredMedia(question.medien, templateId);

  const generatorRuns = question.generator_laefe.map(mapGeneratorRun).filter((run) => run !== null);
  const generatorParameters = {} as NonNullable<QuestionEditorDraft["generatorParameters"]>;
  for (const run of generatorRuns) {
    generatorParameters[run.generatorId] ??= run.parameters;
  }
  const templateConfig =
    parseQuestionTemplateConfigDraft(
      question.template_config_json,
      templateId,
    ) ?? DEFAULT_PIXEL_TEMPLATE_CONFIG;
  // The canonical question text wins. Legacy statement is only adopted when
  // the canonical field is empty, then disappears on the next save.
  const questionText = resolveQuestionText(
    question.frage,
    question.template_config_json,
  );

  const draft: QuestionEditorDraft = {
    scope: question.geltungsbereich,
    eventSeriesIds: question.eventreihen.map((entry) => entry.eventreihe_id),
    templateId,
    questionText,
    questionMedia,
    generatorRuns,
    generatorParameters,
    templateConfig,
    answers:
      answers.length > 0
        ? answers
        : [
            {
              id: "initial-answer",
              text: "",
              isCorrect: true,
              additionalInfo: "",
              media: null,
            },
          ],
    categoryIds: question.fragen_kategorien.map(
      (category) => category.fragenkategorie_id,
    ),
    sourceOrRemark: question.quelle ?? "",
    moderationNotes: question.moderationsnotizen ?? "",
    categoryRequest: question.kategorienwunsch ?? "",
    approvalRemark: "",
    isIncomplete: question.ist_unfertig,
    validUntil: question.gueltig_bis?.toISOString().slice(0, 10) ?? null,
    status: question.freigegeben
      ? "APPROVED"
      : question.ist_unfertig
        ? "DRAFT"
        : "NOT_APPROVED",
  };
  const record: QuestionEditorRecord = {
    questionId: question.fragen_id,
    reviewStatus: question.review_status,
    reviewFeedback: question.review_feedback,
    submittedAt: question.submitted_at?.toISOString() ?? null,
    reviewedAt: question.reviewed_at?.toISOString() ?? null,
    creatorName: getUserName(question.created_by_user_id) ?? "",
    submittedByName: getUserName(question.submitted_by_user_id),
    reviewedByName: getUserName(question.reviewed_by_user_id),
    approvedByName: getUserName(question.approved_by_user_id),
    lastModifiedByName: getUserName(question.last_modified_by_user_id),
    createdAt: question.created_at.toISOString(),
    updatedAt: question.updated_at.toISOString(),
    approvedAt: question.approved_at?.toISOString() ?? null,
    templateName: question.vorlage?.name ?? null,
    isArchived: question.ist_archiviert,
    scope: question.geltungsbereich,
    eventSeriesNames: question.eventreihen.map((entry) => entry.eventreihe.name),
  };

  return {
    draft,
    record,
    access: {
      createdByUserId: question.created_by_user_id,
      reviewStatus: question.review_status,
      isArchived: question.ist_archiviert,
      scope: question.geltungsbereich,
      eventSeriesIds: question.eventreihen.map((entry) => entry.eventreihe_id),
      isApproved: question.freigegeben,
    },
  };
}
