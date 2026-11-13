import { createHash } from "node:crypto";
import { normalizeExactOpenAnswer } from "@/app/quiz/evaluation/evaluateBaseAnswer";
import { CATEGORY_NAME_MAX_LENGTH, normalizeCategoryComparisonKey, normalizeCategoryName } from "../../editor/categoryPolicy";
import { isDateInput } from "../../editor/questionLifecycle";
import { normalizePairTerm, PAIRS_MAX, PAIR_TEXT_MAX } from "../../editor/templates/pairsTemplate";
import { questionTypes, type ImportQuestion, type Issue, type QuestionType, type Sheet } from "./format";
import { readTables, type Table } from "./readWorkbook";

type TableRow = Table["rows"][number];

function readRow(sheet: Sheet, table: Table, row: TableRow, errors: Issue[]) {
  const fields = new Map([...table.columns].map(([name, column]) => [column, name]));
  const result = new Map<string, string>();
  for (const [column, cell] of row.cells) {
    const field = fields.get(column);
    const message = cell.error || (!field ? "In dieser Spalte ist keine Eingabe vorgesehen." : "");
    if (message) errors.push({ sheet, row: row.number, field: field ?? `Spalte ${column}`, message });
    if (field) result.set(field, cell.value.replace(/\r\n?/g, "\n").trim());
  }
  return (field: string) => result.get(field) ?? "";
}

function checkText(value: string, limit: number, required = false, singleLine = false) {
  if (required && !value) return "Dieses Feld muss ausgefüllt sein.";
  if (value.length > limit) return `Maximal ${limit} Zeichen sind zulässig.`;
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) return "Der Text enthält unzulässige Steuerzeichen.";
  if (singleLine && value.includes("\n")) return "Bitte einen Begriff oder Antworttext pro Zelle eingeben.";
}

export function parseImport(bytes: Buffer) {
  const { tables, errors } = readTables(bytes);
  const warnings: Issue[] = [];
  const questions = new Map<string, ImportQuestion>();
  const report = (sheet: Sheet, row: number, field: string, message?: string) => {
    if (message) errors.push({ sheet, row, field, message });
  };
  if (errors.length) return { questions: [], errors, warnings };
  const questionTable = tables.get("Fragen")!;
  for (const row of questionTable.rows) {
    const get = readRow("Fragen", questionTable, row, errors);
    const issue = (field: string, message?: string) => report("Fragen", row.number, field, message);
    const key = get("Fragekürzel");
    if (!/^[a-z0-9_-]{1,40}$/i.test(key)) {
      issue("Fragekürzel", "Bitte ein Kürzel mit 1 bis 40 Zeichen aus Buchstaben A–Z, Ziffern, Bindestrich oder Unterstrich eingeben.");
      continue;
    }
    if (questions.has(key.toUpperCase())) {
      issue("Fragekürzel", `Dieses Kürzel steht bereits in Zeile ${questions.get(key.toUpperCase())!.row}.`);
      continue;
    }
    const type = get("Fragetyp") as QuestionType;
    if (!questionTypes.includes(type)) {
      issue("Fragetyp", "Bitte Offen, Geschlossen oder Paare bilden auswählen.");
      continue;
    }
    const mode = get("Auswahlmodus");
    if (type === "Geschlossen" ? mode !== "Einfachauswahl" : Boolean(mode)) {
      issue("Auswahlmodus", type === "Geschlossen"
        ? "Für geschlossene Fragen ist ausschließlich Einfachauswahl zulässig."
        : "Für diesen Fragetyp bleibt der Auswahlmodus leer.");
    }
    const text = get("Fragetext");
    const source = get("Quelle oder Bemerkung");
    const notes = get("Moderationsnotiz");
    const categoryRequest = get("Kategorienwunsch");
    issue("Fragetext", checkText(text, 300, true));
    issue("Quelle oder Bemerkung", checkText(source, 1000));
    issue("Moderationsnotiz", checkText(notes, 1000));
    issue("Kategorienwunsch", checkText(categoryRequest, 500));
    const categories = get("Kategorien").split("\n").map(normalizeCategoryName).filter(Boolean);
    for (const category of categories) issue("Kategorien", checkText(category, CATEGORY_NAME_MAX_LENGTH, true));
    const uniqueCategories = [...new Map(categories.map(name => [normalizeCategoryComparisonKey(name, "de-DE"), name])).values()];
    const outdatedFrom = get("Veraltet ab");
    const reviewFrom = get("Prüfen ab");
    if (outdatedFrom && (!isDateInput(outdatedFrom) || outdatedFrom <= "0001-01-01")) issue("Veraltet ab", "Bitte ein gültiges Datum im Format JJJJ-MM-TT eingeben.");
    if (reviewFrom && (!isDateInput(reviewFrom) || reviewFrom < "0001-01-01")) issue("Prüfen ab", "Bitte ein gültiges Datum im Format JJJJ-MM-TT eingeben.");
    if (outdatedFrom && reviewFrom) issue("Prüfen ab", "Bitte nur eines der beiden Aktualitätsdaten angeben.");
    if (!source) warnings.push({ sheet: "Fragen", row: row.number, field: "Quelle oder Bemerkung", message: "Keine Quelle angegeben." });
    if (!categories.length) warnings.push({ sheet: "Fragen", row: row.number, field: "Kategorien", message: "Keine Kategorie angegeben." });
    questions.set(key.toUpperCase(), { row: row.number, key, type, text, source, notes, categoryRequest,
      categories: uniqueCategories, outdatedFrom, reviewFrom, answers: [], pairs: [] });
  }
  if (!questionTable.rows.length) report("Fragen", 2, "Fragetext", "Die Datei enthält keine Fragen.");

  for (const sheet of ["Antworten", "Paare"] as const) {
    const table = tables.get(sheet)!;
    for (const row of table.rows) {
      const get = readRow(sheet, table, row, errors);
      const issue = (field: string, message?: string) => report(sheet, row.number, field, message);
      const key = get("Fragekürzel");
      const question = questions.get(key.toUpperCase());
      if (!question) {
        issue("Fragekürzel", key ? `Das Fragekürzel „${key.slice(0, 40)}“ steht nicht im Blatt Fragen.` : "Bitte das Fragekürzel eintragen.");
        continue;
      }
      if ((sheet === "Paare") !== (question.type === "Paare bilden")) {
        issue("Fragekürzel", `Für „${question.type}“ gehören die Einträge ins Blatt ${question.type === "Paare bilden" ? "Paare" : "Antworten"}.`);
        continue;
      }
      if (sheet === "Paare") {
        const left = get("Links");
        const right = get("Rechts");
        issue("Links", checkText(left, PAIR_TEXT_MAX, true, true));
        issue("Rechts", checkText(right, PAIR_TEXT_MAX, true, true));
        for (const [field, term, side] of [["Links", left, "left"], ["Rechts", right, "right"]] as const) {
          const normalized = normalizePairTerm(term);
          const prior = normalized && question.pairs.find(pair => normalizePairTerm(pair[side]) === normalized);
          if (prior) issue(field, `Dieser Begriff steht auf derselben Seite bereits in Zeile ${prior.row}.`);
        }
        question.pairs.push({ row: row.number, left, right });
      } else {
        const text = get("Antworttext");
        const info = get("Zusatzinformation");
        const mark = get("Richtig");
        issue("Antworttext", checkText(text, 200, true, true));
        issue("Zusatzinformation", checkText(info, 500));
        if (question.type === "Offen" ? mark !== "Ja" && mark !== "" : mark !== "Ja" && mark !== "Nein") {
          issue("Richtig", question.type === "Offen" ? "Bei einer offenen Frage gilt jede Antwort als richtig. Bitte Ja eintragen oder leer lassen." : "Bitte Ja oder Nein eintragen.");
        }
        const normalized = normalizeExactOpenAnswer(text);
        const prior = normalized && question.answers.find(answer => normalizeExactOpenAnswer(answer.text) === normalized);
        if (prior) issue("Antworttext", `Dieser Antworttext steht bereits in Zeile ${prior.row}.`);
        question.answers.push({ row: row.number, text, info, correct: question.type === "Offen" || mark === "Ja" });
      }
    }
  }

  const exact = new Map<string, ImportQuestion>();
  for (const question of questions.values()) {
    const { row, type, answers, pairs } = question;
    if (type === "Paare bilden" && (pairs.length < 2 || pairs.length > PAIRS_MAX)) {
      report("Fragen", row, "Fragekürzel", `Bitte im Blatt Paare 2 bis ${PAIRS_MAX} vollständige Paare eintragen.`);
    } else if (type === "Offen" && !answers.length) {
      report("Fragen", row, "Fragekürzel", "Bitte im Blatt Antworten mindestens eine akzeptierte Lösung eintragen.");
    } else if (type === "Geschlossen") {
      const correct = answers.filter(answer => answer.correct);
      if (correct.length > 1) {
        for (const answer of correct.slice(1)) report("Antworten", answer.row, "Richtig", `Einfachauswahl erlaubt genau eine richtige Option. Zeile ${correct[0].row} ist bereits richtig markiert.`);
      } else if (correct.length !== 1 || answers.length < 2) {
        report("Fragen", row, "Auswahlmodus", "Bitte im Blatt Antworten genau eine richtige und mindestens eine falsche Option eintragen.");
      }
      if (answers.length > 6) warnings.push({ sheet: "Fragen", row, field: "Auswahlmodus", message: "Mehr als sechs Optionen. Bitte später die Präsentationsvorschau prüfen." });
    }
    if (!question.text) continue;
    const key = contentFingerprint(question);
    const prior = exact.get(key);
    if (prior) report("Fragen", row, "Fragetext", `Inhalt identisch mit Zeile ${prior.row} (${prior.key}).`);
    else exact.set(key, question);
  }
  return { questions: [...questions.values()], errors, warnings };
}

export function contentFingerprint(question: Pick<ImportQuestion, "type" | "text" | "pairs" | "answers">) {
  const details = question.type === "Paare bilden"
    ? question.pairs.map(pair => JSON.stringify([normalizePairTerm(pair.left), normalizePairTerm(pair.right)]))
    : question.answers.map(answer => JSON.stringify([normalizeExactOpenAnswer(answer.text), answer.correct]));
  return createHash("sha256").update(JSON.stringify([
    question.type, normalizeExactOpenAnswer(question.text), [...new Set(details)].sort(),
  ])).digest("hex");
}
