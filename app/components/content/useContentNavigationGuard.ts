"use client";
import { useEffect, useRef } from "react";

const handledEvents = new WeakSet<Event>();

/** Same confirmation contract as the question editor, for editorial context links. */
export function useContentNavigationGuard(dirty: boolean) {
  const saved = useRef(false);
  useEffect(() => {
    if (!dirty) return;
    saved.current = false;
    function confirmLink(event: MouseEvent) {
      if (event.defaultPrevented || handledEvents.has(event)) return;
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download") || anchor.href === window.location.href || saved.current) return;
      handledEvents.add(event);
      if (!window.confirm("Ungespeicherte Änderungen verwerfen?")) { event.preventDefault(); event.stopPropagation(); }
    }
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!saved.current) event.preventDefault();
    }
    function popstate(event: PopStateEvent) {
      if (handledEvents.has(event)) return;
      handledEvents.add(event);
      if (!saved.current && !window.confirm("Ungespeicherte Änderungen verwerfen?")) window.history.forward();
    }
    document.addEventListener("click", confirmLink, true);
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", popstate);
    return () => {
      document.removeEventListener("click", confirmLink, true);
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", popstate);
    };
  }, [dirty]);
  return () => { saved.current = true; };
}
