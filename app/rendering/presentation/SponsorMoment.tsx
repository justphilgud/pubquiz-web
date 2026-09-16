"use client";
/* eslint-disable @next/next/no-img-element -- Same managed logo in both bounding boxes. */
import { useLayoutEffect, useRef } from "react";
import type { QuestionSponsor } from "./questionSponsor";

type Moment = { phase: "SPONSOR" | "QUESTION"; assignmentId: number; sponsor: QuestionSponsor };

/** Visual only: no timer, callback or animation event ever navigates or opens a question. */
export function SponsorMoment({ moment }: { moment: Moment | null }) {
  const layer = useRef<HTMLDivElement>(null);
  const logo = useRef<HTMLImageElement>(null);
  const previous = useRef<{ assignmentId: number; logo: string; rect: DOMRect } | null>(null);
  useLayoutEffect(() => {
    const container = layer.current;
    if (!container) return;
    if (moment?.phase === "SPONSOR" && logo.current) {
      const source = logo.current;
      const remember = () => { previous.current = { assignmentId: moment.assignmentId, logo: moment.sponsor.logo, rect: source.getBoundingClientRect() }; };
      remember();
      const observer = new ResizeObserver(remember);
      observer.observe(source);
      return () => observer.disconnect();
    }
    const from = previous.current;
    previous.current = null;
    if (moment?.phase !== "QUESTION" || from?.assignmentId !== moment.assignmentId || from.logo !== moment.sponsor.logo || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const target = container.parentElement?.querySelector<HTMLImageElement>(".presentation-question-sponsor img");
    if (!target) return;
    const end = target.getBoundingClientRect();
    const origin = container.getBoundingClientRect();
    const ghost = document.createElement("img");
    ghost.src = moment.sponsor.logo;
    ghost.alt = "";
    ghost.style.cssText = "position:absolute;object-fit:contain;box-sizing:border-box;pointer-events:none;";
    container.appendChild(ghost);
    const visibility = target.style.visibility;
    target.style.visibility = "hidden";
    const frame = (rect: DOMRect, padding: string) => ({ left: `${rect.left-origin.left}px`, top: `${rect.top-origin.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, padding });
    const animation = ghost.animate([frame(from.rect, "24px"), frame(end, getComputedStyle(target).padding)], { duration: 700, easing: "cubic-bezier(.22,.61,.36,1)", fill: "both" });
    const restore = () => { target.style.visibility = visibility; ghost.remove(); };
    animation.onfinish = restore;
    return () => { animation.cancel(); restore(); };
  }, [moment?.phase, moment?.assignmentId, moment?.sponsor.logo]);

  return <div ref={layer} className="presentation-sponsor-layer" aria-hidden={moment?.phase !== "SPONSOR"}>
    {moment?.phase === "SPONSOR" && <section key={moment.assignmentId} className="presentation-sponsor-moment" aria-label="Sponsor-Moment">
      {moment.sponsor.line && <p>{moment.sponsor.line}</p>}
      <img ref={logo} src={moment.sponsor.logo} alt="Sponsorlogo" />
    </section>}
  </div>;
}
