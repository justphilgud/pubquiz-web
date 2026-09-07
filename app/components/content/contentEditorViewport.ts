/** Visible viewport geometry only; no keyboard heuristics or network work. */
export function editorViewportInsets(layoutHeight: number, visibleHeight: number, offsetTop: number) {
  return { height: Math.max(0, visibleHeight), bottom: Math.max(0, layoutHeight - visibleHeight - offsetTop) };
}

export function observeEditorViewport(bar: HTMLElement) {
  const viewport = window.visualViewport;
  function update() {
    const insets = editorViewportInsets(window.innerHeight, viewport?.height ?? window.innerHeight, viewport?.offsetTop ?? 0);
    bar.style.setProperty("--editor-visible-height", `${insets.height}px`);
    bar.style.setProperty("--editor-viewport-bottom", `${insets.bottom}px`);
  }
  update();
  viewport?.addEventListener("resize", update);
  viewport?.addEventListener("scroll", update);
  window.addEventListener("resize", update);
  return () => {
    viewport?.removeEventListener("resize", update);
    viewport?.removeEventListener("scroll", update);
    window.removeEventListener("resize", update);
  };
}
