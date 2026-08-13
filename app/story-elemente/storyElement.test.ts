import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { AuthorizationActor } from "@/app/roles/roleAssignmentPolicy";
import {
  getStoryQuestionRelationshipLabel,
  getNewStoryQuestionRelationship,
  getInitialStoryElementConfig,
  PRODUCTIVE_STORY_QUESTION_RELATIONSHIPS,
  STORY_ELEMENT_TYPES,
  validateStoryElementInput,
} from "./storyElement";
import {
  canArchiveStoryElement,
  canAttachStoryElementToQuiz,
  canEditStoryElement,
  canUseStoryElementScope,
  canViewStoryElement,
  type StoryElementAccessContext,
} from "./storyElementPolicy";
import {
  getAvailableStoryElementScopes,
  getDefaultStoryElementScope,
} from "./storyElementScopePresentation";
import {
  isStoryPlacementHiddenConfig,
  resolveStoryPlacement,
  storyPlacementConfig,
  storyPlacementFromRelationship,
  storyPlacementToRelationship,
} from "./storyPlacement";

const admin: AuthorizationActor = {
  userId: 1,
  assignments: [{ role: "ADMIN", scopeType: "GLOBAL", eventSeriesId: null }],
};
const eventEditor: AuthorizationActor = {
  userId: 2,
  assignments: [{ role: "EDITOR", scopeType: "EVENT_SERIES", eventSeriesId: 10 }],
};
const eventManager: AuthorizationActor = {
  userId: 3,
  assignments: [{ role: "EVENT_MANAGER", scopeType: "EVENT_SERIES", eventSeriesId: 10 }],
};

test("story scope presentation hides impossible choices and prefers quiz context", () => {
  assert.deepEqual(
    getAvailableStoryElementScopes({ canUseGlobalScope: false, hasQuizContext: false }),
    ["EVENT_SERIES"],
  );
  assert.deepEqual(
    getAvailableStoryElementScopes({ canUseGlobalScope: false, hasQuizContext: true }),
    ["QUIZ", "EVENT_SERIES"],
  );
  assert.deepEqual(
    getAvailableStoryElementScopes({ canUseGlobalScope: true, hasQuizContext: false }),
    ["GLOBAL", "EVENT_SERIES"],
  );
  assert.deepEqual(
    getAvailableStoryElementScopes({ canUseGlobalScope: true, hasQuizContext: true }),
    ["GLOBAL", "EVENT_SERIES", "QUIZ"],
  );
  assert.equal(
    getDefaultStoryElementScope({ canUseGlobalScope: false, hasQuizContext: true }),
    "QUIZ",
  );
});

test("question links expose only the two productive placement relationships", () => {
  assert.deepEqual(PRODUCTIVE_STORY_QUESTION_RELATIONSHIPS, [
    "RELATED",
    "AFTER_SOLUTION",
  ]);
  assert.deepEqual(
    PRODUCTIVE_STORY_QUESTION_RELATIONSHIPS.map(getStoryQuestionRelationshipLabel),
    [
      "Inhaltlich verknüpft",
      "Nach der Auflösung zeigen",
    ],
  );
});

test("new question links use the compatibility default without choosing quiz placement", () => {
  assert.equal(getNewStoryQuestionRelationship(), "AFTER_SOLUTION");
});

function story(overrides: Partial<StoryElementAccessContext> = {}): StoryElementAccessContext {
  return {
    scope: "EVENT_SERIES",
    eventSeriesId: 10,
    quizId: null,
    quizEventSeriesId: null,
    createdByUserId: 2,
    status: "DRAFT",
    ...overrides,
  };
}

test("all template-neutral story types have a valid safe initial configuration", () => {
  for (const type of STORY_ELEMENT_TYPES) {
    const result = validateStoryElementInput({
      type,
      title: `Test ${type}`,
      description: "Nicht bewerteter redaktioneller Inhalt",
      category: "Erinnerungen",
      tags: ["Geburtstag", "Familie"],
      moderatorNote: "Nur für die Moderation",
      status: "DRAFT",
      scope: "EVENT_SERIES",
      eventSeriesId: 10,
      quizId: null,
      config: getInitialStoryElementConfig(type),
    });
    assert.equal(result.ok, true, `${type} must validate`);
  }
});

test("story elements reject executable, unknown and external media content", () => {
  const result = validateStoryElementInput({
    type: "IMAGE",
    title: "Unsicher",
    status: "DRAFT",
    scope: "EVENT_SERIES",
    eventSeriesId: 10,
    config: {
      version: 1,
      imageUrl: "https://example.com/tracker.jpg",
      altText: "Bild",
      html: "<script>alert(1)</script>",
    },
  });
  assert.equal(result.ok, false);
});

test("scope validation enforces exactly one matching owner level", () => {
  const invalid = validateStoryElementInput({
    type: "ANECDOTE",
    title: "Doppelt zugeordnet",
    status: "ACTIVE",
    scope: "EVENT_SERIES",
    eventSeriesId: 10,
    quizId: 20,
    config: getInitialStoryElementConfig("ANECDOTE"),
  });
  assert.equal(invalid.ok, false);
});

test("global story management remains admin-only", () => {
  assert.equal(canUseStoryElementScope(admin, {
    scope: "GLOBAL",
    eventSeriesId: null,
    quizEventSeriesId: null,
  }), true);
  assert.equal(canUseStoryElementScope(eventEditor, {
    scope: "GLOBAL",
    eventSeriesId: null,
    quizEventSeriesId: null,
  }), false);
  assert.equal(canViewStoryElement(eventEditor, story({ scope: "GLOBAL", eventSeriesId: null })), true);
  assert.equal(canEditStoryElement(eventEditor, story({ scope: "GLOBAL", eventSeriesId: null })), false);
});

test("event editors manage own drafts while event managers manage the series", () => {
  assert.equal(canEditStoryElement(eventEditor, story()), true);
  assert.equal(canEditStoryElement(eventEditor, story({ createdByUserId: 99 })), false);
  assert.equal(canEditStoryElement(eventManager, story({ createdByUserId: 99, status: "ACTIVE" })), true);
  assert.equal(canArchiveStoryElement(eventManager, story({ createdByUserId: 99 })), true);
  assert.equal(canViewStoryElement(eventEditor, story({ eventSeriesId: 11 })), false);
});

test("active and own draft stories can be attached only to an eligible quiz", () => {
  assert.equal(canAttachStoryElementToQuiz(eventManager, story({ status: "ACTIVE" }), {
    quizId: 50,
    eventSeriesId: 10,
  }), true);
  assert.equal(canAttachStoryElementToQuiz(eventManager, story({ status: "ACTIVE" }), {
    quizId: 50,
    eventSeriesId: 11,
  }), false);
  assert.equal(canAttachStoryElementToQuiz(eventEditor, story({ status: "DRAFT" }), {
    quizId: 50,
    eventSeriesId: 10,
  }), false, "event editors cannot assemble quizzes");
});

test("event scope authorization rejects manipulated ownership values", () => {
  assert.equal(canUseStoryElementScope(eventEditor, {
    scope: "EVENT_SERIES",
    eventSeriesId: 10,
    quizEventSeriesId: null,
  }), true);
  assert.equal(canUseStoryElementScope(eventEditor, {
    scope: "EVENT_SERIES",
    eventSeriesId: 11,
    quizEventSeriesId: null,
  }), false);
  assert.equal(canUseStoryElementScope(eventEditor, {
    scope: "QUIZ",
    eventSeriesId: null,
    quizEventSeriesId: 11,
  }), false);
});

test("workflow surfaces share search controls and preserve legacy metadata without free fields", () => {
  const editor = readFileSync("app/story-elemente/StoryElementEditor.tsx", "utf8");
  const questionDraft = readFileSync("app/story-elemente/QuestionStoryElementDraftSection.tsx", "utf8");
  const questionPanel = readFileSync("app/story-elemente/QuestionStoryElementPanel.tsx", "utf8");
  const quizPicker = readFileSync("app/story-elemente/StoryElementQuizPicker.tsx", "utf8");
  const quizQuestionPicker = readFileSync("app/quiz/[quizId]/QuizFragenHinzufuegen.tsx", "utf8");
  const quizPage = readFileSync("app/quiz/[quizId]/page.tsx", "utf8");
  const quizActions = readFileSync("app/quiz/actions.ts", "utf8");
  const questionLinks = readFileSync("app/story-elemente/QuestionStoryElementPanel.tsx", "utf8");
  const storyLinks = readFileSync("app/story-elemente/StoryQuestionLinksPanel.tsx", "utf8");
  const linkActions = readFileSync("app/story-elemente/questionActions.ts", "utf8");
  const backButton = readFileSync("app/components/content/ContentBackButton.tsx", "utf8");

  assert.doesNotMatch(editor, /Kategorie \/ Thema|Tags \(kommagetrennt\)/);
  assert.match(editor, /category: initialStory\?\.category \?\? null/);
  assert.match(editor, /tags: initialStory\?\.tags \?\? \[\]/);
  assert.match(questionDraft, /ContentSearchControls/);
  assert.match(questionPanel, /ContentSearchControls/);
  assert.match(quizPicker, /ContentSearchControls/);
  assert.match(quizPicker, /addStoryElementToQuizBlock/);
  assert.match(quizQuestionPicker, /checked=\{includeLinkedStoryElements\}/);
  assert.match(quizPage, /<QuizFragenHinzufuegen[\s\S]*quizId=\{quiz\.quiz_id\}[\s\S]*storyElements=/);
  assert.match(quizActions, /verknuepfte_story_elemente_uebernehmen:\s*data\.includeLinkedStoryElements !== false/);
  assert.doesNotMatch(questionLinks, /Beziehungsart|PRODUCTIVE_STORY_QUESTION_RELATIONSHIPS/);
  assert.doesNotMatch(storyLinks, /Beziehungsart|PRODUCTIVE_STORY_QUESTION_RELATIONSHIPS/);
  assert.match(questionLinks, />Verknüpfen</);
  assert.match(storyLinks, />Verknüpfen</);
  assert.match(linkActions, /getNewStoryQuestionRelationship\(\)/);
  assert.match(linkActions, /frage_story_elemente\.deleteMany/);
  assert.match(backButton, /router\.back\(\)/);
  assert.match(backButton, /router\.push\(fallbackHref\)/);
  assert.match(editor, /else if \(returnTo\) \{\s*router\.push\(returnTo\)/);
  assert.doesNotMatch(editor, /returnTo\?\.startsWith\("\/fragen\/editor\/"\)/);
});

test("mobile creation workflow keeps the shared scope directly above content fields", () => {
  const editor = readFileSync("app/story-elemente/StoryElementEditor.tsx", "utf8");
  const titleIndex = editor.indexOf("Titel *");
  const contentIndex = editor.indexOf(">Inhalt<");
  const scopeIndex = editor.indexOf("<ContentScopeSection");
  assert.ok(scopeIndex > 0 && scopeIndex < titleIndex);
  assert.ok(titleIndex < contentIndex);
  assert.equal(editor.match(/<ContentScopeSection/g)?.length, 1);
  assert.doesNotMatch(editor, /Inhaltsvorschau|StoryPreview/);
  assert.match(editor, /ContentEditorActionBar/);
  assert.doesNotMatch(editor, /overflow-x-auto/);
});

test("question context creates story elements inline and cardinality rejects silent reassignment", () => {
  const draft = readFileSync("app/story-elemente/QuestionStoryElementDraftSection.tsx", "utf8");
  const existing = readFileSync("app/story-elemente/QuestionStoryElementPanel.tsx", "utf8");
  const actions = readFileSync("app/story-elemente/questionActions.ts", "utf8");
  assert.match(draft, /StoryElementCreateDialog/);
  assert.match(existing, /StoryElementCreateDialog/);
  assert.doesNotMatch(draft, /target="_blank"/);
  assert.match(actions, /bereits mit einer anderen Frage verknüpft/);
});

test("question defaults map to the two productive placement values", () => {
  assert.equal(storyPlacementFromRelationship("RELATED"), "BEFORE_QUESTION");
  assert.equal(storyPlacementFromRelationship("AFTER_SOLUTION"), "AFTER_SOLUTION");
  assert.equal(storyPlacementToRelationship("BEFORE_QUESTION"), "RELATED");
  assert.equal(storyPlacementToRelationship("AFTER_SOLUTION"), "AFTER_SOLUTION");
});

test("quiz override wins and null falls back to the question default", () => {
  assert.equal(resolveStoryPlacement({
    defaultRelationship: "RELATED",
    overrideRelationship: null,
  }), "BEFORE_QUESTION");
  assert.equal(resolveStoryPlacement({
    defaultRelationship: "AFTER_SOLUTION",
    overrideRelationship: "RELATED",
  }), "BEFORE_QUESTION");
  assert.equal(resolveStoryPlacement({
    defaultRelationship: "RELATED",
    overrideRelationship: "AFTER_SOLUTION",
  }), "AFTER_SOLUTION");
});

test("quiz-specific hidden state uses the existing placement configuration", () => {
  assert.equal(isStoryPlacementHiddenConfig(storyPlacementConfig(true)), true);
  assert.equal(isStoryPlacementHiddenConfig(storyPlacementConfig(false)), false);
  assert.equal(isStoryPlacementHiddenConfig(null), false);
});

test("historic editorial relationships remain readable without data mutation", () => {
  assert.equal(storyPlacementFromRelationship("CONTEXT"), "BEFORE_QUESTION");
  assert.equal(storyPlacementFromRelationship("REVEAL"), "AFTER_SOLUTION");
  assert.equal(storyPlacementFromRelationship("FOLLOW_UP"), "AFTER_SOLUTION");
});
