// Read deployment metadata only. Never use main HEAD as a proxy for Production.
export async function deployedProductionCommit(request: (path: string) => Promise<unknown>): Promise<string> {
  const deployments = await request("/deployments?environment=production&per_page=1") as Array<{ id?: number; sha?: string; environment?: string }>;
  const latest = Array.isArray(deployments) ? deployments[0] : undefined;
  if (!latest || latest.environment !== "production" || !Number.isSafeInteger(latest.id) || !/^[a-f0-9]{40}$/.test(latest.sha ?? "")) throw new Error("PRODUCTION_DEPLOYMENT_UNVERIFIED");
  const statuses = await request(`/deployments/${latest.id}/statuses?per_page=1`) as Array<{ state?: string }>;
  if (!Array.isArray(statuses) || statuses[0]?.state !== "success") throw new Error("PRODUCTION_DEPLOYMENT_NOT_SUCCESSFUL");
  return latest.sha!;
}
