import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement, type ComponentProps, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { deQuestionEditorMessages } from "@/app/i18n/messages/de/questionEditor";
import { QuestionLifecycleSection } from "./components/QuestionLifecycleSection";
import { QuestionEditorMessagesProvider } from "./components/QuestionEditorMessagesProvider";
import {
  getQuestionLifecycleModeChange,
  getQuestionLifecycleState,
  isValidNextReviewFrom,
  outdatedFromToValidUntil,
  validUntilToOutdatedFrom,
} from "./questionLifecycle";

const TestMessageProvider = QuestionEditorMessagesProvider as ComponentType<
  Omit<ComponentProps<typeof QuestionEditorMessagesProvider>, "children">
>;

function renderLifecycle(validUntil: string | null, reviewFrom: string | null) {
  return renderToStaticMarkup(createElement(
    TestMessageProvider,
    {
      locale: "de",
      messages: deQuestionEditorMessages,
    },
    createElement(QuestionLifecycleSection, {
        validUntil,
        reviewFrom,
        onChange: () => undefined,
    }),
  ));
}

test("legacy inclusive valid-until dates map to the following outdated-from day", () => {
  assert.equal(validUntilToOutdatedFrom("2026-08-18"), "2026-08-19");
  assert.equal(outdatedFromToValidUntil("2026-08-19"), "2026-08-18");
});

test("freshness confirmation clears a due date or schedules a future review", () => {
  assert.equal(isValidNextReviewFrom(null, "2026-08-18"), true);
  assert.equal(isValidNextReviewFrom("2026-08-18", "2026-08-18"), false);
  assert.equal(isValidNextReviewFrom("2026-08-19", "2026-08-18"), true);
});

test("timeless, outdated and review lifecycle states stay distinct", () => {
  const today = "2026-08-18";
  assert.deepEqual(
    getQuestionLifecycleState({ validUntil: null, reviewFrom: null, today }),
    {
      mode: "TIMELESS",
      outdatedFrom: null,
      isOutdated: false,
      isOutdatedSoon: false,
      isReviewDue: false,
      isReviewSoon: false,
      isCurrent: true,
    },
  );
  assert.equal(
    getQuestionLifecycleState({ validUntil: "2026-08-17", reviewFrom: null, today }).isOutdated,
    true,
  );
  assert.equal(
    getQuestionLifecycleState({ validUntil: null, reviewFrom: "2026-08-18", today }).isReviewDue,
    true,
  );
});

test("segmented lifecycle choices preserve the existing persistence mapping", () => {
  assert.deepEqual(getQuestionLifecycleModeChange("TIMELESS"), {
    validUntil: null,
    reviewFrom: null,
  });
  assert.deepEqual(getQuestionLifecycleModeChange("OUTDATED_FROM"), {
    validUntil: "",
    reviewFrom: null,
  });
  assert.deepEqual(getQuestionLifecycleModeChange("REVIEW_FROM"), {
    validUntil: null,
    reviewFrom: "",
  });
});

test("freshness control renders three accessible radios and progressive dates", () => {
  const timeless = renderLifecycle(null, null);
  assert.equal((timeless.match(/type="radio"/g) ?? []).length, 3);
  assert.match(timeless, /role="radiogroup"/);
  assert.match(timeless, /Zeitlos/);
  assert.doesNotMatch(timeless, /type="date"/);
  assert.doesNotMatch(timeless, /<select/);

  const outdated = renderLifecycle("2026-08-18", null);
  assert.match(outdated, /type="date"/);
  assert.match(outdated, /value="2026-08-19"/);
  assert.match(outdated, /data-editor-valid-until="true"/);
});

test("freshness radio group keeps explicit arrow-key navigation", () => {
  const source = readFileSync(
    "app/fragen/editor/components/QuestionLifecycleSection.tsx",
    "utf8",
  );
  assert.match(source, /event\.key === "ArrowRight"/);
  assert.match(source, /event\.key === "ArrowLeft"/);
  assert.match(source, /requestAnimationFrame/);
});

test("soon filters include the next 30 days but not due dates", () => {
  const today = "2026-08-18";
  assert.equal(
    getQuestionLifecycleState({ validUntil: "2026-09-16", reviewFrom: null, today }).isOutdatedSoon,
    true,
  );
  assert.equal(
    getQuestionLifecycleState({ validUntil: null, reviewFrom: "2026-09-17", today }).isReviewSoon,
    true,
  );
  assert.equal(
    getQuestionLifecycleState({ validUntil: null, reviewFrom: "2026-09-18", today }).isReviewSoon,
    false,
  );
});
