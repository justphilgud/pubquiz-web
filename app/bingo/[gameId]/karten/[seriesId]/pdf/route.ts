import { requireActor } from "@/app/lib/permissions";
import { BingoPreparationError } from "../../../../preparation/policy";
import { readExport } from "../../../../preparation/repository.server";
import { createCardsPdf } from "../../../../preparation/pdf.server";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ gameId: string; seriesId: string }> }) {
  const { actor } = await requireActor(), { gameId, seriesId } = await params;
  const q = new URL(request.url).searchParams;
  try {
    if ([...q.keys()].some(k => k !== "from" && k !== "to") || q.getAll("from").length !== 1 || q.getAll("to").length !== 1 || !/^[1-9]\d{0,2}$/.test(q.get("from") ?? "") || !/^[1-9]\d{0,2}$/.test(q.get("to") ?? "")) throw new BingoPreparationError("Bitte einen gültigen PDF-Bereich wählen.");
    const data = await readExport(actor.userId, gameId, seriesId, Number(q.get("from")), Number(q.get("to")));
    const bytes = await createCardsPdf(data.snapshot, data.cards);
    return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${data.code}-${q.get("from")}-${q.get("to")}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    return new Response(error instanceof BingoPreparationError ? error.message : "Das PDF konnte nicht erstellt werden. Es wurden keine Karten erzeugt oder verändert.", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" } });
  }
}
