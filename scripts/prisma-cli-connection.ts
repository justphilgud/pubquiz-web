/** Preserve the validated Preview database identity, avoiding pooled session locks. */
export function resolvePrismaCliConnection(databaseUrl: string, deploymentEnvironment?: string) {
  if (deploymentEnvironment !== "preview") return databaseUrl;
  const url = new URL(databaseUrl);
  if (/^ep-[a-z0-9-]+-pooler\.[a-z0-9.-]+\.neon\.tech$/.test(url.hostname)) {
    url.hostname = url.hostname.replace("-pooler.", ".");
    return url.toString();
  }
  return databaseUrl;
}
