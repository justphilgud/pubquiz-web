import { requireActor } from "@/app/lib/permissions";
import { BingoPreparationError } from "../../../../preparation/policy";
import { readExport } from "../../../../preparation/readExport.server";
import { createCardsPdf } from "../../../../preparation/pdf.server";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ gameId: string; seriesId: string }> }) {
  const { actor } = await requireActor(), { gameId, seriesId } = await params;
  const q = new URL(request.url).searchParams;
  try {
    if ([...q.keys()].some(k => !['from','to','mode','version'].includes(k)) || q.getAll("from").length !== 1 || q.getAll("to").length !== 1 || q.getAll('version').length>1 || q.getAll('mode').length>1 || !/^[1-9]\d{0,2}$/.test(q.get("from") ?? "") || !/^[1-9]\d{0,2}$/.test(q.get("to") ?? "") || (q.has('version')&&!/^[1-9]\d{0,8}$/.test(q.get('version')!)) || (q.has('mode')&&!['front','duplex'].includes(q.get('mode')!))) throw new BingoPreparationError("Bitte einen gültigen PDF-Bereich und Druckmodus wählen.");
    const data = await readExport(actor.userId, gameId, seriesId, Number(q.get("from")), Number(q.get("to")),Number(q.get('version')??1));
    const bytes = await createCardsPdf(data.snapshot, data.cards,q.get('mode')==='duplex'?'duplex':'front');
    return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${data.code}-${q.get("from")}-${q.get("to")}-v${data.version}-${q.get('mode')??'front'}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    return new Response(error instanceof BingoPreparationError ? error.message : "Das PDF konnte nicht erstellt werden. Es wurden keine Karten erzeugt oder verändert.", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" } });
  }
}
