"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { confirmExcelQuestions, previewExcelQuestions } from "./actions";
import { maxFileBytes, type ImportReceipt, type Issue, type PreviewQuestion, type PreviewResult } from "./format";

function Issues({ title, issues, error = false }: { title: string; issues: Issue[]; error?: boolean }) {
  if (!issues.length) return null;
  return (
    <section role={error ? "alert" : undefined} className={`rounded-xl border p-4 ${error ? "border-red-300 bg-red-50 text-red-950" : "border-amber-300 bg-amber-50 text-amber-950"}`}>
      <h2 className="font-semibold">{title} ({issues.length})</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {issues.map(({ sheet, row, field, message }, index) => (
          <li key={index}><strong>{sheet}{row ? ` · Zeile ${row}` : ""} · {field}</strong> {message}</li>
        ))}
      </ul>
    </section>
  );
}

function QuestionPreview({ question }: { question: PreviewQuestion }) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="whitespace-pre-wrap font-semibold">{question.key} · {question.text || "Fragetext fehlt"}</h3>
      <p className="text-sm text-slate-600">{question.type}{question.resolvedCategories.length ? ` · ${question.resolvedCategories.join(", ")}` : ""}</p>
      {question.answers.length > 0 && <ul className="mt-2 space-y-1 text-sm">
        {question.answers.map(answer => <li key={answer.row}>
          <strong>{answer.correct ? "Richtig" : "Falsch"}</strong> · {answer.text}
          {answer.info && <p className="whitespace-pre-wrap text-slate-600">{answer.info}</p>}
        </li>)}
      </ul>}
      {question.pairs.length > 0 && <table className="mt-2 text-left text-sm">
        <thead><tr><th scope="col" className="pr-6">Links</th><th scope="col">Rechts</th></tr></thead>
        <tbody>{question.pairs.map(pair => <tr key={pair.row}><td className="pr-6">{pair.left}</td><td>{pair.right}</td></tr>)}</tbody>
      </table>}
      {question.source && <p className="mt-2 whitespace-pre-wrap text-sm">Quelle oder Bemerkung · {question.source}</p>}
      {question.notes && <p className="whitespace-pre-wrap text-sm">Moderationsnotiz · {question.notes}</p>}
      {question.categoryRequest && <p className="whitespace-pre-wrap text-sm">Kategorienwunsch · {question.categoryRequest}</p>}
      {question.outdatedFrom && <p className="text-sm">Veraltet ab · {question.outdatedFrom}</p>}
      {question.reviewFrom && <p className="text-sm">Prüfen ab · {question.reviewFrom}</p>}
    </li>
  );
}

const button = "rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const defaultError: Issue = { sheet: "Datei", field: "Import", message: "Die Anfrage ist fehlgeschlagen. Bitte erneut versuchen." };

export function ExcelQuestionImport({ canUseGlobal, series, initialSeries }: {
  canUseGlobal: boolean; series: { id: number; name: string }[]; initialSeries?: number;
}) {
  const [file, setFile] = useState<File>();
  const [scope, setScope] = useState(initialSeries ? "EVENT_SERIES" : "");
  const [selected, setSelected] = useState<number[]>(initialSeries ? [initialSeries] : []);
  const [preview, setPreview] = useState<PreviewResult>();
  const [result, setResult] = useState<ImportReceipt>();
  const [failure, setFailure] = useState<Issue[]>([]);
  const [busy, setBusy] = useState<"preview" | "confirm">();
  const requestActive = useRef(false);
  const target = scope === "GLOBAL" ? "GLOBAL" : scope === "EVENT_SERIES" ? selected.join(",") : "";
  const targetLabel = scope === "GLOBAL" ? "Global" : series.filter(option => selected.includes(option.id)).map(option => option.name).join(", ");

  function clearResults() {
    setPreview(undefined);
    setResult(undefined);
    setFailure([]);
  }

  function requestData() {
    const form = new FormData();
    form.set("target", target);
    if (file) form.set("file", file);
    return form;
  }

  async function check(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !target || requestActive.current) return;
    clearResults();
    if (file.size > maxFileBytes) {
      setFailure([{ ...defaultError, message: "Die Datei darf höchstens 768 KiB groß sein." }]);
      return;
    }
    requestActive.current = true;
    setBusy("preview");
    try {
      setPreview(await previewExcelQuestions(requestData()));
    } catch {
      setFailure([defaultError]);
    } finally {
      requestActive.current = false;
      setBusy(undefined);
    }
  }

  async function commit() {
    if (!preview?.token || requestActive.current) return;
    const form = requestData();
    form.set("token", preview.token);
    requestActive.current = true;
    setBusy("confirm");
    setFailure([]);
    try {
      const response = await confirmExcelQuestions(form);
      if (response.ok) {
        setResult(response.questions);
        setPreview(undefined);
      } else {
        setFailure(response.errors);
      }
    } catch {
      setFailure([defaultError]);
    } finally {
      requestActive.current = false;
      setBusy(undefined);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 text-sm">
        <a className="font-semibold underline" href="/fragen/import/excel/download">Excel-Vorlage herunterladen</a>
        <a className="font-semibold underline" href="/fragen/import/excel/download?typ=beispiel">Beispielmappe herunterladen</a>
      </div>
      <form onSubmit={check} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <fieldset disabled={Boolean(busy)} className="space-y-2">
          <legend className="font-semibold">Zielbereich</legend>
          {canUseGlobal && <label className="flex items-center gap-2">
            <input type="radio" name="scope" value="GLOBAL" checked={scope === "GLOBAL"} onChange={() => { setScope("GLOBAL"); clearResults(); }} /> Global
          </label>}
          {series.length > 0 && <label className="flex items-center gap-2">
            <input type="radio" name="scope" value="EVENT_SERIES" checked={scope === "EVENT_SERIES"} onChange={() => { setScope("EVENT_SERIES"); clearResults(); }} /> Eventreihe
          </label>}
          {scope === "EVENT_SERIES" && <fieldset className="max-h-52 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
            <legend className="text-sm">Eventreihen auswählen</legend>
            {series.map(option => <label key={option.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={selected.includes(option.id)} onChange={event => {
                setSelected(event.target.checked ? [...selected, option.id] : selected.filter(id => id !== option.id));
                clearResults();
              }} />
              {option.name}{series.filter(other => other.name === option.name).length > 1 ? ` (#${option.id})` : ""}
            </label>)}
          </fieldset>}
        </fieldset>
        <label className="block space-y-1 font-semibold">
          <span>Excel-Datei</span>
          <input className="block max-w-full text-sm font-normal" type="file" accept=".xlsx" disabled={Boolean(busy)}
            onChange={event => { setFile(event.target.files?.[0]); clearResults(); }} />
        </label>
        <button type="submit" className={button} disabled={!file || !target || Boolean(busy)}>{busy === "preview" ? "Datei wird geprüft …" : "Datei prüfen"}</button>
      </form>
      <Issues title="Import nicht möglich" issues={failure} error />
      {preview && <section className="space-y-4" aria-labelledby="excel-preview-heading">
        <h2 id="excel-preview-heading" className="text-xl font-bold">Vorschau · {preview.questions.length} Fragen</h2>
        <p>Zielbereich · {targetLabel}</p>
        <Issues title="Fehler" issues={preview.errors} error />
        <Issues title="Hinweise" issues={preview.warnings} />
        {preview.token && <button type="button" className={button} disabled={Boolean(busy)} onClick={commit}>
          {busy === "confirm" ? "Entwürfe werden angelegt …" : `${preview.questions.length} Fragen als Entwürfe importieren`}
        </button>}
        <ul className="space-y-2">{preview.questions.map(question => <QuestionPreview key={question.key} question={question} />)}</ul>
      </section>}
      {result && <section role="status" className="space-y-2 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
        <h2 className="text-xl font-bold">{result.length} Entwürfe angelegt</h2>
        <p>Zielbereich · {targetLabel}</p>
        <ul className="list-disc space-y-1 pl-5">{result.map(question => <li key={question.id}>
          <Link className="underline" href={`/content/questions/${question.id}`}>{question.key} · {question.text}</Link>
        </li>)}</ul>
      </section>}
    </div>
  );
}
