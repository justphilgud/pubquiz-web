"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useDismissiblePopover } from "@/app/components/useDismissiblePopover";
const links = [
  ["/admin/users", "Benutzer und Rechte"],
  ["/admin/kategorien", "Kategorien"], ["/admin/fragenvorlagen", "Fragenvorlagen"],
  ["/admin/question-import", "Externe Fragen"], ["/admin/monitoring", "Monitoring"],
] as const;
export default function GlobalAdministrationNavigation({ className }: { className: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { containerRef, triggerRef } = useDismissiblePopover({ open, onClose: close });
  return <div ref={containerRef} className={open ? "relative max-md:w-64" : "relative"}>
    <button ref={triggerRef} type="button" className={className} onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="global-administration">Administration <span className="ml-1" aria-hidden>▾</span></button>
    {open && <nav id="global-administration" aria-label="Administration" className="relative md:absolute md:left-0 z-40 grid max-h-[50dvh] w-64 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border bg-white p-2 shadow-lg">{links.map(([href, label]) => <Link key={href} href={href} className={className} onClick={close}>{label}</Link>)}</nav>}
  </div>;
}
