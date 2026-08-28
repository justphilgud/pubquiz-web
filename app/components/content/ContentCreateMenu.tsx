"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

const items = [
  { href: "/content/questions/new", label: "Frage", description: "Bewertet mit Antwort und Lösung" },
  { href: "/content/story-elements/new", label: "Story-Element", description: "Editorial, ohne Bewertung" },
  { href: "/content/polls/new", label: "Umfrage", description: "Live-Reaktionen, ohne Punkte" },
] as const;

export default function ContentCreateMenu() {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!detailsRef.current?.contains(event.target as Node)) detailsRef.current?.removeAttribute("open");
    }
    window.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => window.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);
  return <details ref={detailsRef} className="relative z-30 w-fit text-sm">
    <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-xl bg-slate-950 px-4 py-2.5 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2">+ Neu <span className="ml-2" aria-hidden>▾</span></summary>
    <div className="absolute left-0 top-[calc(100%+.5rem)] w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
      {items.map((item) => <Link key={item.href} href={item.href} onClick={() => detailsRef.current?.removeAttribute("open")} className="block rounded-xl px-3 py-3 text-slate-950 outline-none hover:bg-slate-100 focus-visible:bg-cyan-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-600"><strong className="block">{item.label}</strong><span className="mt-0.5 block text-xs font-normal text-slate-600">{item.description}</span></Link>)}
    </div>
  </details>;
}
