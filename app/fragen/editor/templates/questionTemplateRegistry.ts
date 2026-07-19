export const questionTemplateIds = {
  standard: "standard",
  multipleChoice: "multiple_choice",
  faceMorph: "face_morph",
  musicReverse: "musik_rueckwaerts",
  musicEightBit: "eight_bit",
  pixelImage: "pixelbild",
} as const;

const questionTemplateAliases: Readonly<Record<string, string>> = {
  "multiple-choice": questionTemplateIds.multipleChoice,
  facemorph: questionTemplateIds.faceMorph,
  "music-reverse": questionTemplateIds.musicReverse,
  "music-8bit": questionTemplateIds.musicEightBit,
  musik_8bit: questionTemplateIds.musicEightBit,
  image_pixel: questionTemplateIds.pixelImage,
};

export function getQuestionTemplatePersistenceIds(
  templateId: string | null,
): readonly string[] {
  const canonicalId = resolveCanonicalQuestionTemplateId(templateId);

  if (canonicalId === null) {
    return [];
  }

  return [
    canonicalId,
    ...Object.entries(questionTemplateAliases)
      .filter(([, resolvedId]) => resolvedId === canonicalId)
      .map(([alias]) => alias),
  ];
}

export function resolveCanonicalQuestionTemplateId(
  templateId: string | null,
): string | null {
  if (templateId === null) {
    return null;
  }

  const normalizedId = templateId.trim().toLowerCase();

  if (!normalizedId || normalizedId === questionTemplateIds.standard) {
    return null;
  }

  return questionTemplateAliases[normalizedId] ?? normalizedId;
}

export function findQuestionTemplate<T extends { id: string }>(
  templates: readonly T[],
  templateId: string | null,
): T | null {
  const canonicalId = resolveCanonicalQuestionTemplateId(templateId);

  if (canonicalId === null) {
    return templates.find(
      (template) => template.id === questionTemplateIds.standard,
    ) ?? null;
  }

  return templates.find((template) => template.id === canonicalId) ?? null;
}
