/** Temporary Preview-only timing: no quiz IDs, keys, content, cookies or SQL. */
export const NAVIGATION_TRACE_EXPIRES_AT = Date.parse("2026-11-24T00:00:00Z");
type Stage = "proxy-request" | "proxy-after-auth" | "navigation" | "status-poll" | "snapshot-poll" | "snapshot-http";
const metrics = new Set(["access", "validation", "presentationMutation", "blockMutation", "interactionMutation", "queryCount", "queryDurationMs", "total"]);

export function startNavigationTrace(stage: Stage, rawId: string | null, environment = process.env.VERCEL_ENV,
  now = () => Date.now(), publish: (line: string) => void = console.info): (details?: Record<string, number | null>) => void {
  if (environment !== "preview" || now() >= NAVIGATION_TRACE_EXPIRES_AT || !rawId || !/^[a-f0-9-]{36}(?:-reset)?$/i.test(rawId)) return () => {};
  const startedAt = now();
  publish(`navigation-trace ${JSON.stringify({ correlationId: rawId, stage, event: "start", at: startedAt })}`);
  return (details: Record<string, number | null> = {}) => {
    const at = now();
    const safeMetrics = Object.fromEntries(Object.entries(details).filter(([key, value]) => metrics.has(key) && typeof value === "number" && Number.isFinite(value)));
    publish(`navigation-trace ${JSON.stringify({ correlationId: rawId, stage, event: "end", at, durationMs: at - startedAt, ...safeMetrics })}`);
  };
}
