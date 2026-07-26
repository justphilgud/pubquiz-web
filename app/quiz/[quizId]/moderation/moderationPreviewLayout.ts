export const MODERATION_PREVIEW_LOGICAL_WIDTH = 1600;
export const MODERATION_PREVIEW_LOGICAL_HEIGHT = 900;
export const MODERATION_PREVIEW_MAX_VIEWPORT_HEIGHT_RATIO = 0.48;

export type ModerationPreviewLayout = {
  width: number;
  height: number;
  scale: number;
};

export function resolveModerationPreviewLayout(
  availableWidth: number,
  viewportHeight: number,
): ModerationPreviewLayout {
  const safeAvailableWidth = Math.max(0, availableWidth);
  const safeViewportHeight = Math.max(0, viewportHeight);
  const maxHeight =
    safeViewportHeight * MODERATION_PREVIEW_MAX_VIEWPORT_HEIGHT_RATIO;
  const aspectRatio =
    MODERATION_PREVIEW_LOGICAL_WIDTH / MODERATION_PREVIEW_LOGICAL_HEIGHT;
  const width = Math.min(safeAvailableWidth, maxHeight * aspectRatio);
  const height = width / aspectRatio;

  return {
    width,
    height,
    scale: width / MODERATION_PREVIEW_LOGICAL_WIDTH,
  };
}
