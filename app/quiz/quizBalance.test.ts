import assert from "node:assert/strict";
import { isQuizMode, normalizeQuizMode } from "./quizMode";
import test from "node:test";
import { questionTemplateIds, resolveCanonicalQuestionTemplateId } from "@/app/fragen/editor/templates/questionTemplateRegistry";
import { parseContentFilters, selectedContentTemplateIds, serializeContentFilters } from "@/app/components/content/contentLibrary";
import { balanceStatus, BALANCE_TEMPLATE_GROUPS, getQuizBalance, questionBalanceGroup, type BalanceQuestion, type BalanceGroup, type BalanceStatus } from "./quizBalance";

const q = (changes: Partial<BalanceQuestion> = {}): BalanceQuestion => ({ sectionId: 1, templateId: "standard", answerMode: "OPEN", categoryIds: [], ...changes });

for (const [group, boundaries] of Object.entries({
  open: [[49,"RED"],[50,"YELLOW"],[100,"YELLOW"],[101,"GREEN"],[200,"GREEN"],[201,"YELLOW"],[250,"YELLOW"],[251,"RED"]],
  closed: [[99,"RED"],[100,"YELLOW"],[149,"YELLOW"],[150,"GREEN"],[500,"GREEN"],[501,"YELLOW"],[600,"YELLOW"],[601,"RED"]],
  audio: [[99,"RED"],[100,"YELLOW"],[149,"YELLOW"],[150,"GREEN"],[250,"GREEN"],[251,"YELLOW"],[300,"YELLOW"],[301,"RED"]],
  category: [[0,"NONE"],[1,"GREEN"],[99,"GREEN"],[100,"YELLOW"],[200,"YELLOW"],[201,"RED"]],
})) test(`${group}: every exact user boundary and both adjacent ranges`, () => {
  for (const [count, status] of boundaries) assert.equal(balanceStatus(group as BalanceGroup | "category", Number(count), 1000), status as BalanceStatus, `${group} ${count}/1000`);
});

test("presence groups never have yellow, polls and estimates never receive a light", () => {
  for (const group of ["facts", "image", "creative", "ordering", "pairs", "trueFalse"] as const) {
    assert.equal(balanceStatus(group, 0, 20), "RED");
    assert.equal(balanceStatus(group, 1, 20), "GREEN");
    assert.equal(balanceStatus(group, 20, 20), "GREEN");
  }
  for (const group of ["poll", "estimate"] as const) for (const count of [0, 1, 20]) assert.equal(balanceStatus(group, count, 20), "NONE");
  assert.equal(balanceStatus("open", 1000, 9999), "GREEN", "never round 10.001% into yellow");
  assert.equal(balanceStatus("audio", 0, 0), "NONE");
});

test("all current registry templates belong to a deliberate disjoint group, aliases use the same policy", () => {
  assert.deepEqual(Object.keys(BALANCE_TEMPLATE_GROUPS).sort(), Object.values(questionTemplateIds).sort());
  assert.equal(questionBalanceGroup(q()), "open");
  assert.equal(questionBalanceGroup(q({ answerMode: "CLOSED" })), "closed");
  assert.equal(questionBalanceGroup(q({ templateId: "wahr_falsch", answerMode: "CLOSED" })), "trueFalse");
  for (const id of ["musik", "music-reverse", "musik_8bit", "uebersetzt_vorgelesen"]) assert.equal(questionBalanceGroup(q({ templateId: id })), "audio");
  assert.equal(questionBalanceGroup(q({ templateId: "image_pixel" })), "image");
  assert.equal(questionBalanceGroup(q({ templateId: "unregistered" })), "unknown");
  assert.equal(resolveCanonicalQuestionTemplateId("standard"), null);
});

test("each block owns its denominator, duplicate categories count once, zero categories stay hidden", () => {
  const result = getQuizBalance({
    questions: [q({ templateId: "musik", categoryIds: [1,1] }), ...Array.from({ length: 9 }, () => q()), ...Array.from({ length: 4 }, () => q({ sectionId: 2 })), q({ sectionId: null })],
    sections: [{ id: 1, title: "A" }, { id: 2, title: "B" }], categories: [{ id: 1, name: "Kultur" }, { id: 2, name: "Film" }],
  });
  assert.deepEqual(result.blocks.map(b => b.total), [10, 4]);
  assert.equal(result.blocks[0].categories[0].count, 1);
  assert.equal(result.blocks[0].categories[0].status, "YELLOW");
  assert.equal(result.blocks[0].categories.length, 1);
  assert.equal(result.blocks[1].categories.length, 0);
  assert.equal(result.unassigned, 1);
});

test("two blocks need three audio questions in at least one block, not both", () => {
  const sections = [{ id: 1, title: "A" }, { id: 2, title: "B" }];
  const input = { sections, categories: [], questions: [q({ templateId: "musik" }),q({ templateId: "musik" }),q({ templateId: "musik", sectionId: 2 }),q({ templateId: "musik", sectionId: 2 })] };
  assert.equal(getQuizBalance(input).audioRule?.status, "RED");
  assert.equal(getQuizBalance({ ...input, questions: [...input.questions,q({ templateId: "musik" })] }).audioRule?.status, "GREEN");
  assert.equal(getQuizBalance({ ...input, sections: sections.slice(0,1) }).audioRule, null);
  assert.equal(getQuizBalance({ ...input, questions: [] }).audioRule?.status, "NONE");
});

test("recommendations combine real category and all audio filters, round-trip to actual active search", () => {
  const result = getQuizBalance({ questions: Array.from({ length: 10 }, () => q({ categoryIds: [1] })), sections: [{ id: 1, title: "A" }], categories: [{ id: 1, name: "Politik" },{ id: 2, name: "Kultur" }] });
  const audio = result.blocks[0].recommendations.find(r => r.label.startsWith("Audio"))!;
  const params = new URL(audio.href, "https://quiz.invalid").searchParams;
  assert.equal(params.get("categoryId"), "2");
  assert.deepEqual(params.getAll("template").sort(), ["musik", "musik_rueckwaerts", "eight_bit", "uebersetzt_vorgelesen"].sort());
  const filters = parseContentFilters(params, "QUESTION", Object.values(questionTemplateIds));
  assert.equal(filters.categoryIds[0], 2);
  assert.equal(selectedContentTemplateIds(filters).length, 4);
  assert.equal(filters.eventSeriesId, null, "recommendations must also find globally reusable questions");
  assert.deepEqual(serializeContentFilters(filters).getAll("template"), params.getAll("template"));
});

test("one template from a presence group suffices, recommendations never demand every member", () => {
  const result = getQuizBalance({ questions: [q({ templateId: "pixelbild" })], sections: [{ id: 1, title: "A" }], categories: [] });
  assert.equal(result.blocks[0].groups.find(g => g.id === "image")?.status, "GREEN");
  assert.ok(!result.blocks[0].recommendations.some(r => r.label.startsWith("Bild")));
});

test("closed recommendations exclude open standard and do not broaden into true/false", () => {
  const result = getQuizBalance({ questions: [q()], sections: [{ id: 1, title: "A" }], categories: [] });
  const href = result.blocks[0].recommendations.find(r => r.label.startsWith("Geschlossene"))!.href;
  const filters = parseContentFilters(new URL(href, "https://quiz.invalid").searchParams, "QUESTION", Object.values(questionTemplateIds));
  assert.equal(filters.answerMode, "closed");
  assert.deepEqual(selectedContentTemplateIds(filters), ["standard", "multiple_choice"]);
});

test("quiz mode defaults to varied and rejects arbitrary submitted values", () => {
  assert.equal(normalizeQuizMode(undefined), "VARIED");
  assert.equal(normalizeQuizMode("invalid"), "VARIED");
  assert.equal(isQuizMode("invalid"), false);
  assert.equal(isQuizMode(null), false);
  assert.equal(isQuizMode("THEMED"), true);
});

test("Film-only themed quiz keeps categories neutral without worsening green templates", () => {
  const templates = ["standard", "standard", "standard", ...Array(6).fill("multiple_choice"),
    ...Array(3).fill("musik"), "fakten_person", "fakten_jahr", "pixelbild", "anagramm", "reihenfolge", "paare_bilden", "wahr_falsch", "schaetzfrage"];
  const input = { questions: templates.map(templateId => q({ templateId, categoryIds: [1] })),
    sections: [{ id: 1, title: "Filmblock" }], categories: [{ id: 1, name: "Film" }, { id: 2, name: "Politik" }] };
  const varied = getQuizBalance(input);
  const themed = getQuizBalance({ ...input, mode: "THEMED" });
  assert.equal(varied.blocks[0].categories[0].status, "RED");
  assert.equal(varied.status, "RED");
  assert.equal(themed.blocks[0].categories[0].count, 20);
  assert.equal(themed.blocks[0].categories[0].status, "NONE");
  assert.equal(themed.status, "GREEN");
  assert.deepEqual(themed.blocks[0].recommendations, []);
  assert.deepEqual(getQuizBalance({ ...input, mode: "VARIED" }), varied);
});

test("themed quiz preserves block template warnings and recommendations without category filters", () => {
  const input = { mode: "THEMED" as const, questions: Array.from({ length: 10 }, () => q({ categoryIds: [1] })),
    sections: [{ id: 1, title: "A" }, { id: 2, title: "B" }], categories: [{ id: 1, name: "Film" }, { id: 2, name: "Politik" }] };
  const result = getQuizBalance(input);
  assert.equal(result.status, "RED");
  assert.equal(result.blocks[0].groups.find(g => g.id === "open")?.status, "RED");
  assert.equal(result.blocks[1].total, 0);
  assert.equal(result.blocks[1].status, "NONE");
  assert.equal(result.audioRule?.status, "RED");
  assert.ok(result.blocks[0].recommendations.some(r => r.label.startsWith("Audio")));
  assert.ok(result.blocks.flatMap(b => b.recommendations).every(r => {
    const params = new URL(r.href, "https://quiz.invalid").searchParams;
    return params.has("template") && !params.has("categoryId");
  }));
});
