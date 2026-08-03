"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { searchContent } from "./actions";
import ContentFilters from "./ContentFilters";
import ContentResultRow from "./ContentResultRow";
import { parseContentFilters, resolveContentFilterDraft, serializeContentFilters, type ContentFilterDraft, type ContentInitialType, type ContentQuizOption, type ContentSearchItem } from "./contentLibrary";

export function ContentSearchState({ initialType, quizzes, paramsKey }: { initialType: ContentInitialType; quizzes: ContentQuizOption[]; paramsKey: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [draft, setDraft] = useState<ContentFilterDraft>(() => ({
    initialType,
    paramsKey,
    filters: parseContentFilters(new URLSearchParams(paramsKey), initialType),
  }));
  const filters = resolveContentFilterDraft(draft, initialType, paramsKey);
  const [items, setItems] = useState<ContentSearchItem[]>([]);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const requestFilters = parseContentFilters(new URLSearchParams(paramsKey), initialType);
    startTransition(async () => { try { setItems(await searchContent(requestFilters)); setError(""); } catch { setError("Die Inhalte konnten nicht geladen werden."); } });
  }, [initialType, paramsKey]);
  function updateFilters(next: typeof filters) { setDraft({ initialType, paramsKey, filters: next }); }
  function apply(next = filters) { const params = serializeContentFilters(next); router.push(params.size > 0 ? `${pathname}?${params}` : pathname); }
  function reset() { const next = parseContentFilters(new URLSearchParams(), initialType); updateFilters(next); apply(next); }

  return <div className="space-y-4">
    <ContentFilters filters={filters} loading={pending} onChange={updateFilters} onApply={() => apply()} onReset={reset} />
    <div className="flex items-center justify-between text-sm font-semibold text-slate-700"><span>{pending ? "Inhalte werden geladen …" : `${items.length} Treffer`}</span></div>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}
    <div className="space-y-3">{items.map((item) => <ContentResultRow key={item.key} item={item} quizzes={quizzes} />)}</div>
    {!pending && !error && items.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">Keine passenden Inhalte gefunden.</div>}
  </div>;
}

export default function ContentSearch({ initialType, quizzes }: { initialType?: ContentInitialType; quizzes: ContentQuizOption[] }) {
  const paramsKey = useSearchParams().toString();
  return <ContentSearchState initialType={initialType} quizzes={quizzes} paramsKey={paramsKey} />;
}
