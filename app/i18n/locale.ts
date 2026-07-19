export const supportedLocales = ["de", "en"] as const;

export type AppLocale = (typeof supportedLocales)[number];

export const defaultLocale: AppLocale = "de";

export function resolveLocale(locale: string | null | undefined): AppLocale {
  return supportedLocales.includes(locale as AppLocale)
    ? (locale as AppLocale)
    : defaultLocale;
}

export function getDefaultLocale(): AppLocale {
  return defaultLocale;
}
