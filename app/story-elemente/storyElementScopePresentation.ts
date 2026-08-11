import type { StoryElementScopeValue } from "./storyElement";

export function getAvailableStoryElementScopes(input: {
  canUseGlobalScope: boolean;
  hasQuizContext: boolean;
}): StoryElementScopeValue[] {
  if (input.canUseGlobalScope) {
    return input.hasQuizContext
      ? ["GLOBAL", "EVENT_SERIES", "QUIZ"]
      : ["GLOBAL", "EVENT_SERIES"];
  }
  return input.hasQuizContext ? ["QUIZ", "EVENT_SERIES"] : ["EVENT_SERIES"];
}

export function getDefaultStoryElementScope(input: {
  existingScope?: StoryElementScopeValue;
  canUseGlobalScope: boolean;
  hasQuizContext: boolean;
}): StoryElementScopeValue {
  if (input.existingScope) return input.existingScope;
  if (input.hasQuizContext) return "QUIZ";
  return input.canUseGlobalScope ? "GLOBAL" : "EVENT_SERIES";
}
