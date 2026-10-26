"use client";
import Link from "next/link";
import { useCallback, useId, useState } from "react";
import { useDismissiblePopover } from "@/app/components/useDismissiblePopover";
export default function NavigationDropdown({ label, links, active, onNavigate }: { label: string; links: readonly { href: string; label: string; active?: boolean }[]; active: boolean; onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { containerRef, triggerRef } = useDismissiblePopover({ open, onClose: close });
  const id = useId();
  return <div ref={containerRef} className="relative min-w-0" onKeyDown={event => { if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); close(); triggerRef.current?.focus(); } }}>
    <button ref={triggerRef} type="button" aria-expanded={open} aria-controls={id} aria-current={active ? "true" : undefined} onClick={() => setOpen(value => !value)} className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${active ? "bg-emerald-50 text-emerald-900" : "hover:bg-slate-100"}`}>{label}<span aria-hidden>▾</span></button>
    {open && <nav id={id} aria-label={label} className="relative z-50 grid max-h-[50dvh] w-64 max-w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg md:absolute md:left-0 md:max-w-[calc(100vw-2rem)]">{links.map(link => <Link key={link.href} href={link.href} aria-current={link.active ? "page" : undefined} onClick={() => { close(); onNavigate?.(); }} className={`flex min-h-11 items-center rounded-md px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${link.active ? "bg-emerald-50 text-emerald-900" : "hover:bg-slate-100"}`}>{link.label}</Link>)}</nav>}
  </div>;
}
