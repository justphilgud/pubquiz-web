import { after } from "next/server";
import { processMemeArchive } from "./archive.server";

/** after is an accelerator, not the queue: confirmed work is persisted by the DB trigger. */
export function scheduleMemeArchive(quizId: number) {
  after(async () => {
    try { await processMemeArchive(quizId); }
    catch { console.error("Meme-Archiv: Verarbeitung ausstehend; Wiederholung im Archiv verfügbar."); }
  });
}
