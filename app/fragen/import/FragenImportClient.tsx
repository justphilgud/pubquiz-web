"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { XMLParser } from "fast-xml-parser";
import { importFragenAusDatei, pruefeFragenImport } from "../actions";


type ImportZeile = {
  frage: string;
  antworten: string[];
  richtige_antworten: string[];
  kategorie: string;
  quelle: string;

  frage_medien: string[];
  antwort_medien: Record<number, string[]>;
};

type DryRunResult = {
  importiert: number;
  uebersprungen: number;
  duplikate: {
    zeile: number;
    frage: string;
    grund: string;
  }[];
};

const pflichtfelder: (keyof ImportZeile)[] = ["frage"];

function normalisiereZeile(row: Record<string, unknown>): ImportZeile {
  const antworten = Object.entries(row)
    .filter(([key]) => key.toLowerCase().startsWith("antwort_"))
    .sort(([a], [b]) => {
      const nummerA = Number(a.replace(/\D/g, ""));
      const nummerB = Number(b.replace(/\D/g, ""));
      return nummerA - nummerB;
    })
    .map(([, value]) => String(value ?? "").trim())
    .filter(Boolean);

  const richtigeAntwortenRaw = String(row.richtige_antworten ?? "").trim();

  const frageMedien = Object.entries(row)
    .filter(([key]) => key.toLowerCase().startsWith("frage_medien_"))
    .sort(([a], [b]) => {
      const nummerA = Number(a.replace(/\D/g, ""));
      const nummerB = Number(b.replace(/\D/g, ""));
      return nummerA - nummerB;
    })
    .map(([, value]) => String(value ?? "").trim())
    .filter(Boolean);

  const antwortMedien: Record<number, string[]> = {};

  Object.entries(row).forEach(([key, value]) => {
    const match = key.toLowerCase().match(/^antwort_(\d+)_medien_(\d+)$/);

    if (!match) return;

    const antwortNummer = Number(match[1]);
    const datei = String(value ?? "").trim();

    if (!datei) return;

    if (!antwortMedien[antwortNummer]) {
      antwortMedien[antwortNummer] = [];
    }

    antwortMedien[antwortNummer].push(datei);
  });

  return {
    frage: String(row.frage ?? "").trim(),
    antworten,
    richtige_antworten: richtigeAntwortenRaw
      ? richtigeAntwortenRaw
        .split(/[;,|]/)
        .map((wert) => wert.trim())
        .filter(Boolean)
      : [],
    kategorie: String(row.kategorie ?? "").trim(),
    quelle: String(row.quelle ?? "").trim(),
    frage_medien: frageMedien,
    antwort_medien: antwortMedien,
  };
}

function pruefeZeilen(zeilen: ImportZeile[]) {
  const fehler: string[] = [];
  const warnungen: string[] = [];

  if (zeilen.length === 0) {
    fehler.push("Die Datei enthält keine importierbaren Zeilen.");
  }

  zeilen.forEach((zeile, index) => {
    const zeilennummer = index + 2;

    if (!zeile.frage) {
      fehler.push(`Zeile ${zeilennummer}: Pflichtfeld 'frage' fehlt.`);
    }

    const istFreitext = zeile.antworten.length === 0;
    const istSchaetzfrage =
      zeile.kategorie.trim().toLowerCase() === "schätzfrage";

    if (!istFreitext && zeile.antworten.length < 2) {
      fehler.push(`Zeile ${zeilennummer}: Mindestens zwei Antworten nötig.`);
    }

    if (!istFreitext && zeile.richtige_antworten.length === 0) {
      fehler.push(
        `Zeile ${zeilennummer}: Es muss mindestens eine richtige Antwort angegeben werden.`
      );
    }

    zeile.richtige_antworten.forEach((wert) => {
      const nummer = Number(wert);

      if (!Number.isInteger(nummer) || nummer < 1) {
        fehler.push(
          `Zeile ${zeilennummer}: richtige_antworten enthält einen ungültigen Wert: ${wert}`
        );
      }

      if (nummer > zeile.antworten.length) {
        fehler.push(
          `Zeile ${zeilennummer}: richtige_antworten verweist auf Antwort ${nummer}, die nicht existiert.`
        );
      }
    });

    if (istSchaetzfrage && zeile.richtige_antworten.length === 0) {
      warnungen.push(
        `Zeile ${zeilennummer}: Schätzfrage ohne richtige Antwort.`
      );
    }

    if (!zeile.kategorie) {
      warnungen.push(`Zeile ${zeilennummer}: Keine Kategorie angegeben.`);
    }

    if (!zeile.quelle) {
      warnungen.push(`Zeile ${zeilennummer}: Keine Quelle angegeben.`);
    }
  });

  return { fehler, warnungen };
}

function parseCsv(text: string): ImportZeile[] {
  const workbook = XLSX.read(text, { type: "string" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  return rows.map(normalisiereZeile);
}

function parseExcel(arrayBuffer: ArrayBuffer): ImportZeile[] {
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  return rows.map(normalisiereZeile);
}

function parseXml(text: string): ImportZeile[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
  });

  const result = parser.parse(text);
  const eintraege = result.fragen?.frage ?? result.import?.frage ?? [];
  const rows = Array.isArray(eintraege) ? eintraege : [eintraege];

  return rows.map((row) => normalisiereZeile(row as Record<string, unknown>));
}

export default function FragenImportClient() {
  const [dateiname, setDateiname] = useState("");
  const [zeilen, setZeilen] = useState<ImportZeile[]>([]);
  const [fehler, setFehler] = useState<string[]>([]);
  const [warnungen, setWarnungen] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setDateiname(file.name);
    setZeilen([]);
    setFehler([]);
    setWarnungen([]);
    setDryRunResult(null);
    setIsParsing(true);

    try {
      const name = file.name.toLowerCase();
      let parsed: ImportZeile[] = [];

      if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        parsed = parseExcel(await file.arrayBuffer());
      } else if (name.endsWith(".csv")) {
        parsed = parseCsv(await file.text());
      } else if (name.endsWith(".xml")) {
        parsed = parseXml(await file.text());
      } else {
        setFehler([
          "Dateityp wird nicht unterstützt. Bitte Excel, CSV oder XML verwenden.",
        ]);
        return;
      }

      const pruefung = pruefeZeilen(parsed);

      setZeilen(parsed);
      setFehler(pruefung.fehler);
      setWarnungen(pruefung.warnungen);
    } catch (error) {
      setFehler([
        error instanceof Error
          ? error.message
          : "Datei konnte nicht gelesen werden.",
      ]);
    } finally {
      setIsParsing(false);
    }
  }

  async function handleDryRun() {
    setDryRunResult(null);

    const result = await pruefeFragenImport(zeilen);

    setDryRunResult(result);

    const duplikatWarnungen = result.duplikate.map(
      (duplikat) =>
        `Zeile ${duplikat.zeile}: ${duplikat.frage} — ${duplikat.grund}`
    );

    setWarnungen((current) => [
      ...current.filter((warnung) => !warnung.includes("existiert bereits")),
      ...duplikatWarnungen,
    ]);
  }

  async function handleImport() {
    setIsImporting(true);

    try {
      const result = await importFragenAusDatei(zeilen);

      alert(
        `${result.importiert} Fragen importiert.\n${result.uebersprungen} übersprungen.`
      );

      if (result.duplikate?.length > 0) {
        setWarnungen(
          result.duplikate.map(
            (duplikat) =>
              `Zeile ${duplikat.zeile}: ${duplikat.frage} — ${duplikat.grund}`
          )
        );
      }
    } finally {
      setIsImporting(false);
    }
  }

  const importMoeglich = zeilen.length > 0 && fehler.length === 0;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <label className="block">
          <div className="mb-2 text-sm font-semibold text-slate-700">
            Importdatei auswählen
          </div>

          <input
            type="file"
            accept=".xlsx,.xls,.csv,.xml"
            onChange={handleFileChange}
            className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
          />
        </label>

        {dateiname && (
          <div className="mt-4 text-sm font-semibold text-slate-600">
            Ausgewählt: {dateiname}
          </div>
        )}

        {isParsing && (
          <div className="mt-4 text-sm font-semibold text-slate-500">
            Datei wird geprüft...
          </div>
        )}
      </div>

      {fehler.length > 0 && (
        <div className="rounded-3xl bg-red-50 p-6 text-red-800 shadow-sm">
          <div className="mb-3 text-lg font-bold">Fehler</div>
          <div className="space-y-1 text-sm">
            {fehler.map((meldung) => (
              <div key={meldung}>{meldung}</div>
            ))}
          </div>
        </div>
      )}

      {warnungen.length > 0 && (
        <div className="rounded-3xl bg-yellow-50 p-6 text-yellow-900 shadow-sm">
          <div className="mb-3 text-lg font-bold">Warnungen</div>
          <div className="space-y-1 text-sm">
            {warnungen.map((meldung) => (
              <div key={meldung}>{meldung}</div>
            ))}
          </div>
        </div>
      )}

      {zeilen.length > 0 && (
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-lg font-bold text-slate-900">Vorschau</div>
              <div className="text-sm text-slate-500">
                {zeilen.length} Zeilen erkannt
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!importMoeglich}
                onClick={handleDryRun}
                className="rounded-xl bg-slate-700 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                Dry-Run prüfen
              </button>

              <button
                type="button"
                disabled={!importMoeglich || !dryRunResult || isImporting}
                onClick={handleImport}
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isImporting
                  ? "Import läuft..."
                  : "Import endgültig durchführen"}
              </button>
            </div>
          </div>

          {dryRunResult && (
            <div className="mb-4 rounded-2xl bg-slate-100 p-4 text-sm text-slate-700">
              <div>Importierbar: {dryRunResult.importiert}</div>
              <div>Übersprungen: {dryRunResult.uebersprungen}</div>
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Frage</th>
                  <th className="px-3 py-2">Antworten</th>
                  <th className="px-3 py-2">Richtig</th>
                  <th className="px-3 py-2">Frage-Medien</th>
                  <th className="px-3 py-2">Antwort-Medien</th>
                  <th className="px-3 py-2">Kategorie</th>
                  <th className="px-3 py-2">Quelle</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {zeilen.slice(0, 50).map((zeile, index) => (
                  <tr key={`${zeile.frage}-${index}`}>
                    <td className="max-w-md px-3 py-2 font-semibold">
                      {zeile.frage}
                    </td>

                    <td className="px-3 py-2">
                      {zeile.antworten.length > 0
                        ? zeile.antworten.map((antwort, antwortIndex) => (
                          <div key={`${antwort}-${antwortIndex}`}>
                            {antwortIndex + 1}. {antwort}
                          </div>
                        ))
                        : "-"}
                    </td>

                    <td className="px-3 py-2 font-bold">
                      {zeile.richtige_antworten.length > 0
                        ? zeile.richtige_antworten.join(", ")
                        : "-"}
                    </td>

                    <td className="px-3 py-2">
                      {zeile.frage_medien.length > 0
                        ? zeile.frage_medien.map((medium, index) => (
                          <div key={`${medium}-${index}`}>{medium}</div>
                        ))
                        : "-"}
                    </td>

                    <td className="px-3 py-2">
                      {Object.entries(zeile.antwort_medien).length > 0
                        ? Object.entries(zeile.antwort_medien).map(([antwortNummer, medien]) => (
                          <div key={antwortNummer}>
                            Antwort {antwortNummer}: {medien.join(", ")}
                          </div>
                        ))
                        : "-"}
                    </td>

                    <td className="px-3 py-2">{zeile.kategorie}</td>
                    <td className="px-3 py-2">{zeile.quelle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {zeilen.length > 50 && (
            <div className="mt-3 text-sm text-slate-500">
              Vorschau zeigt nur die ersten 50 Zeilen.
            </div>
          )}
        </div>
      )}
    </div>
  );
}