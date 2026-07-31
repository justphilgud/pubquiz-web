import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import type { AuthorizationActor } from "@/app/roles/roleAssignmentPolicy";
import { resolveAnswerFormTemplate, resolvePresentationTemplate } from "@/app/rendering/templateResolver";
import { resolveQuizTheme } from "@/app/rendering/theme/quizTheme";
import {
  defaultPresentationTemplateConfig,
  parsePresentationTemplateConfig,
  toRuntimeAnswerFormTemplate,
  toRuntimePresentationTemplate,
  validatePresentationTemplateDraft,
  type ManagedPresentationTemplate,
  type PresentationTemplateDraft,
} from "./presentationTemplate";
import { getPresentationTemplateCapabilities } from "./presentationTemplatePermissions";
import {
  canArchivePresentationTemplate,
  canAssignPresentationTemplate,
  canEditPresentationTemplate,
  getPresentationTemplatePageMode,
  requiresDraftRevision,
} from "./presentationTemplateLifecycle";
import { filterPresentationTemplates } from "./templateOverviewPolicy";
import { presentationPreviewScenarios } from "./PresentationTemplatePreview";
import { selectDeterministicTemplateImage } from "./deterministicTemplateImage";
import { applyPresentationStylePreset, createPresentationStylePreset } from "./presentationTemplatePresets";
import { templateRegistry } from "@/app/rendering/templateRegistry";

function draft(): PresentationTemplateDraft {
  return {
    id: "sommer-2026", name: "Sommer 2026", description: "Helles Bühnendesign",
    status: "DRAFT", tags: ["Sommer"], sourceTemplateId: "ungegoogelt-default",
    config: structuredClone(defaultPresentationTemplateConfig),
  };
}

test("validates and normalizes a complete presentation template draft", () => {
  const result = validatePresentationTemplateDraft(draft());
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.id, "sommer-2026");
});

test("rejects missing names, invalid ids, colors, fonts and unknown tokens", () => {
  const value = draft();
  value.id = "Ungültig";
  value.name = "";
  value.config.tokens.colors.primary = "red" as `#${string}`;
  value.config.tokens.typography.family = "external-font" as typeof value.config.tokens.typography.family;
  Object.assign(value.config.tokens.colors, { injected: "#ffffff" });
  const result = validatePresentationTemplateDraft(value);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some(({ field }) => field === "id"));
    assert.ok(result.errors.some(({ field }) => field === "name"));
    assert.ok(result.errors.some(({ field }) => field.endsWith("primary")));
    assert.ok(result.errors.some(({ field }) => field.includes("typography")));
    assert.ok(result.errors.some(({ field }) => field.endsWith("injected")));
  }
});

test("blocks severely unreadable active themes but only warns for drafts", () => {
  const value = draft();
  value.config.tokens.colors.text = "#000000";
  value.config.tokens.colors.background = "#000000";
  assert.equal(validatePresentationTemplateDraft(value).ok, true);
  value.status = "ACTIVE";
  assert.equal(validatePresentationTemplateDraft(value).ok, false);
});

test("rejects incomplete stored configuration for safe resolver fallback", () => {
  assert.equal(parsePresentationTemplateConfig({ version: 1, tokens: {} }), null);
});

test("normalizes legacy configurations and validates all semantic design styles", () => {
  const legacy = structuredClone(defaultPresentationTemplateConfig) as Partial<typeof defaultPresentationTemplateConfig>;
  delete legacy.design;
  assert.equal(parsePresentationTemplateConfig(legacy)?.design.stylePreset, "NEON");
  for (const style of ["NEON", "CORPORATE", "BIRTHDAY"] as const) {
    assert.equal(validatePresentationTemplateDraft({ ...draft(), config: createPresentationStylePreset(style) }).ok, true);
  }
});

test("rejects unknown styles, external assets and executable design fields", () => {
  const invalid = draft();
  invalid.config.design.stylePreset = "SCRIPT" as typeof invalid.config.design.stylePreset;
  invalid.config.design.imagery.heroImage = "https://example.test/a.jpg" as `/${string}`;
  Object.assign(invalid.config.design.composition, { component: "<script>alert(1)</script>" });
  Object.assign(invalid.config, { customCss: "body { display: none }" });
  const result = validatePresentationTemplateDraft(invalid);
  assert.equal(result.ok, false);
  const injected = draft();
  Object.assign(injected.config.design.composition, { component: "<script>alert(1)</script>" });
  const injectedResult = validatePresentationTemplateDraft(injected);
  assert.equal(injectedResult.ok, false);
  if (!injectedResult.ok) assert.ok(injectedResult.errors.some(({ message }) => message.includes("ausführbare")));
});

test("presets are structurally distinct and preserve personal imagery when switching", () => {
  const neon = createPresentationStylePreset("NEON");
  const corporate = createPresentationStylePreset("CORPORATE");
  const birthday = createPresentationStylePreset("BIRTHDAY");
  assert.notDeepEqual(corporate.design.composition, neon.design.composition);
  assert.equal(birthday.design.composition.mediaTreatment, "POLAROID");
  birthday.design.imagery.personalImagePool = ["/medien/template-preview.svg"];
  assert.deepEqual(applyPresentationStylePreset(birthday, "CORPORATE").design.imagery.personalImagePool, birthday.design.imagery.personalImagePool);
  assert.ok(templateRegistry.presentation.some(({ id }) => id === "corporate-reference"));
  assert.ok(templateRegistry.presentation.some(({ id }) => id === "birthday-reference"));
});

test("birthday image selection is deterministic with safe zero, one and multi-image fallbacks", () => {
  const input = { quizId: 7, questionId: 11, phase: "QUESTION" as const };
  assert.equal(selectDeterministicTemplateImage([], input), null);
  assert.equal(selectDeterministicTemplateImage(["/one.jpg"], input), "/one.jpg");
  const images = ["/two.jpg", "/one.jpg"];
  const question = selectDeterministicTemplateImage(images, input);
  assert.equal(question, selectDeterministicTemplateImage(images, input));
  assert.notEqual(question, selectDeterministicTemplateImage(images, { ...input, phase: "SOLUTION" }));
  assert.equal(selectDeterministicTemplateImage(["javascript:alert(1)"], input), null);
});

test("custom visual template resolves through the shared theme contract", () => {
  const managed = { id: "sommer-2026", name: "Sommer 2026", config: draft().config };
  const theme = resolveQuizTheme({
    displayName: "Sommerquiz",
    presentation: resolvePresentationTemplate({ quizTemplateId: managed.id, additionalPresentationTemplates: [toRuntimePresentationTemplate(managed)] }),
    answerForm: resolveAnswerFormTemplate({ eventSeriesTemplateId: managed.id, additionalAnswerFormTemplates: [toRuntimeAnswerFormTemplate(managed)] }),
  });
  assert.equal(theme.source.presentationTemplateId, managed.id);
  assert.equal(theme.source.answerFormTemplateId, managed.id);
  assert.equal(theme.colors.primary, managed.config.tokens.colors.primary);
  assert.equal(theme.moderation.variant, managed.config.surfaces.moderation);
});

test("overview filters by text, status and source", () => {
  const base: ManagedPresentationTemplate = {
    id: "system", name: "System", description: null, status: "SYSTEM", source: "SYSTEM",
    isSystem: true, contractVersion: 1, config: draft().config, tags: [], sourceTemplateId: null,
    creatorName: null, updatedAt: null, usageCount: 0,
  };
  const user = { ...base, id: "sommer", name: "Sommer", status: "ACTIVE" as const, source: "USER" as const, isSystem: false, tags: ["Bühne"] };
  assert.deepEqual(filterPresentationTemplates([base, user], { query: "bühne" }).map(({ id }) => id), ["sommer"]);
  assert.deepEqual(filterPresentationTemplates([base, user], { status: "SYSTEM" }).map(({ id }) => id), ["system"]);
  assert.deepEqual(filterPresentationTemplates([base, user], { source: "USER" }).map(({ id }) => id), ["sommer"]);
});

test("template management capabilities are admin-only in the MVP", () => {
  const admin: AuthorizationActor = { userId: 1, assignments: [{ role: "ADMIN", scopeType: "GLOBAL", eventSeriesId: null }] };
  const editor: AuthorizationActor = { userId: 2, assignments: [{ role: "EDITOR", scopeType: "GLOBAL", eventSeriesId: null }] };
  assert.equal(getPresentationTemplateCapabilities(admin).canActivate, true);
  assert.equal(getPresentationTemplateCapabilities(editor).canView, false);
});

test("template lifecycle keeps active versions immutable and assignments stable", () => {
  assert.equal(getPresentationTemplatePageMode({ isSystem: true, status: "SYSTEM" }), "SYSTEM_READ_ONLY");
  assert.equal(getPresentationTemplatePageMode({ isSystem: false, status: "DRAFT" }), "DRAFT_EDIT");
  assert.equal(getPresentationTemplatePageMode({ isSystem: false, status: "ACTIVE" }), "ACTIVE_READ_ONLY");
  assert.equal(getPresentationTemplatePageMode({ isSystem: false, status: "ARCHIVED" }), "ARCHIVED_READ_ONLY");
  assert.equal(canEditPresentationTemplate({ isSystem: false, status: "DRAFT" }), true);
  assert.equal(canEditPresentationTemplate({ isSystem: false, status: "ACTIVE" }), false);
  assert.equal(canEditPresentationTemplate({ isSystem: true, status: "SYSTEM" }), false);
  assert.equal(requiresDraftRevision({ isSystem: false, status: "ACTIVE" }), true);
  assert.equal(canAssignPresentationTemplate("ACTIVE"), true);
  assert.equal(canAssignPresentationTemplate("DRAFT"), false);
  assert.equal(canAssignPresentationTemplate("ARCHIVED"), false);
});

test("used templates cannot be archived", () => {
  const template = {
    isSystem: false,
    status: "ACTIVE" as const,
    usageCount: 0,
  };
  assert.equal(canArchivePresentationTemplate(template), true);
  assert.equal(canArchivePresentationTemplate({ ...template, usageCount: 1 }), false);
  assert.equal(canArchivePresentationTemplate({ ...template, isSystem: true }), false);
});

test("preview matrix is complete and uses productive renderer and layout resolver", () => {
  assert.deepEqual(presentationPreviewScenarios.map(([id]) => id), ["TEXT", "IMAGE", "MULTIPLE_CHOICE", "TRUE_FALSE", "AUDIO", "ORDERING", "PIXEL", "SOLUTION", "MODERATION", "ANSWER_FORM", "BIRTHDAY_IMAGE", "BIRTHDAY_SOLUTION", "BIRTHDAY_FALLBACK", "CORPORATE_LOGO", "CORPORATE_MEDIA", "CORPORATE_SOLUTION"]);
  const source = readFileSync("app/rendering/presentationTemplates/PresentationTemplatePreview.tsx", "utf8");
  assert.match(source, /PresentationSlideRenderer/);
  assert.match(source, /resolvePresentationLayout/);
  assert.doesNotMatch(source, /function resolve.*Layout/);
  assert.doesNotMatch(source, /src=.["']\/medien\/vorschau\.mp3/);
  assert.match(source, /data-preview-scale-container/);
  assert.match(source, /data-preview-fixed-stage/);
  assert.match(source, /transformOrigin: "top left"/);
});

test("semantic renderer variants remove corporate glow and expose birthday album treatment", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /data-design-style="CORPORATE"/);
  assert.match(css, /CORPORATE[\s\S]+box-shadow: none !important/);
  assert.match(css, /CORPORATE[\s\S]+drop-shadow/);
  assert.match(css, /CORPORATE[\s\S]+text-pink/);
  assert.match(css, /data-design-style="BIRTHDAY"/);
  assert.match(css, /presentation-personal-image/);
});

test("routes and writes enforce admin authorization and migration remains additive", () => {
  for (const file of ["app/templates/page.tsx", "app/templates/new/page.tsx", "app/templates/[templateId]/page.tsx", "app/rendering/presentationTemplates/actions.ts"]) {
    assert.match(readFileSync(file, "utf8"), /requireAdmin/);
  }
  const migration = readFileSync("prisma/migrations/20260731120000_add_presentation_template_management/migration.sql", "utf8");
  assert.match(migration, /CREATE TABLE "pubquiz"\."presentation_templates"/);
  assert.match(migration, /CHECK \("status" IN \('DRAFT', 'ACTIVE', 'ARCHIVED'\)\)/);
  assert.doesNotMatch(migration, /DROP TABLE|ALTER TABLE .* DROP/);
});

test("writes enforce immutable active versions and optimistic concurrency", () => {
  const actions = readFileSync("app/rendering/presentationTemplates/actions.ts", "utf8");
  const detail = readFileSync("app/templates/[templateId]/page.tsx", "utf8");
  const generator = readFileSync("app/rendering/presentationTemplates/PresentationTemplateGenerator.tsx", "utf8");
  const duplicateButton = readFileSync("app/rendering/presentationTemplates/DuplicatePresentationTemplateButton.tsx", "utf8");
  assert.match(actions, /existing\.status !== "DRAFT"/);
  assert.match(actions, /updateMany/);
  assert.match(actions, /updated_at: expectedDate/);
  assert.match(actions, /status: "DRAFT"/);
  assert.match(actions, /source_template_id: source\.id/);
  assert.match(detail, /pageMode={pageMode}/);
  assert.match(detail, /requiresDraftRevision/);
  assert.match(detail, /Systemtemplate – schreibgeschützte Vorschau/);
  assert.match(detail, /Als eigenes Template verwenden/);
  assert.match(generator, /beforeunload/);
  assert.match(generator, /warnBeforeClientNavigation/);
  assert.match(generator, /skipLeaveWarning\.current = true/);
  assert.match(generator, /data-generator-active-section/);
  assert.match(generator, /aria-current/);
  assert.doesNotMatch(generator, /href={`#\$\{id\}`}/);
  assert.match(duplicateButton, /submissionStarted\.current/);
  assert.match(duplicateButton, /role="alert"/);
  assert.match(duplicateButton, /router\.push\(`\/templates\/\$\{result\.templateId\}`\)/);
});
