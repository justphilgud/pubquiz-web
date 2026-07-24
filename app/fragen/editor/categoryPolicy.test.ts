import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CATEGORY_NAME_MAX_LENGTH,
  isCategoryDuplicate,
  isValidCategoryName,
  normalizeCategoryName,
  rankCategoryMatches,
} from "./categoryPolicy";
import {
  PendingCategoryReviewError,
  resolvePendingCategoryReview,
} from "./pendingCategoryReview";
import {
  countAdvancedQuestionFilters,
  getPendingCategoryBadgeLabel,
  hasQuestionSource,
  parseQuestionOverviewFilters,
  serializeQuestionOverviewFilters,
} from "../questionOverviewFilters";
import {
  filterTemplateOptions,
  getTemplateFilterDisplayValue,
  toggleTemplateFilter,
} from "../components/TemplateFilterCombobox";
import { isDismissTargetOutside } from "../../components/useDismissiblePopover";
import {
  getQuestionAnswerMode,
  getQuestionAnswerModeWhereInput,
} from "../questionAnswerMode";
import { questionTemplateDefinitions } from "./templates/questionTemplates";
import { questionTemplateIds } from "./templates/questionTemplateRegistry";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync(
  "prisma/migrations/20260725120000_add_category_lifecycle/migration.sql",
  "utf8",
);
const categoryActions = readFileSync(
  "app/fragen/editor/categoryActions.ts",
  "utf8",
);
const categorySection = readFileSync(
  "app/fragen/editor/components/CategorySection.tsx",
  "utf8",
);
const adminPage = readFileSync("app/admin/kategorien/page.tsx", "utf8");
const adminActions = readFileSync("app/admin/kategorien/actions.ts", "utf8");
const dashboard = readFileSync("app/page.tsx", "utf8");
const questionSaveActions = readFileSync(
  "app/fragen/editor/actions.ts",
  "utf8",
);
const questionEditor = readFileSync(
  "app/fragen/editor/components/QuestionEditor.tsx",
  "utf8",
);
const questionOverview = readFileSync("app/fragen/FrageSuche.tsx", "utf8");
const questionSearchActions = readFileSync("app/fragen/actions.ts", "utf8");
const overviewControls = readFileSync(
  "app/fragen/components/QuestionOverviewControls.tsx",
  "utf8",
);
const dismissiblePopover = readFileSync(
  "app/components/useDismissiblePopover.ts",
  "utf8",
);
const questionScopeSection = readFileSync(
  "app/fragen/editor/components/QuestionScopeSection.tsx",
  "utf8",
);
const templateFilter = readFileSync(
  "app/fragen/components/TemplateFilterCombobox.tsx",
  "utf8",
);

test("category names are normalized and bounded", () => {
  assert.equal(normalizeCategoryName("  Natur   und Technik  "), "Natur und Technik");
  assert.equal(isValidCategoryName(""), false);
  assert.equal(isValidCategoryName("x".repeat(CATEGORY_NAME_MAX_LENGTH)), true);
  assert.equal(isValidCategoryName("x".repeat(CATEGORY_NAME_MAX_LENGTH + 1)), false);
});

test("category duplicate detection ignores case and whitespace variants", () => {
  const categories = [{ name: "Musik" }];
  assert.equal(isCategoryDuplicate(categories, "musik", "de"), true);
  assert.equal(isCategoryDuplicate(categories, "  Musik  ", "de"), true);
  assert.equal(isCategoryDuplicate(categories, "Mu sik", "de"), false);
});

test("category search ranks exact, prefix, contains and similar matches", () => {
  const categories = [
    { name: "Filmwissen" },
    { name: "Mein Film" },
    { name: "Filme und Serien" },
    { name: "Film" },
    { name: "Sport" },
  ];
  assert.deepEqual(
    rankCategoryMatches(categories, "film", "de").map(
      ({ category, match }) => [category.name, match],
    ),
    [
      ["Film", "EXACT"],
      ["Filme und Serien", "PREFIX"],
      ["Filmwissen", "PREFIX"],
      ["Mein Film", "CONTAINS"],
    ],
  );
});

test("archived categories can be filtered while an assigned one remains visible", () => {
  const categories = [
    { id: 1, name: "Aktiv", status: "ACTIVE" as const },
    { id: 2, name: "Archiv", status: "ARCHIVED" as const },
  ];
  const selectedIds = [2];
  const available = categories.filter(
    (category) =>
      category.status === "ACTIVE" || selectedIds.includes(category.id),
  );
  assert.deepEqual(available.map(({ id }) => id), [1, 2]);
});

test("category lifecycle migration preserves existing categories as active", () => {
  assert.match(schema, /enum CategoryStatus \{\s+ACTIVE\s+PENDING\s+ARCHIVED/);
  assert.match(schema, /status\s+CategoryStatus\s+@default\(ACTIVE\)/);
  assert.match(migration, /DEFAULT 'ACTIVE'/);
  assert.match(migration, /created_by_user_id/);
  assert.doesNotMatch(migration, /DELETE FROM/);
});

test("editor creation is server-authorized and derives active or pending status", () => {
  assert.match(categoryActions, /await requireQuestionEditor\(\)/);
  assert.match(
    categoryActions,
    /canManageCategories\(session\.actor\) \? "ACTIVE" : "PENDING"/,
  );
  assert.doesNotMatch(categoryActions, /role\s*===\s*["']ADMIN["']/);
});

test("category combobox is searchable, keyboard operable, and immediately selects proposals", () => {
  assert.match(categorySection, /role="combobox"/);
  assert.match(categorySection, /role="listbox"/);
  assert.match(categorySection, /event\.key === "ArrowDown"/);
  assert.match(categorySection, /event\.key === "ArrowUp"/);
  assert.match(categorySection, /event\.key === "Enter"/);
  assert.match(categorySection, /createOrSuggestCategory/);
  assert.match(
    categorySection,
    /onChangeCategories\(\[\s+\.\.\.new Set\(\[\.\.\.selectedCategoryIds, result\.category\.id\]\),\s+\]\)/,
  );
  assert.doesNotMatch(categorySection, /CategoryAdminControls/);
});

test("category administration is admin-only and merges in one transaction", () => {
  assert.match(adminPage, /await requireAdmin\(\)/);
  assert.match(dashboard, /href="\/admin\/kategorien"/);
  const writeGuards = adminActions.match(/await requireAdmin\(\)/g) ?? [];
  const exportedWrites = adminActions.match(/export async function /g) ?? [];
  assert.equal(writeGuards.length, exportedWrites.length);
  assert.match(
    adminActions,
    /withSerializableTransaction\(async \(transaction\) => \{[\s\S]*createMany[\s\S]*deleteMany[\s\S]*status: "ARCHIVED"/,
  );
});

test("pending categories require one administrator decision per category", () => {
  assert.throws(
    () =>
      resolvePendingCategoryReview({
        intent: "APPROVE",
        isAdministrator: false,
        selectedCategoryIds: [1],
        pendingCategoryIds: [1],
        decisions: [{ categoryId: 1, action: "APPROVE" }],
      }),
    (error) =>
      error instanceof PendingCategoryReviewError &&
      error.code === "ADMIN_REQUIRED",
  );
  assert.throws(
    () =>
      resolvePendingCategoryReview({
        intent: "APPROVE",
        isAdministrator: true,
        selectedCategoryIds: [1, 2],
        pendingCategoryIds: [1, 2],
        decisions: [{ categoryId: 1, action: "APPROVE" }],
      }),
    (error) =>
      error instanceof PendingCategoryReviewError &&
      error.code === "DECISIONS_REQUIRED",
  );
});

test("pending category decisions retain approved and remove discarded ids", () => {
  assert.deepEqual(
    resolvePendingCategoryReview({
      intent: "APPROVE",
      isAdministrator: true,
      selectedCategoryIds: [1, 2, 3],
      pendingCategoryIds: [2, 3],
      decisions: [
        { categoryId: 2, action: "APPROVE" },
        { categoryId: 3, action: "DISCARD" },
      ],
    }),
    {
      approvedCategoryIds: [2],
      discardedCategoryIds: [3],
      retainedCategoryIds: [1, 2],
    },
  );
});

test("active categories need no approval decision", () => {
  assert.deepEqual(
    resolvePendingCategoryReview({
      intent: "APPROVE",
      isAdministrator: true,
      selectedCategoryIds: [1],
      pendingCategoryIds: [],
      decisions: undefined,
    }),
    {
      approvedCategoryIds: [],
      discardedCategoryIds: [],
      retainedCategoryIds: [1],
    },
  );
});

test("question approval applies category decisions inside the save transaction", () => {
  assert.match(questionEditor, /PendingCategoryReviewDialog/);
  assert.match(questionEditor, /categoryReviewDecisions: decisions/);
  assert.match(
    questionSaveActions,
    /prisma\.\$transaction\(async \(tx\) => \{[\s\S]*resolvePendingCategoryReview/,
  );
  assert.match(questionSaveActions, /data: \{ status: "ACTIVE" \}/);
  assert.match(questionSaveActions, /fragenkategorie\.delete/);
  assert.match(questionSaveActions, /data: \{ status: "ARCHIVED" \}/);
});

test("unused category deletion is guarded and transactional", () => {
  assert.match(adminActions, /export async function deleteUnusedCategory/);
  assert.match(
    adminActions,
    /deleteUnusedCategory[\s\S]*await requireAdmin\(\)[\s\S]*withSerializableTransaction[\s\S]*_count[\s\S]*fragenkategorie\.delete/,
  );
});

test("question overview query parsing ignores unknown values and round-trips filters", () => {
  const parsed = parseQuestionOverviewFilters(
    new URLSearchParams(
      "q=Spielberg&sourceState=with&answerMode=closed&status=APPROVED&status=UNKNOWN&template=face_morph&template=missing&category=7&withoutMedia=1",
    ),
    ["standard", "face_morph"],
    [7],
  );
  assert.deepEqual(parsed, {
    query: "Spielberg",
    sourceState: "with",
    statuses: ["APPROVED"],
    templateIds: ["face_morph"],
    categoryId: 7,
    mediaState: "without",
    answerMode: "closed",
  });
  assert.equal(countAdvancedQuestionFilters(parsed), 6);
  assert.equal(
    serializeQuestionOverviewFilters(parsed).toString(),
    "q=Spielberg&sourceState=with&status=APPROVED&template=face_morph&category=7&mediaState=without&answerMode=closed",
  );
});

test("invalid media and answer modes are ignored", () => {
  const parsed = parseQuestionOverviewFilters(
    new URLSearchParams("mediaState=invalid&answerMode=maybe"),
    [],
    [],
  );
  assert.equal(parsed.mediaState, null);
  assert.equal(parsed.answerMode, null);
});

test("open music questions combine with media and URL filters", () => {
  const parsed = parseQuestionOverviewFilters(
    new URLSearchParams(
      "template=musik_rueckwaerts&answerMode=open&mediaState=with",
    ),
    ["standard", "musik_rueckwaerts"],
    [],
  );
  assert.deepEqual(parsed.templateIds, ["musik_rueckwaerts"]);
  assert.equal(parsed.answerMode, "open");
  assert.equal(parsed.mediaState, "with");
  assert.equal(
    serializeQuestionOverviewFilters(parsed).toString(),
    "template=musik_rueckwaerts&mediaState=with&answerMode=open",
  );
});

test("source state treats URLs, text and trimmed empty values correctly", () => {
  assert.equal(hasQuestionSource("https://example.test/source"), true);
  assert.equal(hasQuestionSource("Buch: Seite 42"), true);
  assert.equal(hasQuestionSource(null), false);
  assert.equal(hasQuestionSource(""), false);
  assert.equal(hasQuestionSource("   \t"), false);
  assert.equal(
    parseQuestionOverviewFilters(
      new URLSearchParams("sourceState=invalid&source=old-free-text"),
      [],
      [],
    ).sourceState,
    null,
  );
  assert.match(questionSearchActions, /BTRIM\(COALESCE\("quelle", ''\)\)/);
  assert.doesNotMatch(overviewControls, /onSourceChange/);
});

test("template filtering is case-insensitive and keeps multiple selections", () => {
  const templates = [
    { id: "standard", name: "Standardfrage" },
    { id: "face_morph", name: "FaceMorph" },
    { id: "pixel_image", name: "Pixelbild" },
  ];
  assert.deepEqual(
    filterTemplateOptions(templates, "FACE").map(({ id }) => id),
    ["face_morph"],
  );
  assert.deepEqual(toggleTemplateFilter(["face_morph"], "pixel_image"), [
    "face_morph",
    "pixel_image",
  ]);
  assert.deepEqual(
    toggleTemplateFilter(["face_morph", "pixel_image"], "face_morph"),
    ["pixel_image"],
  );
  assert.equal(getTemplateFilterDisplayValue(templates, []), "");
  assert.equal(
    getTemplateFilterDisplayValue(templates, ["face_morph"]),
    "FaceMorph",
  );
  assert.equal(
    getTemplateFilterDisplayValue(templates, ["face_morph", "pixel_image"]),
    "2 Templates ausgewählt",
  );
  assert.match(templateFilter, /border-slate-700 bg-slate-50 font-medium/);
});

test("only productive standalone templates are available for filtering", () => {
  const filterableIds = questionTemplateDefinitions
    .filter((template) => template.availableForFiltering)
    .map((template) => template.id);
  assert.ok(filterableIds.includes(questionTemplateIds.standard));
  assert.ok(filterableIds.includes(questionTemplateIds.faceMorph));
  assert.ok(filterableIds.includes(questionTemplateIds.musicReverse));
  assert.ok(filterableIds.includes(questionTemplateIds.pixelImage));
  assert.ok(!filterableIds.includes(questionTemplateIds.multipleChoice));
  assert.ok(!filterableIds.includes(questionTemplateIds.musicEightBit));
});

test("answer mode is derived from central template semantics, not answer count", () => {
  assert.equal(
    getQuestionAnswerMode({
      templateId: questionTemplateIds.standard,
      answers: [],
    }),
    "OPEN",
  );
  assert.equal(
    getQuestionAnswerMode({
      templateId: questionTemplateIds.standard,
      answers: [{ isCorrect: true }, { isCorrect: true }],
    }),
    "OPEN",
  );
  assert.equal(
    getQuestionAnswerMode({
      templateId: questionTemplateIds.standard,
      answers: [{ isCorrect: true }, { isCorrect: false }],
    }),
    "CLOSED",
  );
  assert.equal(
    getQuestionAnswerMode({
      templateId: questionTemplateIds.multipleChoice,
      answers: [],
    }),
    "CLOSED",
  );
  for (const templateId of [
    questionTemplateIds.faceMorph,
    questionTemplateIds.musicReverse,
    questionTemplateIds.pixelImage,
  ]) {
    assert.equal(
      getQuestionAnswerMode({
        templateId,
        answers: [{ isCorrect: false }],
      }),
      "OPEN",
    );
  }
  assert.equal(
    getQuestionAnswerMode({
      templateId: questionTemplateIds.musicReverse,
      answers: [{ isCorrect: true }, { isCorrect: true }],
    }),
    "OPEN",
  );
  assert.equal(
    getQuestionAnswerMode({
      templateId: questionTemplateIds.multipleChoice,
      answers: [{ isCorrect: false }],
      override: "OPEN",
    }),
    "OPEN",
  );
});

test("media and answer-mode filters cover relations and combine with templates", () => {
  assert.match(questionSearchActions, /const mediaCondition/);
  assert.match(questionSearchActions, /antworten: \{ some: \{ medien:/);
  assert.match(questionSearchActions, /antwortfelder: \{ some: \{ medien:/);
  assert.match(questionSearchActions, /const answerModeCondition/);
  assert.match(
    questionSearchActions,
    /getQuestionAnswerModeWhereInput\("CLOSED"\)/,
  );
  assert.match(
    questionSearchActions,
    /templateId === "standard"[\s\S]*getClosedQuestionTemplatePersistenceIds/,
  );
  assert.doesNotMatch(overviewControls, /Nur ohne Antworten/);
  assert.doesNotMatch(overviewControls, /Nur ohne Medien/);
});

test("object and Prisma answer-mode policies use the same transition rule", () => {
  const closedWhere = getQuestionAnswerModeWhereInput("CLOSED");
  const openWhere = getQuestionAnswerModeWhereInput("OPEN");
  assert.deepEqual(
    closedWhere.OR?.some(
      (condition) =>
        typeof condition === "object" &&
        JSON.stringify(condition).includes('"ist_richtig":false') &&
        JSON.stringify(condition).includes('"some"'),
    ),
    true,
  );
  assert.deepEqual(
    openWhere.OR?.some(
      (condition) =>
        typeof condition === "object" &&
        JSON.stringify(condition).includes('"ist_richtig":false') &&
        JSON.stringify(condition).includes('"none"'),
    ),
    true,
  );
  assert.match(questionSearchActions, /answer_mode: getQuestionAnswerMode/);
  assert.match(questionOverview, /frage\.answer_mode === "OPEN"/);
});

test("dismissible popovers close outside and keep inside selection clicks", () => {
  const inside = {} as EventTarget;
  const outside = {} as EventTarget;
  const container = {
    contains: (target: Node | null) => target === inside,
  } as Pick<HTMLElement, "contains">;
  assert.equal(isDismissTargetOutside(container, inside), false);
  assert.equal(isDismissTargetOutside(container, outside), true);
  assert.match(dismissiblePopover, /addEventListener\("pointerdown"/);
  assert.match(dismissiblePopover, /addEventListener\("focusin"/);
  assert.match(dismissiblePopover, /event\.key !== "Escape"/);
  assert.match(dismissiblePopover, /triggerRef\.current\?\.focus\(\)/);
});

test("scope control is compact and preserves event-series choices while toggling", () => {
  assert.match(questionScopeSection, /role="radiogroup"/);
  assert.match(questionScopeSection, /onChange\("GLOBAL", eventSeriesIds\)/);
  assert.match(questionScopeSection, /scope === "EVENT_SERIES"/);
  assert.match(questionScopeSection, /role="combobox"/);
  assert.doesNotMatch(questionScopeSection, /onChange\("GLOBAL", \[\]\)/);
});

test("question overview maps pending categories without per-card queries", () => {
  assert.equal(getPendingCategoryBadgeLabel([]), null);
  assert.equal(
    getPendingCategoryBadgeLabel(["Neue Kategorie"]),
    "Kategorie ungeprüft",
  );
  assert.equal(
    getPendingCategoryBadgeLabel(["Eine", "Zwei"]),
    "2 Kategorien ungeprüft",
  );
  assert.match(questionSearchActions, /pending_kategorien:/);
  assert.match(
    questionSearchActions,
    /entry\.fragenkategorie\.status === "PENDING"/,
  );
  assert.match(questionOverview, /pendingCategoryBadgeLabel/);
  assert.doesNotMatch(questionOverview, /fragenkategorie\.find/);
});

test("question overview combines database filters and keeps URL state", () => {
  assert.match(questionOverview, /useSearchParams/);
  assert.match(questionOverview, /serializeQuestionOverviewFilters/);
  assert.match(questionSearchActions, /statusConditions/);
  assert.match(questionSearchActions, /templateConditions/);
  assert.match(questionSearchActions, /fragen_kategorien: data\.kategorieId/);
  assert.match(questionSearchActions, /take: limit \+ 1/);
  assert.doesNotMatch(dashboard, /\/fragen\?view=/);
  assert.match(dashboard, /\/fragen\?status=REVIEW_QUEUE/);
});
