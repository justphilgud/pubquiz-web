import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { AuthorizationActor } from "@/app/roles/roleAssignmentPolicy";
import { resolveAnswerFormTemplate, resolvePresentationTemplate } from "@/app/rendering/templateResolver";
import { quizThemeStyle, resolveQuizTheme } from "@/app/rendering/theme/quizTheme";
import {
  PresentationDesignBackdrop,
  PresentationDesignHeader,
} from "@/app/rendering/presentation/PresentationDesignSystem";
import {
  defaultPresentationTemplateConfig,
  normalizeTemplateTags,
  presentationTemplateOptions,
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
import {
  PresentationTemplatePreview,
  presentationPreviewScenarios,
} from "./PresentationTemplatePreview";
import { selectDeterministicTemplateImage } from "./deterministicTemplateImage";
import { getStorybookPeopleMode, getStorybookTitle } from "./storybook";
import { resolveStorybookComposition } from "./storybookComposition";
import { applyPresentationStylePreset, createPresentationStylePreset } from "./presentationTemplatePresets";
import { templateRegistry } from "@/app/rendering/templateRegistry";
import {
  buildPresentationTemplateAssetPathname,
  isAllowedPresentationTemplateAssetPathname,
  isSafeTemplateAssetReference,
  presentationTemplateAssetRolesByStyle,
  resolvePresentationTemplateRuntimeAssets,
  validatePresentationTemplateAssetFile,
} from "./presentationTemplateAssets";
import {
  readBlobStoreIdFromToken,
  resolvePresentationTemplateUploadPolicy,
} from "./presentationTemplateUploadPolicy";

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
  const legacyBirthday = createPresentationStylePreset("BIRTHDAY") as unknown as { design: { imagery: { solutionImage?: string | null } } };
  delete legacyBirthday.design.imagery.solutionImage;
  assert.equal(parsePresentationTemplateConfig(legacyBirthday)?.design.imagery.solutionImage, createPresentationStylePreset("BIRTHDAY").design.imagery.solutionImage);
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

test("style changes own composition and surfaces without creating event personalization", () => {
  const current = createPresentationStylePreset("NEON");
  current.design.imagery.heroImage = "/hero.jpg";
  const birthday = applyPresentationStylePreset(current, "BIRTHDAY");
  assert.equal(birthday.design.composition.layoutPreset, "COLLAGE");
  assert.deepEqual(birthday.surfaces, createPresentationStylePreset("BIRTHDAY").surfaces);
  assert.equal(birthday.design.imagery.heroImage, "/hero.jpg");
  assert.equal(birthday.design.storybook?.sharedTitle, "Unsere gemeinsame Geschichte");
  assert.deepEqual(birthday.design.storybook?.people, []);
});

test("legacy personalization and layout values remain parseable after their controls are removed", () => {
  const legacy = createPresentationStylePreset("CORPORATE");
  legacy.design.composition.layoutPreset = "MAGAZINE";
  legacy.design.occasion.personName = "Bestandswert";
  legacy.design.occasion.eventTitle = "Bestehende Veranstaltung";
  const parsed = parsePresentationTemplateConfig(legacy);
  assert.equal(parsed?.design.composition.layoutPreset, "MAGAZINE");
  assert.equal(parsed?.design.occasion.personName, "Bestandswert");
  assert.equal(parsed?.design.occasion.eventTitle, "Bestehende Veranstaltung");
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
  const blob = "https://assets.public.blob.vercel-storage.com/dev/template-media/example/image.webp";
  assert.equal(selectDeterministicTemplateImage([blob], input), blob);
});

function storybookConfig(names: readonly string[]) {
  const config = createPresentationStylePreset("BIRTHDAY");
  assert.ok(config.design.storybook);
  config.design.storybook.people = names.map((name) => ({ id: name.toLowerCase(), name, age: null, subtitle: null, portrait: null }));
  config.design.storybook.sharedTitle = names.length > 0 ? names.join(" & ") : "Unsere gemeinsame Geschichte";
  config.design.storybook.assets = [];
  config.design.storybook.anecdotes = [];
  config.design.storybook.chapters = [];
  return config;
}

test("storybook normalizes the legacy birthday person into a stable one-person model", () => {
  const legacy = createPresentationStylePreset("BIRTHDAY") as unknown as { design: Record<string, unknown> & { occasion: { personName: string; age: string }; imagery: { heroImage: string } } };
  delete legacy.design.storybook;
  legacy.design.occasion.personName = "Migge";
  legacy.design.occasion.age = "40";
  const parsed = parsePresentationTemplateConfig(legacy);
  assert.ok(parsed?.design.storybook);
  assert.deepEqual(parsed.design.storybook.people.map(({ id, name, age }) => ({ id, name, age })), [{ id: "migge", name: "Migge", age: "40" }]);
});

test("storybook supports one, two, three and larger equal-order person groups", () => {
  for (const [names, mode] of [
    [["Migge"], "SINGLE"],
    [["Migge", "Paul"], "DUAL"],
    [["Philipp", "Gabi", "Helena"], "TRIO"],
    [["A", "B", "C", "D"], "GROUP"],
  ] as const) {
    const config = storybookConfig(names);
    assert.equal(validatePresentationTemplateDraft({ ...draft(), config }).ok, true);
    assert.equal(getStorybookPeopleMode(config.design.storybook!.people), mode);
    assert.deepEqual(config.design.storybook!.people.map(({ name }) => name), names);
  }
  const titleOnly = storybookConfig([]);
  assert.equal(validatePresentationTemplateDraft({ ...draft(), config: titleOnly }).ok, true);
  assert.equal(getStorybookTitle(titleOnly.design.storybook!), "Unsere gemeinsame Geschichte");
});

test("storybook rejects duplicate people and orphaned or unsafe asset assignments", () => {
  const config = storybookConfig(["Migge", "Paul"]);
  config.design.storybook!.people[1].id = "migge";
  config.design.storybook!.assets = [{ id: "bad", source: "https://example.test/bad.jpg" as `/${string}`, role: "PORTRAIT", personIds: ["unknown"], alt: "", caption: null, year: null, order: 0 }];
  const result = validatePresentationTemplateDraft({ ...draft(), config });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some(({ message }) => message.includes("eindeutig")));
    assert.ok(result.errors.some(({ message }) => message.includes("unbekannte Person")));
    assert.ok(result.errors.some(({ message }) => message.includes("Assetpfad")));
  }
});

test("storybook composition is deterministic and uses curated data fallbacks", () => {
  const config = storybookConfig(["Migge", "Paul"]);
  const storybook = config.design.storybook!;
  storybook.assets = [
    { id: "migge", source: "/migge.jpg", role: "PORTRAIT", personIds: ["migge"], alt: "Migge", caption: null, year: null, order: 0 },
    { id: "paul", source: "/paul.jpg", role: "PORTRAIT", personIds: ["paul"], alt: "Paul", caption: null, year: null, order: 1 },
    { id: "together", source: "/together.jpg", role: "SOLUTION", personIds: ["migge", "paul"], alt: "Gemeinsam", caption: null, year: "2024", order: 2 },
  ];
  const context = { storybook, quizId: 7, questionId: 12, phase: "QUESTION" as const, contentKind: "IMAGE" as const, requestedPersonIds: ["migge", "paul"] };
  const first = resolveStorybookComposition(context);
  assert.deepEqual(resolveStorybookComposition(context), first);
  assert.equal(first.peopleMode, "DUAL");
  assert.equal(first.variant, "SPLIT");
  assert.equal(new Set(first.assets.map(({ source }) => source)).size, first.assets.length);
  const solution = resolveStorybookComposition({ ...context, phase: "SOLUTION" });
  assert.equal(solution.variant, "MEMORY");
  assert.equal(solution.assets[0].role, "SOLUTION");
  const noImages = resolveStorybookComposition({ ...context, storybook: { ...storybook, assets: [] } });
  assert.equal(noImages.variant, "EDITORIAL");
});

test("storybook rotates leading people and portrait assets fairly across the quiz sequence", () => {
  const config = storybookConfig(["Migge", "Paul", "Philipp", "Gabi", "Helena"]);
  const storybook = config.design.storybook!;
  storybook.assets = storybook.people.map((person, index) => ({
    id: `portrait-${person.id}`,
    source: `/portrait-${index}.jpg` as `/${string}`,
    role: "PORTRAIT",
    personIds: [person.id],
    alt: person.name,
    caption: null,
    year: null,
    order: index,
  }));
  const compositions = storybook.people.map((_, sequenceIndex) => resolveStorybookComposition({
    storybook,
    quizId: 7,
    questionId: sequenceIndex + 1,
    sequenceIndex,
    phase: "QUESTION",
    contentKind: "IMAGE",
  }));
  assert.deepEqual(compositions.map(({ people }) => people[0].name), storybook.people.map(({ name }) => name));
  assert.ok(compositions.every(({ people, assets }) => assets[0].personIds.includes(people[0].id)));
  assert.ok(compositions.every(({ variant }) => variant === "SEQUENCE"));
});

test("storybook optional anecdotes and chapters never create empty render data", () => {
  const config = storybookConfig(["Philipp", "Gabi", "Helena"]);
  const storybook = config.design.storybook!;
  const base = { storybook, quizId: 1, questionId: 1, phase: "QUESTION" as const };
  assert.equal(resolveStorybookComposition(base).anecdote, null);
  storybook.anecdotes = [{ id: "school", text: "Eine gemeinsame Erinnerung", personIds: [], year: null }];
  storybook.chapters = [{ id: "childhood", title: "Kindheit", subtitle: null, personIds: [], order: 0 }];
  assert.equal(resolveStorybookComposition(base).anecdote, null);
  assert.equal(resolveStorybookComposition({ ...base, phase: "SOLUTION" }).anecdote?.text, "Eine gemeinsame Erinnerung");
  assert.equal(resolveStorybookComposition({ ...base, contentKind: "CHAPTER" }).variant, "CHAPTER");
  assert.doesNotMatch(readFileSync("app/rendering/presentationTemplates/storybookComposition.ts", "utf8"), /Math\.random/);
});

test("template asset roles use the central environment-prefixed blob model", () => {
  assert.deepEqual(
    presentationTemplateAssetRolesByStyle.BIRTHDAY.map(({ role }) => role),
    ["LOGO", "HERO_IMAGE", "IMAGE_POOL", "SOLUTION_IMAGE", "DECORATION"],
  );
  assert.deepEqual(
    presentationTemplateAssetRolesByStyle.CORPORATE.map(({ role }) => role),
    ["LOGO", "HERO_IMAGE", "BACKGROUND", "DECORATION"],
  );
  const pathname = buildPresentationTemplateAssetPathname(
    "dev",
    "mein-template",
    "HERO_IMAGE",
    "bild.webp",
  );
  assert.equal(pathname, "dev/template-media/mein-template/hero_image/bild.webp");
  assert.equal(
    isAllowedPresentationTemplateAssetPathname(
      pathname,
      "dev",
      "mein-template",
      "HERO_IMAGE",
    ),
    true,
  );
  assert.equal(
    isAllowedPresentationTemplateAssetPathname(
      pathname,
      "preview",
      "mein-template",
      "HERO_IMAGE",
    ),
    false,
  );
  assert.equal(isSafeTemplateAssetReference("/medien/bilder/Mein Bild.jpg"), true);
  assert.equal(
    isSafeTemplateAssetReference(
      "https://assets.public.blob.vercel-storage.com/dev/template-media/mein-template/bild.webp",
    ),
    true,
  );
  assert.equal(isSafeTemplateAssetReference("https://example.test/bild.jpg"), false);
  assert.equal(
    validatePresentationTemplateAssetFile({
      name: "bild.webp",
      size: 1024,
      type: "image/webp",
    }),
    null,
  );
  assert.match(
    validatePresentationTemplateAssetFile({
      name: "bild.gif",
      size: 1024,
      type: "image/gif",
    }) ?? "",
    /PNG/,
  );
  assert.match(
    validatePresentationTemplateAssetFile({
      name: "zu-gross.png",
      size: 10 * 1024 * 1024 + 1,
      type: "image/png",
    }) ?? "",
    /höchstens 10 MB/,
  );
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

test("template asset references survive persistence, replacement, removal and preset changes", () => {
  const firstBlob = "https://assets.public.blob.vercel-storage.com/dev/template-media/sommer-2026/logo/first.png" as const;
  const secondBlob = "https://assets.public.blob.vercel-storage.com/dev/template-media/sommer-2026/logo/second.png" as const;
  const background = "/medien/bilder/hintergrund.jpg" as const;
  const hero = "https://assets.public.blob.vercel-storage.com/dev/template-media/sommer-2026/hero_image/hero.webp" as const;
  const decoration = "/medien/bilder/dekoration.png" as const;
  const value = draft();
  value.config.tokens.assets.logo = firstBlob;
  value.config.tokens.assets.backgroundImage = background;
  value.config.design.imagery.heroImage = hero;
  value.config.design.imagery.decorativeImages = [decoration];

  const reloaded = parsePresentationTemplateConfig(
    JSON.parse(JSON.stringify(value.config)),
  );
  assert.ok(reloaded);
  assert.equal(reloaded.tokens.assets.logo, firstBlob);
  assert.equal(reloaded.tokens.assets.backgroundImage, background);
  assert.equal(reloaded.design.imagery.heroImage, hero);
  assert.deepEqual(reloaded.design.imagery.decorativeImages, [decoration]);

  reloaded.tokens.assets.logo = secondBlob;
  assert.equal(
    parsePresentationTemplateConfig(JSON.parse(JSON.stringify(reloaded)))
      ?.tokens.assets.logo,
    secondBlob,
  );
  reloaded.tokens.assets.logo = null;
  reloaded.tokens.assets.backgroundImage = null;
  reloaded.design.imagery.heroImage = null;
  reloaded.design.imagery.decorativeImages = [];
  const removed = parsePresentationTemplateConfig(
    JSON.parse(JSON.stringify(reloaded)),
  );
  assert.equal(removed?.tokens.assets.logo, null);
  assert.equal(removed?.tokens.assets.backgroundImage, null);
  assert.equal(removed?.design.imagery.heroImage, null);
  assert.deepEqual(removed?.design.imagery.decorativeImages, []);

  const switched = applyPresentationStylePreset(value.config, "CORPORATE");
  assert.equal(switched.tokens.assets.logo, firstBlob);
  assert.equal(switched.tokens.assets.backgroundImage, background);
  assert.equal(switched.design.imagery.heroImage, hero);
  assert.deepEqual(switched.design.imagery.decorativeImages, [decoration]);
});

test("preview and productive design renderer consume the same normalized asset contract", () => {
  const logo = "https://assets.public.blob.vercel-storage.com/dev/template-media/sommer-2026/logo/logo.png" as const;
  const background = "https://assets.public.blob.vercel-storage.com/dev/template-media/sommer-2026/background/background.jpg" as const;
  const hero = "/medien/bilder/hero.webp" as const;
  const decoration = "https://assets.public.blob.vercel-storage.com/dev/template-media/sommer-2026/decoration/deco.png" as const;
  const config = structuredClone(defaultPresentationTemplateConfig);
  config.tokens.assets.logo = logo;
  config.tokens.assets.backgroundImage = background;
  config.design.imagery.heroImage = hero;
  config.design.imagery.decorativeImages = [decoration];
  const managed = { id: "asset-contract", name: "Asset contract", config };
  const presentation = {
    template: toRuntimePresentationTemplate(managed),
    source: "QUIZ" as const,
    requestedId: managed.id,
    usedFallback: false,
  };
  const theme = resolveQuizTheme({
    displayName: "Asset quiz",
    presentation,
    answerForm: {
      template: toRuntimeAnswerFormTemplate(managed),
      source: "QUIZ",
      requestedId: managed.id,
      usedFallback: false,
    },
  });

  assert.deepEqual(resolvePresentationTemplateRuntimeAssets(presentation.template), {
    logo,
    backgroundImage: background,
    heroImage: hero,
    solutionImage: null,
    personalImagePool: [],
    decorativeImages: [decoration],
  });
  assert.equal(theme.identity.logoUrl, theme.assets.logo);
  assert.match(String(quizThemeStyle(theme).backgroundImage), new RegExp(background.replaceAll("/", "\\/")));

  const productiveHtml = [
    renderToStaticMarkup(createElement(PresentationDesignHeader, {
      theme,
      slideLabel: "Frage",
      slideNumber: 1,
      slideCount: 10,
    })),
    renderToStaticMarkup(createElement(PresentationDesignBackdrop, {
      theme,
      images: [],
    })),
  ].join("");
  for (const reference of [logo, hero, decoration]) {
    assert.ok(productiveHtml.includes(reference));
  }
  assert.match(productiveHtml, /data-template-asset-role="LOGO"/);
  assert.match(productiveHtml, /data-template-asset-role="HERO_IMAGE"/);
  assert.match(productiveHtml, /data-template-asset-role="DECORATION"/);

  const previewHtml = renderToStaticMarkup(createElement(PresentationTemplatePreview, {
    config,
    templateId: managed.id,
    templateName: managed.name,
    scenario: "TEXT",
  }));
  for (const reference of [logo, background, hero, decoration]) {
    assert.ok(previewHtml.includes(reference));
  }
});

test("storybook cover prefers the uploaded hero over legacy composition images", () => {
  const config = createPresentationStylePreset("BIRTHDAY");
  const uploadedHero = "https://assets.public.blob.vercel-storage.com/dev/template-media/story/hero/uploaded.webp" as const;
  config.design.imagery.heroImage = uploadedHero;
  const managed = { id: "storybook-asset-contract", name: "Storybook assets", config };
  const theme = resolveQuizTheme({
    displayName: managed.name,
    presentation: {
      template: toRuntimePresentationTemplate(managed),
      source: "QUIZ",
      requestedId: managed.id,
      usedFallback: false,
    },
    answerForm: {
      template: toRuntimeAnswerFormTemplate(managed),
      source: "QUIZ",
      requestedId: managed.id,
      usedFallback: false,
    },
  });
  const storybook = theme.design.storybook;
  assert.ok(storybook);
  const composition = resolveStorybookComposition({
    storybook,
    quizId: 1,
    questionId: 1,
    phase: "QUESTION",
    sequenceIndex: 0,
    slideType: "frage",
    contentKind: "COVER",
  });
  const html = renderToStaticMarkup(createElement(PresentationDesignBackdrop, {
    theme,
    images: [],
    storybookComposition: composition,
  }));
  assert.ok(html.includes(uploadedHero));
  assert.match(html, /data-template-asset-role="HERO_IMAGE"/);
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
  for (const scenario of ["TEXT", "IMAGE", "MULTIPLE_CHOICE", "AUDIO", "ORDERING", "SOLUTION", "MODERATION", "ANSWER_FORM", "STORYBOOK_COVER", "STORYBOOK_CHAPTER", "STORYBOOK_EDITORIAL", "STORYBOOK_PORTRAIT", "STORYBOOK_SPLIT", "STORYBOOK_SEQUENCE", "STORYBOOK_MEMORY"]) {
    assert.ok(presentationPreviewScenarios.some(([id]) => id === scenario));
  }
  const source = readFileSync("app/rendering/presentationTemplates/PresentationTemplatePreview.tsx", "utf8");
  assert.match(source, /PresentationSlideRenderer/);
  assert.match(source, /resolvePresentationLayout/);
  assert.doesNotMatch(source, /function resolve.*Layout/);
  assert.doesNotMatch(source, /src=.["']\/medien\/vorschau\.mp3/);
  assert.match(source, /data-preview-scale-container/);
  assert.match(source, /data-preview-fixed-stage/);
  assert.match(source, /transformOrigin: "top left"/);
});

test("semantic renderer variants keep corporate treatment and expose the editorial storybook system", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const designSystem = readFileSync("app/rendering/presentation/PresentationDesignSystem.tsx", "utf8");
  assert.match(css, /data-design-style="CORPORATE"/);
  assert.match(css, /CORPORATE[\s\S]+box-shadow: none !important/);
  assert.match(css, /CORPORATE[\s\S]+drop-shadow/);
  assert.match(css, /CORPORATE[\s\S]+text-pink/);
  assert.match(css, /data-design-style="BIRTHDAY"/);
  assert.match(css, /presentation-personal-image/);
  assert.match(designSystem, /presentation-corporate-header/);
  assert.match(designSystem, /presentation-birthday-header/);
  assert.match(designSystem, /presentation-neon-header/);
  assert.match(designSystem, /Knowledge · People · Progress/);
  assert.match(designSystem, /storybookPageKind/);
  assert.match(designSystem, /data-storybook-people-mode/);
  for (const variant of ["COVER", "CHAPTER", "EDITORIAL", "PORTRAIT", "SPLIT", "SEQUENCE", "MEMORY"]) {
    assert.match(readFileSync("app/rendering/presentationTemplates/storybookComposition.ts", "utf8"), new RegExp(`"${variant}"`));
  }
  assert.match(css, /data-storybook-variant="SEQUENCE"/);
  assert.doesNotMatch(designSystem, /presentation-album-tape|presentation-album-ring|StorybookPeopleMarks/);
});

test("template upload is integrated into the shared signed route but requires explicit store confirmation", () => {
  const route = readFileSync("app/api/question-media-upload/route.ts", "utf8");
  const uploadContext = readFileSync("app/rendering/presentationTemplates/presentationTemplateUpload.server.ts", "utf8");
  const editor = readFileSync("app/rendering/presentationTemplates/PresentationTemplateAssetEditor.tsx", "utf8");
  assert.match(route, /target: "TEMPLATE"/);
  assert.match(route, /presentationTemplateAssetUploadRule/);
  assert.match(route, /template\.status !== "DRAFT"/);
  assert.match(uploadContext, /TEMPLATE_MEDIA_UPLOAD_ENABLED === "true"/);
  assert.match(editor, /handleUploadUrl: "\/api\/question-media-upload"/);
  assert.doesNotMatch(editor, /\/api\/template.*upload/);
});

test("AP2 generator exposes only four visual steps with direct style selection", () => {
  const generator = readFileSync("app/rendering/presentationTemplates/PresentationTemplateGenerator.tsx", "utf8");
  assert.match(generator, /\["style", "Stil"\][\s\S]+\["imagery", "Bilder"\][\s\S]+\["branding", "Branding"\][\s\S]+\["activation", "Aktivieren"\]/);
  assert.doesNotMatch(generator, /EditorSection id="layout"/);
  assert.doesNotMatch(generator, /EditorSection id="personalization"/);
  assert.doesNotMatch(generator, /EditorSection id="surfaces"/);
  assert.doesNotMatch(generator, /EditorSection id="preview"/);
  assert.doesNotMatch(generator, /Als Grundlage verwenden/);
  assert.match(generator, /data-style-card/);
  assert.match(generator, /aria-pressed={selected}/);
  assert.match(generator, /← Zurück/);
  assert.match(generator, /Weiter →/);
});

test("AP2 assets use upload thumbnails, removal and preview placement feedback without path fields", () => {
  const editor = readFileSync("app/rendering/presentationTemplates/PresentationTemplateAssetEditor.tsx", "utf8");
  const preview = readFileSync("app/rendering/presentationTemplates/PresentationTemplatePreview.tsx", "utf8");
  assert.match(editor, /Bild hochladen/);
  assert.match(editor, /Bild ersetzen/);
  assert.match(editor, /Entfernen/);
  assert.match(editor, /onFocusRole/);
  assert.doesNotMatch(editor, /Bildpfad|Repository-Pfad|font-mono/);
  assert.match(preview, /data-preview-asset-highlight/);
  assert.match(preview, /Logo erscheint hier/);
  assert.match(preview, /Key Visual erscheint hier/);
});

test("AP2 activation hides stable ids, uses category-like tags and explicit actions", () => {
  const generator = readFileSync("app/rendering/presentationTemplates/PresentationTemplateGenerator.tsx", "utf8");
  const actions = readFileSync("app/rendering/presentationTemplates/actions.ts", "utf8");
  const tags = readFileSync("app/rendering/presentationTemplates/PresentationTemplateTagSelector.tsx", "utf8");
  const multiSelect = readFileSync("components/ui/CreatableMultiSelect.tsx", "utf8");
  assert.doesNotMatch(generator, /Stabile ID/);
  assert.doesNotMatch(generator, /<select value={draft\.status}/);
  assert.match(generator, /Als Entwurf speichern/);
  assert.match(generator, /save\("ACTIVE"\)/);
  assert.match(actions, /generateUniquePresentationTemplateId/);
  assert.match(actions, /presentation_template_id: id/);
  assert.match(tags, /CreatableMultiSelect/);
  assert.match(tags, /Alle Tags entfernen/);
  assert.match(multiSelect, /aria-multiselectable="true"/);
  assert.match(multiSelect, /aria-selected={selected}/);
  assert.match(multiSelect, /duplicateMessage/);
});

test("AP2 tags trim and collapse case-insensitive duplicates while preserving the first spelling", () => {
  assert.deepEqual(
    normalizeTemplateTags([" Versuch1 ", "versuch1", "VERSUCH1", "Quiz Abend"]),
    ["Versuch1", "Quiz Abend"],
  );
  const validated = validatePresentationTemplateDraft({
    ...draft(),
    tags: ["Versuch1", " versuch1 ", "VERSUCH1"],
  });
  assert.equal(validated.ok, true);
  if (validated.ok) assert.deepEqual(validated.value.tags, ["Versuch1"]);
});

test("template uploads require an exact environment-classified Blob store binding", () => {
  const token = "vercel_blob_rw_store123_secret";
  assert.equal(readBlobStoreIdFromToken(token), "store123");
  assert.deepEqual(resolvePresentationTemplateUploadPolicy({
    environment: "preview",
    explicitlyEnabled: true,
    readWriteToken: token,
    configuredStoreId: "store123",
    configuredStoreEnvironment: "nonproduction",
  }), { enabled: true, storeId: "store123" });
  assert.equal(resolvePresentationTemplateUploadPolicy({
    environment: "preview",
    explicitlyEnabled: true,
    readWriteToken: token,
    configuredStoreId: "production-store",
    configuredStoreEnvironment: "nonproduction",
  }).enabled, false);
  assert.equal(resolvePresentationTemplateUploadPolicy({
    environment: "preview",
    explicitlyEnabled: true,
    readWriteToken: token,
    configuredStoreId: "store123",
    configuredStoreEnvironment: "production",
  }).enabled, false);
  assert.equal(resolvePresentationTemplateUploadPolicy({
    environment: "production",
    explicitlyEnabled: true,
    readWriteToken: token,
    configuredStoreId: "store123",
    configuredStoreEnvironment: "nonproduction",
  }).enabled, false);
});

test("AP2 branding has two reset semantics and curated self-hosted font choices", () => {
  const generator = readFileSync("app/rendering/presentationTemplates/PresentationTemplateGenerator.tsx", "utf8");
  const layout = readFileSync("app/layout.tsx", "utf8");
  assert.match(generator, /Änderungen zurücksetzen/);
  assert.match(generator, /Auf Stil-Standard zurücksetzen/);
  assert.match(generator, /window\.confirm\("Branding wirklich/);
  assert.ok(presentationTemplateOptions.fonts.length >= 8 && presentationTemplateOptions.fonts.length <= 12);
  assert.match(layout, /Source_Sans_3/);
  assert.match(layout, /Playfair_Display/);
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
