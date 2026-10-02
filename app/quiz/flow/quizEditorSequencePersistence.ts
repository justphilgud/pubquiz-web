export type QuizEditorSequencePlacement = {
  id: number;
  editorKey: string | null;
};

export function mergeQuizEditorSequenceIntoSlot(
  placements: readonly QuizEditorSequencePlacement[],
  itemKeys: readonly string[],
): number[] | null {
  const editorPlacements = placements.filter(
    (placement) => placement.editorKey !== null,
  );
  const placementByKey = new Map(
    editorPlacements.flatMap((placement) =>
      placement.editorKey === null
        ? []
        : [[placement.editorKey, placement] as const],
    ),
  );
  if (
    new Set(itemKeys).size !== itemKeys.length ||
    placementByKey.size !== editorPlacements.length ||
    itemKeys.length !== placementByKey.size ||
    itemKeys.some((key) => !placementByKey.has(key))
  ) {
    return null;
  }

  const orderedEditorIds = itemKeys.map((key) => placementByKey.get(key)!.id);
  const editorIds = new Set(orderedEditorIds);
  let editorIndex = 0;
  const orderedPlacementIds = placements.map((placement) => {
    if (!editorIds.has(placement.id)) return placement.id;
    return orderedEditorIds[editorIndex++];
  });

  return editorIndex === orderedEditorIds.length
    ? orderedPlacementIds
    : null;
}
