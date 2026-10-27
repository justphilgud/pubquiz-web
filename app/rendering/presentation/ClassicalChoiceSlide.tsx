"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { fitChoiceContent } from "./fitChoiceContent";

type Choice = { antwort_id: number; antwort: string; zusatzinformation?: string | null; ist_richtig: boolean };

/** Classical choices only. Media/playback and answer ordering belong to the caller. */
export function ClassicalChoiceSlide({ question, answers, solution, media, source, label }: {
  question: string; answers: Choice[]; solution: boolean; media?: ReactNode; source?: string | null; label: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const contentKey = JSON.stringify([question, answers, solution, source]);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    let active = true;
    let pending = 0;
    const fit = () => { pending = 0; if (active) fitChoiceContent(root); };
    const schedule = () => { if (!pending) pending = requestAnimationFrame(fit); };
    fit();
    const observer = new ResizeObserver(schedule);
    // Only the externally sized box: text writes cannot resize the observed box.
    observer.observe(root);
    root.addEventListener("load", schedule, true);
    document.fonts.addEventListener("loadingdone", schedule);
    document.addEventListener("fullscreenchange", schedule);
    window.addEventListener("resize", schedule);
    void document.fonts.ready.then(() => { if (active) schedule(); });
    return () => {
      active = false; observer.disconnect(); cancelAnimationFrame(pending);
      root.removeEventListener("load", schedule, true);
      document.fonts.removeEventListener("loadingdone", schedule);
      document.removeEventListener("fullscreenchange", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [contentKey]);
  return <section ref={ref} data-choice-fit="pending" data-choice-media={media ? "true" : undefined} data-presentation-layout="CLASSICAL_CHOICE" className="presentation-classical-choice">
    <div className="presentation-choice-lead">
      <div className="presentation-choice-label">{label}</div>
      <h2 className="presentation-choice-question">{question}</h2>
      {source && <p className="presentation-choice-source">Quelle: {source}</p>}
      {media && <div className="presentation-choice-media">{media}</div>}
    </div>
    <div className="presentation-choice-options">
      {answers.map((answer, index) => <div key={answer.antwort_id} data-correct={solution ? String(answer.ist_richtig) : undefined}
        className={`${solution ? "presentation-solution-option" : "presentation-answer-option"} presentation-classical-option`}>
        <p className="presentation-choice-answer"><span className="presentation-choice-letter">{String.fromCharCode(65 + index)}.</span><span>{answer.antwort}</span></p>
        {solution && answer.zusatzinformation?.trim() && <p className="presentation-answer-information">{answer.zusatzinformation}</p>}
      </div>)}
    </div>
  </section>;
}

