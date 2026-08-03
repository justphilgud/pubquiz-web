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
  | "COVER"
  | "CHAPTER"
  | "EDITORIAL"
  | "PORTRAIT"
  | "SPLIT"
  | "SEQUENCE"
  | "MEMORY";

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
  contentKind?: "COVER" | "TEXT" | "IMAGE" | "MULTIPLE_CHOICE" | "ORDERING" | "AUDIO" | "CHAPTER";
  preferredVariant?: StorybookCompositionVariant;
  preferredAssetRoles?: readonly StorybookMemoryAsset["role"][];
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

function prioritizeAssetRoles(
  assets: readonly StorybookMemoryAsset[],
  preferredRoles: readonly StorybookMemoryAsset["role"][],
) {
  if (preferredRoles.length === 0) return [...assets];
  const rank = (asset: StorybookMemoryAsset) => {
    const index = preferredRoles.indexOf(asset.role);
    return index === -1 ? preferredRoles.length : index;
  };
  return [...assets].sort((left, right) => rank(left) - rank(right) || left.order - right.order || left.id.localeCompare(right.id));
}

function rotateByIndex<T>(items: readonly T[], sequenceIndex: number) {
  if (items.length < 2) return [...items];
  const start = ((sequenceIndex % items.length) + items.length) % items.length;
  return [...items.slice(start), ...items.slice(0, start)];
}

function fairAssetOrder(
  assets: readonly StorybookMemoryAsset[],
  people: readonly StorybookPerson[],
  input: ResolveStorybookCompositionInput,
) {
  const ordered: StorybookMemoryAsset[] = [];
  const seen = new Set<string>();
  const add = (asset: StorybookMemoryAsset | null) => {
    if (asset && !seen.has(asset.source)) {
      seen.add(asset.source);
      ordered.push(asset);
    }
  };

  for (const person of people) {
    add(selectDeterministicTemplateValue(
      assets.filter((asset) => asset.personIds.includes(person.id)),
      { ...input, assetRole: `${input.phase}_PERSON`, personIds: [person.id] },
      (asset) => asset.id,
    ));
  }

  for (const asset of assets.filter((candidate) => candidate.personIds.length === 0)) add(asset);
  for (const asset of assets) add(asset);
  return ordered;
}

export function resolveStorybookComposition(input: ResolveStorybookCompositionInput): StorybookComposition {
  const requestedPersonIds = [...(input.requestedPersonIds ?? [])];
  const relevant = relevantPeople(input.storybook, requestedPersonIds);
  const basePeople = relevant.length > 0 ? relevant : input.storybook.people;
  const effectivePeople = rotateByIndex(basePeople, input.sequenceIndex ?? 0);
  const peopleMode = getStorybookPeopleMode(effectivePeople);
  const candidates = prioritizeAssetRoles(
    storybookAssetsForPeople(input.storybook, requestedPersonIds),
    input.preferredAssetRoles ?? [],
  );
  const phaseCandidates = input.phase === "SOLUTION"
    ? [...candidates.filter((asset) => asset.role === "SOLUTION"), ...candidates.filter((asset) => asset.role !== "SOLUTION")]
    : candidates.filter((asset) => asset.role !== "SOLUTION");
  const solutionCandidates = phaseCandidates.filter((asset) => asset.role === "SOLUTION");
  const orderedAssets = input.phase === "SOLUTION"
    ? rotateByIndex(
        phaseCandidates,
        phaseCandidates.indexOf(selectDeterministicTemplateValue(
          solutionCandidates.length > 0 ? solutionCandidates : phaseCandidates,
          { ...input, personIds: requestedPersonIds, assetRole: "SOLUTION" },
          (asset) => asset.id,
        ) ?? phaseCandidates[0]),
      )
    : fairAssetOrder(phaseCandidates, effectivePeople, input);
  const chapter = input.contentKind === "CHAPTER"
    ? selectDeterministicTemplateValue(input.storybook.chapters, { ...input, assetRole: "CHAPTER" }, (item) => item.id)
    : null;

  let variant: StorybookCompositionVariant;
  if (input.preferredVariant) variant = input.preferredVariant;
  else if (input.contentKind === "COVER") variant = "COVER";
  else if (chapter) variant = "CHAPTER";
  else if (input.phase === "SOLUTION") variant = "MEMORY";
  else if (orderedAssets.length === 0 || ["TEXT", "AUDIO", "ORDERING", "MULTIPLE_CHOICE"].includes(input.contentKind ?? "")) variant = "EDITORIAL";
  else if (peopleMode === "SINGLE") variant = "PORTRAIT";
  else if (peopleMode === "DUAL" || orderedAssets.length === 2) variant = "SPLIT";
  else if (peopleMode === "TRIO" || peopleMode === "GROUP" || orderedAssets.length >= 3) variant = "SEQUENCE";
  else variant = "PORTRAIT";

  const assetLimit = {
    COVER: 1,
    CHAPTER: 0,
    EDITORIAL: 0,
    PORTRAIT: 1,
    SPLIT: 2,
    SEQUENCE: 3,
    MEMORY: 1,
  }[variant];
  const assets = distinctAssets(orderedAssets, assetLimit);
  const anecdote = variant === "MEMORY"
    ? selectDeterministicTemplateValue(
        input.storybook.anecdotes.filter((item) => requestedPersonIds.length === 0 || item.personIds.length === 0 || item.personIds.some((id) => requestedPersonIds.includes(id))),
        { ...input, assetRole: "ANECDOTE", personIds: requestedPersonIds },
        (item) => item.id,
      )
    : null;

  return { variant, peopleMode, people: effectivePeople, assets, anecdote, chapter };
}
