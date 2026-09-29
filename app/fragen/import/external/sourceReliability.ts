const MULTI_LABEL_PUBLIC_SUFFIXES = new Set([
  "ac.uk",
  "co.jp",
  "co.nz",
  "co.uk",
  "com.au",
  "com.br",
  "com.mx",
  "gov.uk",
  "org.uk",
]);

function sourceOrganization(urlValue: string) {
  const labels = new URL(urlValue).hostname.toLowerCase().replace(/^www\./, "").split(".");
  if (labels.length < 2) return labels[0] ?? "";
  const suffix = labels.slice(-2).join(".");
  return MULTI_LABEL_PUBLIC_SUFFIXES.has(suffix) && labels.length >= 3
    ? labels.at(-3) ?? ""
    : labels.at(-2) ?? "";
}

export function countIndependentReliableSourceHosts(
  sources: readonly Readonly<{ url: string }>[],
) {
  return new Set(sources.map((source) => sourceOrganization(source.url))).size;
}
