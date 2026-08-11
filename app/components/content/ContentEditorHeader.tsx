import type { ReactNode } from "react";
import ContentBackButton from "./ContentBackButton";

export default function ContentEditorHeader({ eyebrow = "Content", title, description, actions, fallbackHref = "/content" }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; fallbackHref?: string }) {
  return <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-700">{eyebrow}</p><h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">{title}</h1>{description && <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>}</div><div className="flex shrink-0 flex-wrap items-center gap-2">{actions}<ContentBackButton fallbackHref={fallbackHref} /></div></header>;
}
