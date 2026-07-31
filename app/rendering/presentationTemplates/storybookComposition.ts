import type {
  StorybookConfiguration,
  StorybookMemoryAsset,
  StorybookPerson,
} from "@/app/rendering/templateRegistry";
import {
  selectDeterministicTemplateValue,
  type DeterministicTemplateContext,
} from "./deterministicTemplateImage";
import {
  getStorybookPeopleMode,
  storybookAssetsForPeople,
  type StorybookPeopleMode,
} from "./storybook";

export type StorybookCompositionVariant =
  | "TEXT_ALBUM"
  | "SINGLE_PORTRAIT"
  | "DUAL_PORTRAIT"
  | "GROUP_PORTRAIT"
  | "PHOTO_PAIR"
  | "MEMORY_COLLAGE"
  | "SOLUTION_MEMORY"
  | "CHAPTER_INTRO";

export type StorybookComposition = {
  variant: StorybookCompositionVariant;
  peopleMode: StorybookPeopleMode;
  people: StorybookPerson[];
  assets: StorybookMemoryAsset[];
  anecdote: StorybookConfiguration["anecdotes"][number] | null;
  chapter: StorybookConfiguration["chapters"][number] | null;
};

export type ResolveStorybookCompositionInput = DeterministicTemplateContext & {
  storybook: StorybookConfiguration;
  requestedPersonIds?: readonly string[];
  contentKind?: "TEXT" | "IMAGE" | "MULTIPLE_CHOICE" | "ORDERING" | "AUDIO" | "CHAPTER";
};

function relevantPeople(storybook: StorybookConfiguration, requested: readonly string[]) {
  if (requested.length === 0) return storybook.people;
  const ids = new Set(requested);
  return storybook.people.filter((person) => ids.has(person.id));
}

function distinctAssets(assets: readonly StorybookMemoryAsset[], maximum: number) {
  const seen = new Set<string>();
  return assets.filter((asset) => !seen.has(asset.source) && seen.add(asset.source)).slice(0, maximum);
}

function rotateFrom<T>(items: readonly T[], selected: T | null) {
  if (!selected) return [...items];
  const index = items.indexOf(selected);
  return index < 0 ? [...items] : [...items.slice(index), ...items.slice(0, index)];
}

export function resolveStorybookComposition(input: ResolveStorybookCompositionInput): StorybookComposition {
  const requestedPersonIds = [...(input.requestedPersonIds ?? [])];
  const people = relevantPeople(input.storybook, requestedPersonIds);
  const effectivePeople = people.length > 0 ? people : input.storybook.people;
  const peopleMode = getStorybookPeopleMode(effectivePeople);
  const candidates = storybookAssetsForPeople(input.storybook, requestedPersonIds);
  const phaseCandidates = input.phase === "SOLUTION"
    ? [...candidates.filter((asset) => asset.role === "SOLUTION"), ...candidates.filter((asset) => asset.role !== "SOLUTION")]
    : candidates.filter((asset) => asset.role !== "SOLUTION");
  const selected = selectDeterministicTemplateValue(
    phaseCandidates,
    { ...input, personIds: requestedPersonIds, assetRole: input.phase === "SOLUTION" ? "SOLUTION" : "STORYBOOK_MEMORY" },
    (asset) => asset.id,
  );
  const assets = distinctAssets(rotateFrom(phaseCandidates, selected), 3);
  const chapter = input.contentKind === "CHAPTER"
    ? selectDeterministicTemplateValue(input.storybook.chapters, { ...input, assetRole: "CHAPTER" }, (item) => item.id)
    : null;
  const anecdote = selectDeterministicTemplateValue(
    input.storybook.anecdotes.filter((item) => requestedPersonIds.length === 0 || item.personIds.length === 0 || item.personIds.some((id) => requestedPersonIds.includes(id))),
    { ...input, assetRole: "ANECDOTE", personIds: requestedPersonIds },
    (item) => item.id,
  );

  let variant: StorybookCompositionVariant;
  if (chapter) variant = "CHAPTER_INTRO";
  else if (input.phase === "SOLUTION") variant = assets.length > 0 ? "SOLUTION_MEMORY" : "TEXT_ALBUM";
  else if (assets.length === 0 || ["TEXT", "AUDIO", "ORDERING", "MULTIPLE_CHOICE"].includes(input.contentKind ?? "")) variant = "TEXT_ALBUM";
  else if (peopleMode === "SINGLE") variant = "SINGLE_PORTRAIT";
  else if (peopleMode === "DUAL" && assets.length >= 2) variant = "DUAL_PORTRAIT";
  else if ((peopleMode === "TRIO" || peopleMode === "GROUP") && assets.length > 0) variant = "GROUP_PORTRAIT";
  else if (assets.length === 2) variant = "PHOTO_PAIR";
  else if (assets.length >= 3) variant = "MEMORY_COLLAGE";
  else variant = "SINGLE_PORTRAIT";

  return { variant, peopleMode, people: effectivePeople, assets, anecdote, chapter };
}
