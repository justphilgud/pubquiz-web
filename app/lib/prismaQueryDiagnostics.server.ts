import { AsyncLocalStorage } from "node:async_hooks";

type PrismaQueryDiagnosticContext = {
  queryCount: number;
  queryDurationMs: number;
};

export type PrismaQueryDiagnostics = Readonly<PrismaQueryDiagnosticContext>;

const diagnosticsStorage = new AsyncLocalStorage<PrismaQueryDiagnosticContext>();

export function livePerformanceDiagnosticsEnabled() {
  return process.env.VERCEL_ENV === "preview" ||
    process.env.NODE_ENV !== "production";
}

export function recordPrismaQueryDuration(durationMs: number) {
  const context = diagnosticsStorage.getStore();
  if (!context) return;
  context.queryCount += 1;
  context.queryDurationMs += durationMs;
}

export async function withPrismaQueryDiagnostics<T>(
  operation: () => Promise<T>,
): Promise<{ result: T; diagnostics: PrismaQueryDiagnostics | null }> {
  if (!livePerformanceDiagnosticsEnabled()) {
    return { result: await operation(), diagnostics: null };
  }

  const parent = diagnosticsStorage.getStore();
  if (parent) {
    const countBefore = parent.queryCount;
    const durationBefore = parent.queryDurationMs;
    const result = await operation();
    return {
      result,
      diagnostics: {
        queryCount: parent.queryCount - countBefore,
        queryDurationMs: parent.queryDurationMs - durationBefore,
      },
    };
  }

  const context: PrismaQueryDiagnosticContext = {
    queryCount: 0,
    queryDurationMs: 0,
  };
  const result = await diagnosticsStorage.run(context, operation);
  return { result, diagnostics: { ...context } };
}

export function logLivePerformance(
  operation: string,
  details: Record<string, unknown>,
) {
  if (!livePerformanceDiagnosticsEnabled()) return;
  console.info(`live-performance ${JSON.stringify({ operation, ...details })}`);
}
