"use client";

import { useState } from "react";
import { editorialImportAction } from "./editorialActions";

type Result = Awaited<ReturnType<typeof editorialImportAction>>;

export default function EditorialImportPanel() {
  const [files, setFiles] = useState<{ name: string; raw: string }[]>([]);
  const [sourceKey, setSourceKey] = useState("PR93");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(mode: "dry-run" | "import") {
    setBusy(true); setError("");
    try { setResult(await editorialImportAction({ sourceKey, files, mode, digest: result?.digest })); }
    catch (e) { setError(e instanceof Error ? e.message : "Import fehlgeschlagen."); if (mode === "import") setResult(null); }
    finally { setBusy(false); }
  }
  function download() {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(result.manifest ?? result, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `editorial-${sourceKey.replaceAll("/", "-")}-${result.mode}.json`; link.click(); URL.revokeObjectURL(url);
  }
  return <section aria-labelledby="editorial-import-heading" className="space-y-4 rounded-3xl bg-white p-6 shadow-sm">
    <h2 id="editorial-import-heading" className="text-xl font-bold">Redaktionellen Fragenpool importieren</h2>
    <p className="text-sm text-slate-600">Zuerst Vorschau prüfen. Nur konfliktfreie Fragen werden als Entwurf importiert. Bestehende Fragen bleiben unverändert.</p>
    <label className="block">Stabile Importquelle<input value={sourceKey} disabled={busy} onChange={e => { setSourceKey(e.target.value); setResult(null); }} className="ml-3 rounded-lg border p-2" /></label>
    <label className="block">Redaktionelle JSON-Dateien<input type="file" accept=".json" multiple disabled={busy} className="mt-2 block" onChange={async e => {
      setResult(null); setError(""); setBusy(true);
      try { const selected = Array.from(e.target.files ?? []); if (selected.reduce((n,f) => n+f.size,0)>500_000) throw new Error("Dateien sind zu groß."); setFiles(await Promise.all(selected.map(async f => ({name:f.name,raw:await f.text()})))); }
      catch (e) { setFiles([]); setError(e instanceof Error ? e.message : "Datei nicht lesbar."); }
      finally { setBusy(false); }
    }} /></label>
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={busy || !files.length} onClick={() => run("dry-run")} className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-40">Vorschau prüfen</button>
      <button type="button" disabled={busy || result?.mode !== "dry-run" || !result.decisions.some(d => d.action === "IMPORTIEREN")} onClick={() => run("import")} className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-40">Konfliktfreie Fragen importieren</button>
      {result && <button type="button" onClick={download} className="rounded-lg border px-4 py-2">{result.manifest ? "ID-Manifest herunterladen" : "Vorschau herunterladen"}</button>}
    </div>
    {busy && <p role="status">Prüfung läuft…</p>}{error && <p role="alert" className="text-red-700">{error}</p>}
    {result && <>
      <p role="status">{result.mode === "import" ? `${result.questionIds.length} Fragen als Entwurf importiert.` : `${result.decisions.filter(d => d.action === "IMPORTIEREN").length} konfliktfrei; ${result.decisions.filter(d => d.action !== "IMPORTIEREN").length} übersprungen oder manuell zu prüfen.`}</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Import-ID", "Template", "Frage", "Lösung", "Schwierigkeit", "Kategorien", "Validierung / Dubletten", "Aktion"].map(c => <th key={c} className="p-2">{c}</th>)}</tr></thead>
        <tbody>{result.decisions.map(d => <tr key={d.candidate.externalId} className="border-t"><td className="p-2">{d.candidate.externalId}</td><td className="p-2">{d.candidate.templateId}</td><td className="p-2">{d.candidate.question}</td><td className="p-2">{d.candidate.solution}</td><td className="p-2">{d.candidate.difficulty}</td><td className="p-2">{d.candidate.categories.join(", ")}</td><td className="p-2">{[...d.validation, ...d.duplicates.map(q => `${q.questionId}: ${q.reason}`)].join("; ") || "Gültig; keine Treffer"}</td><td className="p-2">{d.action}</td></tr>)}</tbody></table></div>
    </>}
  </section>;
}
