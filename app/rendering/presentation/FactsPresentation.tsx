"use client";

import { useEffect, useRef } from "react";

type Props = { question: string; facts: readonly { id: string; text: string }[]; options: readonly { id: number; text: string }[] };

export function FactsPresentation({ question, facts, options }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const dense = facts.reduce((length, fact) => length + fact.text.length, 0) > 900;
  const twoColumns = facts.length > 4 || dense;
  useEffect(() => {
    const frame = container.current;
    const content = list.current;
    if (!frame || !content) return;
    const fit = () => {
      const scale = Math.min(1, frame.clientWidth / 1500);
      const minimum = 18 * scale;
      let size = 44 * scale;
      content.style.fontSize = `${size}px`;
      const overflows = () => content.scrollHeight > content.clientHeight + 1 ||
        Array.from(content.children).some((item) => item.scrollHeight > item.clientHeight + 1);
      while (size > minimum && overflows()) {
        size = Math.max(minimum, size - scale);
        content.style.fontSize = `${size}px`;
      }
    };
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    fit();
    let active = true;
    void document.fonts.ready.then(() => { if (active) fit(); });
    return () => { active = false; observer.disconnect(); };
  }, [facts, options, twoColumns, dense]);
  return <div ref={container} data-facts-presentation className="presentation-question-card flex h-full min-h-0 flex-col rounded-[1.5rem] border-4 border-pink-500 bg-slate-950/80 p-8">
    <h2 className="shrink-0 break-words text-4xl font-bold leading-tight text-white">{question}</h2>
    <ol ref={list} className={`mt-4 grid min-h-0 flex-1 gap-x-6 overflow-auto text-white ${dense ? "gap-y-1" : "gap-y-3"} ${twoColumns ? "grid-cols-2" : "grid-cols-1"}`} style={{ fontSize: 36, lineHeight: dense ? 1.15 : 1.25 }}>
      {facts.map((fact, index) => <li key={fact.id} className={`flex min-h-0 items-start gap-3 border-t border-white/20 ${dense ? "pt-1" : "pt-3"} ${dense && twoColumns && facts.length % 2 === 1 && index === facts.length - 1 ? "col-span-2" : ""}`}>
        <span aria-hidden="true" className="shrink-0 font-semibold text-yellow-200">{index + 1}.</span>
        <span className="min-w-0 whitespace-pre-line break-words [overflow-wrap:anywhere]">{fact.text}</span>
      </li>)}
    </ol>
    {options.length > 0 && <div className="mt-4 grid shrink-0 grid-cols-2 gap-2 text-xl font-semibold text-white">
      {options.map((option, index) => <p key={option.id} className="break-words">{String.fromCharCode(65 + index)}. {option.text}</p>)}
    </div>}
  </div>;
}
