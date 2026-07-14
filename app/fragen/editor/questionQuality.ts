import type { QuestionEditorDraft } from "./types";
import { questionTemplates } from "./templates/questionTemplates";

export type QuestionQualityResult = {
  blockers: string[];
  warnings: string[];
};

function isValidDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function evaluateQuestionQuality(
  draft: QuestionEditorDraft,
): QuestionQualityResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const filledAnswers = draft.answers.filter((answer) => answer.text.trim());
  const mediaSlot = questionTemplates.find(
    (template) => template.id === draft.templateId,
  )?.questionMediaSlot;

  if (!draft.questionText.trim()) {
    blockers.push("Fragetext fehlt");
  }

  if (
    mediaSlot?.required &&
    (!draft.questionMedia ||
      draft.questionMedia.operation === "REMOVE" ||
      !draft.questionMedia.url ||
      draft.questionMedia.mediaType !== mediaSlot.allowedMediaType ||
      draft.questionMedia.blockedReason)
  ) {
    blockers.push(`${mediaSlot.label} fehlt oder ist nicht verwendbar`);
  }

  if (!filledAnswers.some((answer) => answer.isCorrect)) {
    blockers.push("Keine ausgefüllte richtige Antwort vorhanden");
  }

  if (
    draft.answers.some(
      (answer) =>
        answer.fieldLabel && answer.isRequired !== false && !answer.text.trim(),
    )
  ) {
    blockers.push("Ein erforderliches beschriftetes Antwortfeld ist leer");
  }

  if (draft.validUntil !== null && !isValidDateInput(draft.validUntil)) {
    blockers.push("Ablaufdatum ist unvollständig oder ungültig");
  }

  const groupedFields = new Map<
    string,
    { label: string; isRequired: boolean }
  >();

  for (const answer of draft.answers) {
    if (!answer.fieldGroupId || !answer.fieldLabel) {
      continue;
    }

    const existingField = groupedFields.get(answer.fieldGroupId);
    const isRequired = answer.isRequired !== false;

    if (
      existingField &&
      (existingField.label !== answer.fieldLabel ||
        existingField.isRequired !== isRequired)
    ) {
      blockers.push("Beschriftete Antwortdaten sind technisch inkonsistent");
      break;
    }

    groupedFields.set(answer.fieldGroupId, {
      label: answer.fieldLabel,
      isRequired,
    });
  }

  if (!draft.sourceOrRemark.trim()) {
    warnings.push("Quelle fehlt");
  }

  if (draft.categoryIds.length === 0) {
    warnings.push("Kategorie fehlt");
  }

  if (
    filledAnswers.length > 1 &&
    !filledAnswers.some((answer) => answer.additionalInfo.trim())
  ) {
    warnings.push("Zusatzinformation für mehrere Vergleichswerte fehlt");
  }

  return { blockers, warnings };
}
