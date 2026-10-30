"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/** Fits only the existing ordering solution markup; never derives or changes order. */
export function OrderingSolutionLayout({ children, contentKey }: { children: ReactNode; contentKey: string }) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    let active = true;
    let pending = 0;
    const fit = () => {
      pending = 0;
      if (!active || !root.clientWidth || !root.clientHeight) return;
      // CSS layout pixels, not the transformed size of a moderation preview.
      const max = Math.max(24, Math.min(64, root.clientWidth * .055, root.clientHeight * .16));
      const write = (size: number, layout: string) => {
        root.dataset.orderingLayout = layout;
        root.style.setProperty("--ordering-answer-size", `${size}px`);
        root.style.setProperty("--ordering-question-size", `${Math.min(48, Math.max(26, size * 1.1))}px`);
      };
      const fits = () => {
        if (root.scrollHeight > root.clientHeight || root.scrollWidth > root.clientWidth) return false;
        const bounds = root.getBoundingClientRect();
        return [...root.querySelectorAll<HTMLElement>("h2,.presentation-solution-answer,.presentation-correct-answer-value,.presentation-solution-label")].every(el => {
          const rect = el.getBoundingClientRect();
          if (!(rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1 && rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1)) return false;
          // Font ink can round scrollHeight differently from fractional line boxes.
          // Measure the actual text rectangles; never compress or clip their rows.
          const range = document.createRange();
          range.selectNodeContents(el);
          return [...range.getClientRects()].every(text => text.left >= bounds.left - 1 && text.right <= bounds.right + 1 && text.top >= bounds.top - 1 && text.bottom <= bounds.bottom + 1) &&
            (!el.classList.contains("presentation-solution-answer") || (el.scrollHeight <= el.clientHeight && el.scrollWidth <= el.clientWidth));
        });
      };
      let best = { size: 0, layout: "top" };
      for (const layout of ["top", "side"]) {
        let low = 24, high = max;
        write(low, layout);
        if (!fits()) continue;
        for (let i = 0; i < 9; i++) {
          const mid = (low + high) / 2;
          write(mid, layout);
          if (fits()) low = mid; else high = mid;
        }
        if (low > best.size + .5) best = { size: low, layout };
      }
      write(best.size ? Math.max(24, best.size) : 24, best.layout);
      root.dataset.orderingFit = best.size && fits() ? "fitted" : "overflow";
    };
    const schedule = () => { if (!pending) pending = requestAnimationFrame(fit); };
    fit();
    const observer = new ResizeObserver(schedule);
    observer.observe(root);
    document.fonts.addEventListener("loadingdone", schedule);
    document.addEventListener("fullscreenchange", schedule);
    window.addEventListener("resize", schedule);
    void document.fonts.ready.then(() => { if (active) schedule(); });
    return () => {
      active = false;
      observer.disconnect();
      cancelAnimationFrame(pending);
      document.fonts.removeEventListener("loadingdone", schedule);
      document.removeEventListener("fullscreenchange", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [contentKey]);
  return <section ref={ref} className="presentation-ordering-solution" data-ordering-fit="pending">{children}</section>;
}
