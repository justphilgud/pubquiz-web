"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { requireEventSeriesEditor } from "./eventSeriesAccess.server";
import { verifyEventSeriesLogo } from "./eventSeriesLogoValidation.server";

export async function saveEventSeriesLogo(id: number, url: string | null, expectedUrl: string | null) {
  if ((url !== null && (typeof url !== "string" || url.length > 2048)) ||
    (expectedUrl !== null && typeof expectedUrl !== "string")) {
    return { ok: false, message: "Ungültige Logoangaben." };
  }
  const access = await requireEventSeriesEditor(id);
  if (access.eventSeries.ist_archiviert) return { ok: false, message: "Archivierte Eventreihe ist nicht bearbeitbar." };
  try {
    if (url !== null) await verifyEventSeriesLogo(url, id);
    const result = await prisma.eventreihen.updateMany({
      where: { eventreihe_id: id, ist_archiviert: false, logo_url: expectedUrl },
      data: { logo_url: url },
    });
    if (result.count !== 1) return { ok: false, message: "Das Logo wurde inzwischen geändert. Bitte Seite neu laden." };
    revalidatePath(`/admin/eventreihen/${id}`);
    revalidatePath("/admin/eventreihen");
    return { ok: true, message: url ? "Logo gespeichert." : "Logo entfernt." };
  } catch {
    return { ok: false, message: "Logo konnte nicht gespeichert werden. Bitte Dateityp, Größe und Upload prüfen." };
  }
}
