import { requireAdmin } from "@/app/lib/permissions";
import { getLogicalEnvironment } from "@/config/environment";
import MonitoringDashboard from "./MonitoringDashboard";

export default async function MonitoringPage() {
  await requireAdmin();
  let preview = false;
  try { preview = process.env.VERCEL_ENV === "preview" && getLogicalEnvironment() === "preview"; } catch { /* Dashboard explains invalid environment. */ }
  return <MonitoringDashboard preview={preview} />;
}
