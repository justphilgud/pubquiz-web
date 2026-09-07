"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** One bounded measurement on slide/content changes and actual region resizes.
 * No observer on animated attributes, polling, or per-frame fitting. */
export function PresentationOverflowRegion({ children, contentKey }: { children: ReactNode; contentKey: string }) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const region = viewport.current;
    const inner = content.current;
    if (!region || !inner) return;
    let active = true;
    region.scrollTop = 0;
    const measure = () => setOverflow(region.scrollHeight > region.clientHeight + 2 || region.scrollWidth > region.clientWidth + 2);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(region);
    observer.observe(inner);
    // Media dimensions may become known without changing the fixed slide box.
    inner.addEventListener("load", measure, true);
    void document.fonts.ready.then(() => { if (active) measure(); });
    return () => { active = false; observer.disconnect(); inner.removeEventListener("load", measure, true); };
  }, [contentKey]);
  return <div className="presentation-overflow-region">
    <div ref={viewport} className="presentation-content-viewport" tabIndex={overflow ? 0 : undefined} role="region" aria-label="Präsentationsinhalt">
      <div ref={content} className="presentation-content-inner">{children}</div>
    </div>
    <p className="presentation-overflow-hint" style={{ visibility: overflow ? "visible" : "hidden" }} role="status">Überlänge: Weitere Inhalte durch Scrollen</p>
  </div>;
}
