import type { QuestionScopeValue } from "../../editor/questionScopePolicy";

export const headers = {
  Fragen: ["Fragekürzel", "Fragetyp", "Fragetext", "Auswahlmodus", "Kategorien",
    "Quelle oder Bemerkung", "Moderationsnotiz", "Kategorienwunsch", "Veraltet ab", "Prüfen ab"],
  Antworten: ["Fragekürzel", "Antworttext", "Richtig", "Zusatzinformation"],
  Paare: ["Fragekürzel", "Links", "Rechts"],
} as const;

export const maxFileBytes = 768 * 1024;
export const maxQuestions = 250;
export const maxDetailRows = 4000;
export const questionTypes = ["Offen", "Geschlossen", "Paare bilden"] as const;
export type QuestionType = typeof questionTypes[number];

export type ImportTarget = { scope: QuestionScopeValue; eventSeriesIds: number[] };
export type Sheet = keyof typeof headers;
export type Location = { sheet: Sheet | "Datei" | "Zielbereich"; row?: number; field: string };
export type Issue = Location & { message: string };
export type ImportQuestion = {
  row: number;
  key: string;
  type: QuestionType;
  text: string;
  categories: string[];
  source: string;
  notes: string;
  categoryRequest: string;
  outdatedFrom: string;
  reviewFrom: string;
  answers: { row: number; text: string; correct: boolean; info: string }[];
  pairs: { row: number; left: string; right: string }[];
};
export type PreviewQuestion = ImportQuestion & { resolvedCategories: string[] };
export type ImportReceipt = { id: number; key: string; text: string }[];
export type PreviewResult = {
  questions: PreviewQuestion[];
  errors: Issue[];
  warnings: Issue[];
  token?: string;
};
export type ConfirmResult =
  | { ok: true; questions: ImportReceipt }
  | { ok: false; errors: Issue[] };

export function parseTarget(value: string): ImportTarget | null {
  if (value === "GLOBAL") return { scope: "GLOBAL", eventSeriesIds: [] };
  const ids = value.split(",");
  if (ids.length > 50 || ids.some(id => !/^[1-9][0-9]{0,9}$/.test(id))) return null;
  const eventSeriesIds = ids.map(Number).sort((a, b) => a - b);
  if (new Set(eventSeriesIds).size !== ids.length || eventSeriesIds.some(id => id > 2147483647)) return null;
  return { scope: "EVENT_SERIES", eventSeriesIds };
}
