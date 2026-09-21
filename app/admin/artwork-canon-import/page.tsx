import { requireAdmin } from "@/app/lib/permissions";
import { getLogicalEnvironment } from "@/config/environment";
import ArtworkCanonImportClient from "./ArtworkCanonImportClient";

export default async function ArtworkCanonImportPage() {
  await requireAdmin();
  if (process.env.VERCEL_ENV !== "preview" || getLogicalEnvironment() !== "preview") {
    return <main className="p-6"><h1 className="text-2xl font-semibold">Nicht verfügbar</h1><p>Der Kunstwerk-Kanon-Import ist ausschließlich in Vercel Preview verfügbar.</p></main>;
  }
  return <ArtworkCanonImportClient />;
}
