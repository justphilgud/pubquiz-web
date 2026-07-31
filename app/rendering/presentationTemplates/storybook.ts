import type {
  PresentationTemplateDesign,
  StorybookConfiguration,
  StorybookMemoryAsset,
  StorybookPerson,
  TemplateAssetReference,
} from "@/app/rendering/templateRegistry";
import { isSafeTemplateAssetReference } from "./presentationTemplateAssets";

export type StorybookPeopleMode = "SINGLE" | "DUAL" | "TRIO" | "GROUP" | "TITLE_ONLY";

export type StorybookValidationIssue = { field: string; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function legacyPersonId(name: string) {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 36);
  return slug || "person-1";
}

function normalizePerson(value: unknown, index: number): StorybookPerson {
  const record = isRecord(value) ? value : {};
  const name = text(record.name).trim();
  return {
    ...record,
    id: text(record.id, legacyPersonId(name || `person-${index + 1}`)),
    name,
    age: nullableText(record.age),
    subtitle: nullableText(record.subtitle),
    portrait: ("portrait" in record ? record.portrait : null) as StorybookPerson["portrait"],
  } as StorybookPerson;
}

function normalizeMemoryAsset(value: unknown, index: number): StorybookMemoryAsset {
  const record = isRecord(value) ? value : {};
  return {
    ...record,
    id: text(record.id, `memory-${index + 1}`),
    source: ("source" in record ? record.source : "/medien/template-preview.svg") as TemplateAssetReference,
    role: record.role ?? "MEMORY",
    personIds: (Array.isArray(record.personIds) ? record.personIds : []) as string[],
    alt: text(record.alt),
    caption: nullableText(record.caption),
    year: nullableText(record.year),
    order: typeof record.order === "number" ? record.order : index,
  } as StorybookMemoryAsset;
}

export function normalizeStorybookConfiguration(
  value: unknown,
  legacy: PresentationTemplateDesign["occasion"],
  imagery: PresentationTemplateDesign["imagery"],
): StorybookConfiguration {
  const record = isRecord(value) ? value : {};
  const people = Array.isArray(record.people)
    ? record.people.map(normalizePerson)
    : legacy.personName.trim()
      ? [{
          id: legacyPersonId(legacy.personName),
          name: legacy.personName.trim(),
          age: legacy.age.trim() || null,
          subtitle: null,
          portrait: imagery.heroImage,
        }]
      : [];
  const fallbackPersonIds = people.length === 1 ? [people[0].id] : [];
  const assets = Array.isArray(record.assets)
    ? record.assets.map(normalizeMemoryAsset)
    : imagery.personalImagePool.map((source, index) => ({
        id: `legacy-memory-${index + 1}`,
        source,
        role: index === 0 && people.length === 1 ? "PORTRAIT" as const : "MEMORY" as const,
        personIds: fallbackPersonIds,
        alt: "Persönliche Erinnerung",
        caption: null,
        year: null,
        order: index,
      }));
  return {
    ...record,
    occasion: "BIRTHDAY",
    sharedTitle: text(record.sharedTitle, legacy.eventTitle || legacy.personName),
    motto: text(record.motto, legacy.subtitle),
    subtitle: text(record.subtitle, legacy.extraText),
    people,
    assets,
    anecdotes: Array.isArray(record.anecdotes)
      ? record.anecdotes.map((entry, index) => {
          const item = isRecord(entry) ? entry : {};
          return {
            ...item,
            id: text(item.id, `anecdote-${index + 1}`),
            text: text(item.text),
            personIds: (Array.isArray(item.personIds) ? item.personIds : []) as string[],
            year: nullableText(item.year),
          };
        })
      : [],
    chapters: Array.isArray(record.chapters)
      ? record.chapters.map((entry, index) => {
          const item = isRecord(entry) ? entry : {};
          return {
            ...item,
            id: text(item.id, `chapter-${index + 1}`),
            title: text(item.title),
            subtitle: nullableText(item.subtitle),
            personIds: (Array.isArray(item.personIds) ? item.personIds : []) as string[],
            order: typeof item.order === "number" ? item.order : index,
          };
        })
      : [],
    material: record.material ?? "CREAM_PAPER",
  } as StorybookConfiguration;
}

function rejectUnknown(record: Record<string, unknown>, allowed: readonly string[], field: string, issues: StorybookValidationIssue[]) {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) issues.push({ field: `${field}.${key}`, message: "Unbekanntes Storybook-Feld ist nicht erlaubt." });
  }
}

export function validateStorybookConfiguration(value: unknown): StorybookValidationIssue[] {
  const issues: StorybookValidationIssue[] = [];
  if (!isRecord(value)) return [{ field: "config.design.storybook", message: "Storybook-Konfiguration fehlt." }];
  rejectUnknown(value, ["occasion", "sharedTitle", "motto", "subtitle", "people", "assets", "anecdotes", "chapters", "material"], "config.design.storybook", issues);
  if (value.occasion !== "BIRTHDAY") issues.push({ field: "config.design.storybook.occasion", message: "Unbekannter Erinnerungsanlass." });
  for (const key of ["sharedTitle", "motto", "subtitle"] as const) {
    if (typeof value[key] !== "string" || value[key].length > 160) issues.push({ field: `config.design.storybook.${key}`, message: "Text ist zu lang oder ungültig." });
  }
  if (!Array.isArray(value.people) || value.people.length > 20) {
    issues.push({ field: "config.design.storybook.people", message: "Es sind höchstens 20 Personen möglich." });
    return issues;
  }
  if (value.people.length === 0 && !text(value.sharedTitle).trim()) issues.push({ field: "config.design.storybook.people", message: "Mindestens eine Person oder ein gemeinsamer Titel ist erforderlich." });
  const personIds = new Set<string>();
  value.people.forEach((person, index) => {
    if (!isRecord(person)) return issues.push({ field: `config.design.storybook.people.${index}`, message: "Person ist ungültig." });
    rejectUnknown(person, ["id", "name", "age", "subtitle", "portrait"], `config.design.storybook.people.${index}`, issues);
    const id = text(person.id);
    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(id) || personIds.has(id)) issues.push({ field: `config.design.storybook.people.${index}.id`, message: "Personen-ID muss eindeutig und stabil sein." });
    personIds.add(id);
    if (!text(person.name).trim() || text(person.name).length > 100) issues.push({ field: `config.design.storybook.people.${index}.name`, message: "Ein gültiger Name ist erforderlich." });
    if (person.age !== null && (typeof person.age !== "string" || person.age.length > 20)) issues.push({ field: `config.design.storybook.people.${index}.age`, message: "Alter ist ungültig." });
    if (person.subtitle !== null && (typeof person.subtitle !== "string" || person.subtitle.length > 120)) issues.push({ field: `config.design.storybook.people.${index}.subtitle`, message: "Untertitel ist ungültig." });
    if (person.portrait !== null && !isSafeTemplateAssetReference(person.portrait)) issues.push({ field: `config.design.storybook.people.${index}.portrait`, message: "Porträtpfad ist nicht erlaubt." });
  });
  const validateAssignments = (ids: unknown, field: string) => {
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || !personIds.has(id))) issues.push({ field, message: "Personenzuordnung verweist auf eine unbekannte Person." });
  };
  if (!Array.isArray(value.assets) || value.assets.length > 48) issues.push({ field: "config.design.storybook.assets", message: "Es sind höchstens 48 Erinnerungsbilder möglich." });
  else {
    const assetIds = new Set<string>();
    value.assets.forEach((asset, index) => {
    if (!isRecord(asset)) return issues.push({ field: `config.design.storybook.assets.${index}`, message: "Erinnerungsbild ist ungültig." });
    rejectUnknown(asset, ["id", "source", "role", "personIds", "alt", "caption", "year", "order"], `config.design.storybook.assets.${index}`, issues);
    const assetId = text(asset.id);
    if (!/^[a-z0-9][a-z0-9-]{0,49}$/.test(assetId) || assetIds.has(assetId)) issues.push({ field: `config.design.storybook.assets.${index}.id`, message: "Asset-ID muss gültig und eindeutig sein." });
    assetIds.add(assetId);
    if (!isSafeTemplateAssetReference(asset.source)) issues.push({ field: `config.design.storybook.assets.${index}.source`, message: "Assetpfad ist nicht erlaubt." });
    if (!["PORTRAIT", "GROUP", "MEMORY", "SOLUTION"].includes(text(asset.role))) issues.push({ field: `config.design.storybook.assets.${index}.role`, message: "Assetrolle ist ungültig." });
    validateAssignments(asset.personIds, `config.design.storybook.assets.${index}.personIds`);
    if (typeof asset.alt !== "string" || asset.alt.length > 180) issues.push({ field: `config.design.storybook.assets.${index}.alt`, message: "Alternativtext ist ungültig." });
    if (asset.caption !== null && (typeof asset.caption !== "string" || asset.caption.length > 180)) issues.push({ field: `config.design.storybook.assets.${index}.caption`, message: "Bildunterschrift ist ungültig." });
    if (asset.year !== null && (typeof asset.year !== "string" || asset.year.length > 20)) issues.push({ field: `config.design.storybook.assets.${index}.year`, message: "Jahresangabe ist ungültig." });
    if (!Number.isInteger(asset.order) || Number(asset.order) < 0) issues.push({ field: `config.design.storybook.assets.${index}.order`, message: "Bildreihenfolge ist ungültig." });
    });
  }
  for (const collection of ["anecdotes", "chapters"] as const) {
    const entries = value[collection];
    if (!Array.isArray(entries) || entries.length > 24) issues.push({ field: `config.design.storybook.${collection}`, message: "Es sind höchstens 24 Einträge möglich." });
    else entries.forEach((entry, index) => {
      if (!isRecord(entry)) return issues.push({ field: `config.design.storybook.${collection}.${index}`, message: "Eintrag ist ungültig." });
      rejectUnknown(
        entry,
        collection === "anecdotes" ? ["id", "text", "personIds", "year"] : ["id", "title", "subtitle", "personIds", "order"],
        `config.design.storybook.${collection}.${index}`,
        issues,
      );
      validateAssignments(entry.personIds, `config.design.storybook.${collection}.${index}.personIds`);
      const content = collection === "anecdotes" ? entry.text : entry.title;
      if (typeof content !== "string" || !content.trim() || content.length > 500) issues.push({ field: `config.design.storybook.${collection}.${index}`, message: collection === "anecdotes" ? "Anekdote darf nicht leer sein." : "Kapiteltitel darf nicht leer sein." });
    });
  }
  if (!["CREAM_PAPER", "LIGHT_ALBUM", "LINEN", "DARK_ALBUM", "MAGAZINE_WHITE"].includes(text(value.material))) issues.push({ field: "config.design.storybook.material", message: "Materialwelt ist ungültig." });
  return issues;
}

export function getStorybookPeopleMode(people: readonly StorybookPerson[]): StorybookPeopleMode {
  if (people.length === 0) return "TITLE_ONLY";
  if (people.length === 1) return "SINGLE";
  if (people.length === 2) return "DUAL";
  if (people.length === 3) return "TRIO";
  return "GROUP";
}

export function getStorybookTitle(storybook: StorybookConfiguration) {
  if (storybook.sharedTitle.trim()) return storybook.sharedTitle.trim();
  const names = storybook.people.map((person) => person.name);
  if (names.length === 1) return `${names[0]}s Erinnerungsquiz`;
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  if (names.length > 2) return `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;
  return "Unser Erinnerungsquiz";
}

export function storybookAssetsForPeople(storybook: StorybookConfiguration, requestedPersonIds: readonly string[]) {
  const requested = new Set(requestedPersonIds);
  return [...storybook.assets]
    .filter((asset) => requested.size === 0 || asset.personIds.length === 0 || asset.personIds.some((id) => requested.has(id)))
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
}
