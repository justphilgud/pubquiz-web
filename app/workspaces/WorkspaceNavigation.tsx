"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { useDismissiblePopover } from "@/app/components/useDismissiblePopover";
import NavigationDropdown from "./NavigationDropdown";
import { activeNavigationSection, type NavigationCapabilities } from "./workspacePolicy";

export default function WorkspaceNavigation({ capabilities }: { capabilities: NavigationCapabilities }) {
  const pathname = usePathname();
  const active = activeNavigationSection(pathname);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { containerRef, triggerRef } = useDismissiblePopover({ open, onClose: close });
  const quizLinks = [...(capabilities.content ? [{ href: "/content", label: "Inhalte", active: active === "Quiz" && !/^\/(?:quiz|workspaces\/\d+\/quiz\/events)/.test(pathname) }] : []), ...(capabilities.quizzes ? [{ href: "/quiz", label: "Quizze", active: active === "Quiz" && /^\/(?:quiz|workspaces\/\d+\/quiz\/events)/.test(pathname) }] : [])];
  const links = [
    ...(capabilities.bingo ? [{ href: "/bingo", label: "Bingo" }] : []),
    ...(capabilities.karaoke ? [{ href: "/karaoke", label: "PowerPoint-Karaoke" }] : []),
    ...(capabilities.teams ? [{ href: "/admin/teams", label: "Teams" }] : []),
    ...(capabilities.templates ? [{ href: "/templates", label: "Templates" }] : []),
    ...(capabilities.series ? [{ href: "/admin/eventreihen", label: "Eventreihen" }] : []),
  ];
  const hasNavigation = quizLinks.length > 0 || links.length > 0 || capabilities.admin;
  return <div ref={containerRef} className="min-w-0 text-slate-900">
    {hasNavigation && <button ref={triggerRef} type="button" aria-label={open ? "Navigation schließen" : "Navigation öffnen"} aria-expanded={open} aria-controls="main-navigation" onClick={() => setOpen(value => !value)} className="flex min-h-11 w-full items-center justify-between rounded-lg border border-slate-300 px-3 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-emerald-600 md:hidden">{active ?? "Navigation"}<span aria-hidden>☰</span></button>}
    <nav id="main-navigation" aria-label="Hauptnavigation" className={`${open ? "grid" : "hidden"} max-h-[65dvh] gap-1 overflow-y-auto py-1 md:flex md:max-h-none md:flex-wrap md:items-center md:overflow-visible md:py-0`}>
      {quizLinks.length > 0 && <NavigationDropdown label="Quiz" links={quizLinks} active={active === "Quiz"} onNavigate={close} />}
      {links.map(link => <Link key={link.href} href={link.href} onClick={close} aria-current={active === link.label ? "page" : undefined} className={`flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${active === link.label ? "bg-emerald-50 text-emerald-900" : "hover:bg-slate-100"}`}>{link.label}</Link>)}
      {capabilities.admin && <NavigationDropdown label="Administration" active={active === "Administration"} onNavigate={close} links={[
        { href: "/admin/users", label: "Benutzer und Rechte" }, { href: "/admin/kategorien", label: "Kategorien" }, { href: "/admin/fragenvorlagen", label: "Fragenvorlagen" }, { href: "/fragen/import", label: "Import und Export" }, { href: "/admin/question-import", label: "Externe Fragen" }, { href: "/admin/live-text-replacements", label: "Live-Textersetzungen" }, { href: "/admin/monitoring", label: "Monitoring" }, { href: "/admin/styleguide", label: "Styleguide" },
      ]} />}
    </nav>
    {!quizLinks.length && !links.length && !capabilities.admin && <p className="mt-1 text-xs text-slate-600">Keine freigeschalteten Arbeitsbereiche</p>}
  </div>;
}
