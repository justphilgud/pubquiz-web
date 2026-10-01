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

function isGovernmentHostname(hostname: string) {
  return (
    hostname.endsWith(".gov") ||
    /\.(gov|gob|gouv|go)\.[a-z]{2,3}$/.test(hostname) ||
    hostname.endsWith(".gc.ca")
  );
}

function isAcademicHostname(hostname: string) {
  return (
    hostname.endsWith(".edu") ||
    /\.(edu|ac)\.[a-z]{2,3}$/.test(hostname)
  );
}

/**
 * Deliberately narrow, machine-verifiable primary/official source class.
 * Commercial and community sites are not inferred to be official merely from
 * their domain name; those still need two independent reliable organizations.
 */
export function isStrongPrimaryOrOfficialSource(urlValue: string) {
  const hostname = new URL(urlValue).hostname.toLowerCase().replace(/^www\./, "");
  return (
    isGovernmentHostname(hostname) ||
    isAcademicHostname(hostname) ||
    hostname.endsWith(".int") ||
    hostname === "europa.eu" ||
    hostname.endsWith(".europa.eu")
  );
}

export function hasStrongPrimaryOrOfficialSource(
  sources: readonly Readonly<{ url: string }>[],
) {
  return sources.some((source) => isStrongPrimaryOrOfficialSource(source.url));
}

export function countIndependentReliableSourceHosts(
  sources: readonly Readonly<{ url: string }>[],
) {
  return new Set(sources.map((source) => sourceOrganization(source.url))).size;
}
