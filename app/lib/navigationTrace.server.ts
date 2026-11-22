import { headers } from "next/headers";
import { startNavigationTrace } from "./navigationTrace";

export async function startRequestNavigationTrace(stage: "navigation" | "status-poll" | "snapshot-poll" | "snapshot-http") {
  if (process.env.VERCEL_ENV !== "preview") return startNavigationTrace(stage, null);
  return startNavigationTrace(stage, (await headers()).get("x-qa-correlation"));
}
