// Operations-only commits must not trigger an application deployment.
export function needsApplicationDeployment(paths: readonly string[]) {
  if (paths.length === 0) return false;
  return paths.some(path => !(
    path.startsWith("scripts/operations/") || path.startsWith("docs/operations/") ||
    path.startsWith("docs/reports/ap9-4") ||
    path === ".github/workflows/ap94-acceptance.yml" || path === ".github/workflows/deploy-production.yml"
  ));
}
