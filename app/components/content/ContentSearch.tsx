"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { searchContent } from "./actions";
import { contentResumeKey, readContentResume, type ContentResume } from "./contentNavigation";
import ContentFilters from "./ContentFilters";
import ContentResultRow from "./ContentResultRow";
import { parseContentFilters, resolveContentFilterDraft, serializeContentFilters, type ContentFilterDraft, type ContentFilterOption, type ContentInitialType, type ContentQuizOption, type ContentSearchResult, type ContentTemplateOption } from "./contentLibrary";

export function ContentSearchState({ initialType, quizzes, categories, eventSeries, templates, paramsKey }: { initialType: ContentInitialType; quizzes: ContentQuizOption[]; categories: ContentFilterOption[]; eventSeries: ContentFilterOption[]; templates: ContentTemplateOption[]; paramsKey: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const filterableTemplateIds = templates
    .filter((template) => template.availableForFiltering)
    .map((template) => template.id);
  const [draft, setDraft] = useState<ContentFilterDraft>(() => ({
    initialType,
    paramsKey,
    filters: parseContentFilters(new URLSearchParams(paramsKey), initialType, filterableTemplateIds),
  }));
  const filters = resolveContentFilterDraft(draft, initialType, paramsKey, filterableTemplateIds);
  const [result, setResult] = useState<ContentSearchResult>({ items: [], total: 0 });
  const generation = useRef(0);
  const loadedPages = useRef(1);
  const resume = useRef<ContentResume | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const requestFilters = parseContentFilters(new URLSearchParams(paramsKey), initialType, filterableTemplateIds);
    const request = ++generation.current;
    let previous: ContentResume | null = null;
    try { previous = readContentResume(sessionStorage.getItem(contentResumeKey(pathname, paramsKey))); } catch { /* Storage is optional. */ }
    loadedPages.current = 1;
    startTransition(async () => {
      try {
        let page = await searchContent(requestFilters);
        const wantedPages = previous?.pages ?? 1;
        for (let index = 1; index < wantedPages && page.nextCursor && request === generation.current; index++) {
          const next = await searchContent(requestFilters, page.nextCursor);
          page = { ...next, items: [...new Map([...page.items, ...next.items].map(item => [item.key, item])).values()] };
          loadedPages.current++;
        }
        if (request !== generation.current) return;
        resume.current = previous;
        setResult(page); setError("");
      } catch { if (request === generation.current) setError("Die Inhalte konnten nicht geladen werden."); }
    });
    return () => { generation.current = request + 1; };
    // The localized registry is stable; applied URL filters define the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialType, paramsKey, refreshVersion]);

  useEffect(() => {
    const saved = resume.current;
    if (!saved) return;
    resume.current = null;
    const frame = requestAnimationFrame(() => {
      const rows = [...document.querySelectorAll<HTMLElement>("[data-content-key]")];
      const row = rows.find(node => node.dataset.contentKey === saved.anchor) ?? rows[Math.min(saved.index, rows.length - 1)];
      if (!row) return;
      window.scrollBy(0, row.getBoundingClientRect().top - saved.offset);
      const target = saved.focus ? [...row.querySelectorAll<HTMLElement>("a,button,select,summary")].find(node => node.getAttribute("aria-label") === saved.focus || node.textContent === saved.focus) : row;
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [result]);

  function remember(key: string) {
    const rows = [...document.querySelectorAll<HTMLElement>("[data-content-key]")];
    const row = rows.find(node => node.dataset.contentKey === key);
    const focused = document.activeElement;
    const saved: ContentResume = { pages: loadedPages.current, anchor: key, index: Math.max(0, rows.indexOf(row!)), offset: row?.getBoundingClientRect().top ?? 0, focus: focused?.getAttribute("aria-label") ?? focused?.textContent ?? null };
    try { sessionStorage.setItem(contentResumeKey(pathname, paramsKey), JSON.stringify(saved)); } catch { /* No storage requirement. */ }
  }
  function more() {
    if (!result.nextCursor || pending) return;
    const request = generation.current;
    startTransition(async () => {
      try {
        const page = await searchContent(parseContentFilters(new URLSearchParams(paramsKey), initialType, filterableTemplateIds), result.nextCursor!);
        if (request !== generation.current) return;
        loadedPages.current++;
        setResult(current => ({ ...page, items: [...new Map([...current.items, ...page.items].map(item => [item.key, item])).values()] }));
        setError("");
      } catch { if (request === generation.current) setError("Weitere Treffer konnten nicht geladen werden. Bitte erneut versuchen."); }
    });
  }
  function updateFilters(next: typeof filters) { setDraft({ initialType, paramsKey, filters: next }); }
  function apply(next = filters) {
    generation.current++;
    try { sessionStorage.removeItem(contentResumeKey(pathname, paramsKey)); } catch { /* Optional storage. */ }
    const params = serializeContentFilters(next);
    if (params.toString() === paramsKey) setRefreshVersion(value => value + 1);
    else router.push(params.size > 0 ? `${pathname}?${params}` : pathname);
  }
  function reset() { const next = parseContentFilters(new URLSearchParams(), initialType, filterableTemplateIds); updateFilters(next); apply(next); }
  function changeTemplate(templateId: string | null) { const next = { ...filters, templateId }; updateFilters(next); apply(next); }

  const heldCount = result.items.filter(item => item.justApproved && (filters.status === "NOT_APPROVED" || filters.status === "DRAFT")).length;
  return <div className="space-y-4">
    <ContentFilters filters={filters} categories={categories} eventSeries={eventSeries} templates={templates} loading={pending} onChange={updateFilters} onTemplateChange={changeTemplate} onApply={() => apply()} onReset={reset} />
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-700"><span aria-live="polite">{pending ? "Inhalte werden geladen …" : `${result.items.length - heldCount} geladene Treffer · ${result.total} Suchtreffer${heldCount ? ` · ${heldCount} gerade freigegeben` : ""}`}</span><span>Neu angelegt zuerst</span><button type="button" disabled={pending} onClick={() => apply()} className="min-h-11 rounded-xl border px-3">Aktualisieren</button></div>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}
    <div className="space-y-3" aria-busy={pending} inert={pending}>{result.items.map((item) => <ContentResultRow key={item.key} item={item} quizzes={quizzes} templates={templates} returnTo={`${pathname}${paramsKey ? `?${paramsKey}` : ""}`} onNavigate={() => remember(item.key)} onUpdated={(updated) => setResult(current => ({ ...current, total: Math.max(0, current.total - (filters.status === "NOT_APPROVED" || filters.status === "DRAFT" ? 1 : 0)), items: current.items.map(row => row.key === updated.key ? { ...updated, justApproved: true } : row) }))} />)}</div>
    {result.nextCursor && <button type="button" disabled={pending} onClick={more} className="min-h-11 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white disabled:opacity-50">Weitere Treffer laden</button>}
    {!pending && !error && result.items.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">Keine passenden Inhalte gefunden.</div>}
  </div>;
}

export default function ContentSearch({ initialType, quizzes, categories, eventSeries, templates }: { initialType?: ContentInitialType; quizzes: ContentQuizOption[]; categories: ContentFilterOption[]; eventSeries: ContentFilterOption[]; templates: ContentTemplateOption[] }) {
  const paramsKey = useSearchParams().toString();
  return <ContentSearchState initialType={initialType} quizzes={quizzes} categories={categories} eventSeries={eventSeries} templates={templates} paramsKey={paramsKey} />;
}
