import { isAdministrator, type AuthorizationActor } from "@/app/roles/roleAssignmentPolicy";
import { fixture, isScenario } from "./fixtures";
import type { Snapshot } from "./model";

type Dependencies = {
  actor: () => Promise<AuthorizationActor | null>;
  read: () => Promise<Snapshot>;
  preview: () => boolean;
};
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function monitoringResponse(request: Request, deps: Dependencies): Promise<Response> {
  try {
    const actor = await deps.actor();
    if (!actor) return Response.json({ error: "UNAUTHORIZED" }, { status: 401, headers });
    if (!isAdministrator(actor)) return Response.json({ error: "FORBIDDEN" }, { status: 403, headers });
    const scenario = new URL(request.url).searchParams.get("scenario");
    if (scenario !== null) {
      if (!deps.preview() || !isScenario(scenario)) return Response.json({ error: "SCENARIO_NOT_AVAILABLE" }, { status: 400, headers });
      return Response.json(fixture(scenario), { headers });
    }
    return Response.json(await deps.read(), { headers });
  } catch {
    return Response.json({ error: "MONITORING_UNAVAILABLE" }, { status: 503, headers });
  }
}
