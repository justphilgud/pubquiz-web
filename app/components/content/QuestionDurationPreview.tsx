"use client";

import { useEffect, useRef, useState } from "react";
import { formatReadingDuration } from "@/app/fragen/editor/readingDuration";
import type { questionDurationPreview } from "./questionDuration";

function AudioDuration({ url, label }: { url: string; label: string }) {
  const root = useRef<HTMLSpanElement>(null);
  const [seconds, setSeconds] = useState<number | null>(null);
  useEffect(() => {
    const audio = new Audio(); audio.preload = "metadata";
    audio.onloadedmetadata = () => { if (Number.isFinite(audio.duration) && audio.duration > 0) setSeconds(Math.ceil(audio.duration)); };
    const observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { audio.src = url; observer.disconnect(); } });
    if (root.current) observer.observe(root.current);
    return () => { observer.disconnect(); audio.onloadedmetadata = null; audio.removeAttribute("src"); audio.load(); };
  }, [url]);
  return <span ref={root}>{seconds !== null ? `${label}: ${formatReadingDuration(seconds)} (Dateidauer)` : null}</span>;
}

export default function QuestionDurationPreview({ value }: { value: ReturnType<typeof questionDurationPreview> }) {
  if (!value) return null;
  return <div className="mt-2 flex flex-col gap-1 text-xs text-slate-600" aria-label="Vorlese- und Audiodauer">
    {value.questionSeconds !== null && <span>Fragetext · geschätzte Vorlesedauer: ca. {formatReadingDuration(value.questionSeconds)}</span>}
    {value.translationSeconds !== null && <span>Übersetzung · geschätzte Vorlesedauer: ca. {formatReadingDuration(value.translationSeconds)}</span>}
    {value.audioUrls.map(a => <AudioDuration key={a.url} {...a} />)}
  </div>;
}
