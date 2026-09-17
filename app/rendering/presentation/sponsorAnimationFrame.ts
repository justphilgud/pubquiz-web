type Rectangle = { left: number; top: number; width: number; height: number };

/** Convert viewport measurements back into the (possibly scaled) canvas space. */
export function sponsorAnimationFrame(
  rect: Rectangle,
  origin: Rectangle,
  canvas: { width: number; height: number },
  padding: string,
) {
  const scaleX = origin.width > 0 && canvas.width > 0 ? origin.width / canvas.width : 1;
  const scaleY = origin.height > 0 && canvas.height > 0 ? origin.height / canvas.height : 1;
  return {
    left: `${(rect.left - origin.left) / scaleX}px`,
    top: `${(rect.top - origin.top) / scaleY}px`,
    width: `${rect.width / scaleX}px`,
    height: `${rect.height / scaleY}px`,
    padding,
  };
}
