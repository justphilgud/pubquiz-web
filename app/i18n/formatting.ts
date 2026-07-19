import type { AppLocale } from "./locale";

const browserLocales: Record<AppLocale, string> = { de: "de-DE", en: "en-US" };

export function formatEditorDateTime(locale: AppLocale, value: string): string {
  return new Intl.DateTimeFormat(browserLocales[locale], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date(value));
}

export function formatEditorDate(locale: AppLocale, value: string): string {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(browserLocales[locale], {
    dateStyle: "medium",
    timeZone: "Europe/Berlin",
  }).format(date);
}

export function formatEditorNumber(locale: AppLocale, value: number): string {
  return new Intl.NumberFormat(browserLocales[locale]).format(value);
}

export function normalizeEditorSearch(locale: AppLocale, value: string): string {
  return value.trim().toLocaleLowerCase(browserLocales[locale]);
}
