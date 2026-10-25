"use client";

import GlobalAdministrationNavigation from "./GlobalAdministrationNavigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { resolveWorkspaceObjectContext } from "./actions";
import { useDismissiblePopover } from "@/app/components/useDismissiblePopover";
import { EVENT_TYPES, type EventType } from "@/app/roles/eventTypes";
import { searchWorkspaceChoices, workspaceHref, workspaceSwitchHref, workspaceTypePaths, type WorkspaceChoice } from "./workspacePolicy";

export default function WorkspaceNavigation({ choices, canUseContent, admin }: { choices: WorkspaceChoice[]; canUseContent: boolean; admin: boolean }) {
  const pathname = usePathname();
  const [resolved, setResolved] = useState<Awaited<ReturnType<typeof resolveWorkspaceObjectContext>> | null>(null);
  const legacyContext = resolved?.path === pathname ? resolved : null;
  useEffect(() => {
    let active = true;
    if (!pathname.startsWith("/workspaces/")) resolveWorkspaceObjectContext(pathname).then(value => { if (active) setResolved(value); }).catch(() => { if (active) setResolved(null); });
    return () => { active = false; };
  }, [pathname]);
  const match = /^\/workspaces\/(\d+)\/(quiz|bingo|karaoke|settings)(?:\/|$)/.exec(pathname);
  const current = choices.find(choice => choice.id === (match ? Number(match[1]) : legacyContext?.seriesId));
  const currentType = EVENT_TYPES.find(type => workspaceTypePaths[type.id] === match?.[2])?.id ?? (current && !match && !legacyContext?.settings && current.eventTypes.includes("QUIZ") ? "QUIZ" : undefined);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const close = useCallback(() => setOpen(false), []);
  const { containerRef, triggerRef } = useDismissiblePopover({ open, onClose: close });
  const linkClass = "flex min-h-11 min-w-0 items-center rounded-lg px-3 text-sm font-semibold hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600";
  const waitingForObjectContext = !legacyContext && (/^\/quiz\/[1-9]\d*(?:\/|$)/.test(pathname) || /^\/(?:content\/(?:questions|story-elements|polls)|fragen\/editor|story-elemente|admin\/eventreihen)\/[1-9]\d*$/.test(pathname));
  const crossSeries = /^\/(content|fragen|story-elemente|quiz|admin\/teams)(\/|$)/.test(pathname);
  function target(choice: WorkspaceChoice) {
    const area = match?.[2] === "settings" || legacyContext?.settings ? "settings" : pathname.split("/")[4];
    return workspaceSwitchHref(choice, currentType as EventType | undefined, area);
  }
  return <div className="space-y-1 text-slate-900">
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <div ref={containerRef} className="relative min-w-0 max-w-full sm:max-w-80">
        {choices.length > 1 ? <>
          <button ref={triggerRef} type="button" aria-expanded={open} aria-controls="workspace-series-list" onClick={() => setOpen(value => !value)} className={`${linkClass} w-full border border-slate-300 text-left`}>
            <span className="truncate">{current?.name ?? "Eventreihe auswählen"}</span><span className="ml-2 shrink-0" aria-hidden>▾</span>
          </button>
          {open && <div id="workspace-series-list" className="absolute left-0 top-full z-50 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            <label className="block text-xs font-semibold">Eventreihen durchsuchen<input autoFocus value={search} onChange={event => setSearch(event.target.value)} type="search" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" /></label>
            <ul className="mt-1 max-h-[min(18rem,45dvh)] overflow-y-auto" aria-label="Eventreihen">{searchWorkspaceChoices(choices, search).map(choice => <li key={choice.id}><Link href={target(choice)} onClick={close} aria-current={current?.id === choice.id ? "page" : undefined} className={`${linkClass} break-words`}>{choice.name}</Link></li>)}</ul>
            {!searchWorkspaceChoices(choices, search).length && <p className="p-3 text-sm">Keine passende Eventreihe.</p>}
          </div>}
        </> : choices.length === 1 ? <Link className={`${linkClass} break-words`} href={target(choices[0])}>{choices[0].name}</Link> : null}
      </div>
      {current && <nav aria-label="Eventarten" className="flex min-w-0 flex-wrap">{current.eventTypes.map(type => <Link key={type} href={workspaceHref(current, type)} aria-current={currentType === type ? "page" : undefined} className={`${linkClass} ${currentType === type ? "bg-emerald-50 text-emerald-900" : ""}`}>{EVENT_TYPES.find(item => item.id === type)?.label}</Link>)}</nav>}

    </div>
    <div className="flex min-w-0 flex-wrap items-center gap-x-1">
      {current && currentType === "QUIZ" && <nav aria-label="Arbeitsbereiche" className="flex flex-wrap text-sm">
        <Link className={linkClass} href={`/workspaces/${current.id}/quiz/content`}>Inhalte</Link>
        {current.canManageQuiz && <><Link className={linkClass} href={`/workspaces/${current.id}/quiz/events`}>Quizveranstaltungen</Link><Link className={linkClass} href={`/workspaces/${current.id}/quiz/teams`}>Teams</Link></>}
      </nav>}
      {current?.canManage && <Link href={`/workspaces/${current.id}/settings`} className={linkClass} aria-current={match?.[2] === "settings" ? "page" : undefined}>Reiheneinstellungen</Link>}
      {canUseContent && <Link href="/content" className={linkClass} aria-label="Reihenübergreifende Inhalte" title="Reihenübergreifende Quiz-Inhalte">Reihenübergreifend</Link>}
      {admin && <GlobalAdministrationNavigation className={linkClass} />}
    </div>
    {!current && <p className="px-3 text-xs text-slate-500">{waitingForObjectContext ? "Quiz · Kontext wird geprüft …" : legacyContext?.label ?? (crossSeries ? "Reihenübergreifend · Quiz" : pathname === "/" ? (choices.length ? "Arbeitsbereich auswählen" : canUseContent ? "Reihenübergreifend · Quiz" : "Keine freigeschalteten Arbeitsbereiche") : admin ? "Globale Verwaltung" : "Gemeinsame Verwaltung")}</p>}
  </div>;
}
