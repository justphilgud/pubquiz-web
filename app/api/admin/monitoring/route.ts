import { auth } from "@/auth";
import { getActorForSession } from "@/app/roles/roleAssignments.server";
import { getLogicalEnvironment } from "@/config/environment";
import { monitoringResponse } from "@/app/admin/monitoring/endpoint";
import { getMonitoringSnapshot } from "@/app/admin/monitoring/collector.server";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return monitoringResponse(request, {
    actor: async () => {
      const session = await auth();
      return session?.user ? getActorForSession(session) : null;
    },
    read: getMonitoringSnapshot,
    preview: () => process.env.VERCEL_ENV === "preview" && getLogicalEnvironment() === "preview",
  });
}
