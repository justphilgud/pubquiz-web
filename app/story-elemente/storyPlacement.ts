export const STORY_PLACEMENTS = [
  "BEFORE_QUESTION",
  "AFTER_SOLUTION",
] as const;

export type StoryPlacement = (typeof STORY_PLACEMENTS)[number];
export type StoryPlacementOverride = StoryPlacement | "HIDDEN" | null;

export function isStoryPlacementHiddenConfig(value: unknown) {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).quizHidden === true;
}

export function storyPlacementConfig(hidden: boolean) {
  return hidden ? { version: 1, quizHidden: true } : { version: 1 };
}

/**
 * The existing Prisma enum predates the placement vocabulary. RELATED is the
 * persisted compatibility value for BEFORE_QUESTION; AFTER_SOLUTION already
 * has the required meaning. Historic editorial values stay readable and are
 * mapped without rewriting data.
 */
export function storyPlacementFromRelationship(
  relationship: string | null | undefined,
): StoryPlacement {
  return relationship === "AFTER_SOLUTION" ||
      relationship === "REVEAL" ||
      relationship === "FOLLOW_UP"
    ? "AFTER_SOLUTION"
    : "BEFORE_QUESTION";
}

export function storyPlacementToRelationship(
  placement: StoryPlacement,
): "RELATED" | "AFTER_SOLUTION" {
  return placement === "BEFORE_QUESTION" ? "RELATED" : "AFTER_SOLUTION";
}

export function isStoryPlacement(value: unknown): value is StoryPlacement {
  return STORY_PLACEMENTS.some((placement) => placement === value);
}

export function resolveStoryPlacement(input: {
  defaultRelationship: string | null | undefined;
  overrideRelationship: string | null | undefined;
}) {
  return storyPlacementFromRelationship(
    input.overrideRelationship ?? input.defaultRelationship,
  );
}

export function getStoryPlacementLabel(placement: StoryPlacement) {
  return placement === "BEFORE_QUESTION"
    ? "Vor der Frage"
    : "Nach der Auflösung";
}
