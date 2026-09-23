import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { buildManifest } from "./manifest";
import {
  moveQuizEditorElement,
  type QuizEditorElement,
} from "./quiz/[quizId]/quizEditorElement";

function pngSize(path: string) {
  const png = readFileSync(path);
  assert.equal(png.subarray(1, 4).toString("ascii"), "PNG", path);
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  };
}

const read = (path: string) => readFileSync(path, "utf8");

test("the authenticated web app exposes one installable standalone manifest", () => {
  const value = buildManifest("production");

  assert.equal(value.name, "Phil Gud Entertainment PubQuiz");
  assert.equal(value.short_name, "PubQuiz");
  assert.equal(value.start_url, "/");
  assert.equal(value.scope, "/");
  assert.equal(value.display, "standalone");
  assert.equal(value.theme_color, "#000000");
  assert.equal(value.background_color, "#000000");
  assert.equal(value.icons?.length, 4);
  assert.deepEqual(
    value.icons?.map((icon) => icon.purpose),
    ["any", "maskable", "any", "maskable"],
  );
  assert.deepEqual(pngSize("public/pwa/icon-192.png"), { width: 192, height: 192 });
  assert.deepEqual(pngSize("public/pwa/icon-512.png"), { width: 512, height: 512 });
  assert.deepEqual(
    value.icons?.map((icon) => icon.src),
    [
      "/pwa/icon-192.png",
      "/pwa/icon-192.png",
      "/pwa/icon-512.png",
      "/pwa/icon-512.png",
    ],
  );
  assert.equal(existsSync("public/sw.js"), false);
  assert.equal(existsSync("app/sw.ts"), false);
});

test("preview has a distinct install name and icon without changing production", () => {
  const preview = buildManifest("preview");

  assert.equal(preview.name, "PubQuiz Preview");
  assert.equal(preview.short_name, "PubQuiz Preview");
  assert.deepEqual(
    preview.icons?.map((icon) => icon.src),
    [
      "/pwa/preview-icon-192.png",
      "/pwa/preview-icon-192.png",
      "/pwa/preview-icon-512.png",
      "/pwa/preview-icon-512.png",
    ],
  );
  assert.deepEqual(pngSize("public/pwa/preview-icon-192.png"), {
    width: 192,
    height: 192,
  });
  assert.deepEqual(pngSize("public/pwa/preview-icon-512.png"), {
    width: 512,
    height: 512,
  });
});

test("mobile navigation reuses the authenticated questions and quiz routes", () => {
  const home = read("app/page.tsx");
  const header = read("app/components/AppHeader.tsx");
  const navigation = read("app/components/AppNav.tsx");
  const dashboardCards = read("app/components/dashboard/DashboardCards.tsx");
  const questionLibrary = read("app/components/content/ContentLibraryPage.tsx");
  const questionEditor = read("app/fragen/editor/page.tsx");
  const quizList = read("app/quiz/page.tsx");
  const quizDetail = read("app/quiz/[quizId]/page.tsx");

  assert.match(home, /href="\/fragen\/editor"/);
  assert.match(home, /href="\/fragen"/);
  assert.match(home, /href="\/quiz"/);
  assert.match(header, /grid-cols-\[minmax\(0,1fr\)_auto\]/);
  assert.match(navigation, /grid-cols-2/);
  assert.match(dashboardCards, /min-w-0 rounded-2xl/);
  assert.match(questionLibrary, /requireQuestionEditor\(\)/);
  assert.match(questionEditor, /requireQuestionEditor\(\)/);
  assert.match(quizList, /requireActor\(\)/);
  assert.match(quizDetail, /requireQuizViewer\(Number\(quizId\)\)/);
});

test("quiz questions retain drag-and-drop and add explicit touch sorting", () => {
  const structure = read("app/quiz/[quizId]/QuizFragenSortableTable.tsx");
  const question = read("app/quiz/[quizId]/QuizQuestionItem.tsx");
  const buttons = read("app/quiz/[quizId]/QuizFrageSortierungButtons.tsx");

  assert.match(structure, /onDragEnd=\{handleDragEnd\}/);
  assert.match(structure, /handleMoveQuestion/);
  assert.match(structure, /updateQuizEditorElementSequence/);
  assert.match(question, /QuizFrageSortierungButtons/);
  assert.match(buttons, /h-11 w-11/);
  assert.match(buttons, /aria-label="Nach oben"/);
  assert.match(buttons, /aria-label="Nach unten"/);

  const elements = [
    { key: "question-1" },
    { key: "story-2" },
    { key: "question-3" },
  ] as QuizEditorElement[];
  assert.deepEqual(
    moveQuizEditorElement(elements, "question-3", "up").map((element) => element.key),
    ["question-1", "question-3", "story-2"],
  );
  assert.deepEqual(elements.map((element) => element.key), [
    "question-1",
    "story-2",
    "question-3",
  ]);
  assert.deepEqual(
    moveQuizEditorElement(elements, "question-1", "up").map((element) => element.key),
    elements.map((element) => element.key),
  );
});
