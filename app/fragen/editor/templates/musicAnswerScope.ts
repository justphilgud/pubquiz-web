import type { QuestionTemplate, QuestionTemplateDefinition } from "../types";

/** Use the declared audio/answer structure, never a question text or an ID. */
export function isMusicAnswerStructure(labels: Array<string | undefined>, hasAudio: boolean) {
  return hasAudio && labels.length === 2 &&
    labels.some(label => /^(interpret|artist|sänger)$/i.test(label?.trim() ?? "")) &&
    labels.some(label => /^(titel|title|song title)$/i.test(label?.trim() ?? ""));
}

export function supportsMusicAnswerScope(template: QuestionTemplate | QuestionTemplateDefinition | null | undefined) {
  return !!template && (("initialTemplateConfig" in template && template.initialTemplateConfig?.musicAnswerScope === "SINGLE") || isMusicAnswerStructure(
    template.initialAnswers.map(answer => "fieldLabel" in answer ? answer.fieldLabel : "fieldLabelKey" in answer ? answer.fieldLabelKey : undefined),
    template.mediaSlots.some(slot => "allowedMediaType" in slot ? slot.allowedMediaType === "AUDIO" : slot.slotKey.endsWith("_audio")),
  ));
}
