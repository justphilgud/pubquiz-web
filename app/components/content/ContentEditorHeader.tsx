import type { ReactNode } from "react";
import ContentBackButton from "./ContentBackButton";

export default function ContentEditorHeader({ eyebrow = "Content", title, description, actions, fallbackHref = "/content" }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; fallbackHref?: string }) {
  return <header className="space-y-4"><ContentBackButton fallbackHref={fallbackHref} /><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-700">{eyebrow}</p><h1 className="mt-1 text-3xl font-black text-slate-950">{title}</h1>{description && <p className="mt-2 max-w-3xl text-slate-600">{description}</p>}</div>{actions}</div></header>;
}
