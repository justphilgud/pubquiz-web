import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/permissions";
import {
  createPublicTextReplacementRule,
  deletePublicTextReplacementRule,
  setPublicTextReplacementRuleActive,
  updatePublicTextReplacementRule,
} from "./actions";

export default async function LiveTextReplacementRulesPage() {
  await requireAdmin();
  const rules = await prisma.public_text_replacement_rules.findMany({
    orderBy: [{ is_active: "desc" }, { search_term: "asc" }],
  });
  const fieldClass = "min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2";
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header><p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Administration</p><h1 className="text-3xl font-bold">Öffentliche Text-Ersatzregeln</h1><p className="mt-2 text-slate-600">Die Regeln verändern ausschließlich freigegebene Texte in der öffentlichen Live-Präsentation. Originalantwort und Auswertung bleiben unverändert.</p></header>
      <form action={createPublicTextReplacementRule} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_1fr_auto]">
        <label className="grid gap-1 text-sm font-semibold">Suchbegriff<input name="searchTerm" required maxLength={120} className={fieldClass} /></label>
        <label className="grid gap-1 text-sm font-semibold">Ersatz<input name="replacement" required maxLength={120} className={fieldClass} /></label>
        <button className="min-h-11 self-end rounded-xl bg-slate-950 px-4 py-2 font-semibold text-white">Regel anlegen</button>
      </form>
      <section className="space-y-3">
        {rules.map((rule) => (
          <article key={rule.public_text_replacement_rule_id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <form action={updatePublicTextReplacementRule} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <input type="hidden" name="id" value={rule.public_text_replacement_rule_id} />
              <label className="grid gap-1 text-sm font-semibold">Suchbegriff<input name="searchTerm" defaultValue={rule.search_term} required maxLength={120} className={fieldClass} /></label>
              <label className="grid gap-1 text-sm font-semibold">Ersatz<input name="replacement" defaultValue={rule.replacement} required maxLength={120} className={fieldClass} /></label>
              <button className="min-h-11 self-end rounded-xl border border-slate-300 px-4 py-2 font-semibold">Speichern</button>
            </form>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${rule.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{rule.is_active ? "Aktiv" : "Inaktiv"}</span>
              <div className="flex gap-2">
                <form action={setPublicTextReplacementRuleActive}><input type="hidden" name="id" value={rule.public_text_replacement_rule_id} /><input type="hidden" name="active" value={String(!rule.is_active)} /><button className="min-h-10 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold">{rule.is_active ? "Deaktivieren" : "Aktivieren"}</button></form>
                <form action={deletePublicTextReplacementRule}><input type="hidden" name="id" value={rule.public_text_replacement_rule_id} /><button className="min-h-10 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700">Löschen</button></form>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
