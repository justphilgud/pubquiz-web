"use server";
import { requireActor } from "@/app/lib/permissions";
import { startLive, commandLive } from "./repository.server";
import type { LiveCommand } from "./live";

const messages: Record<string, string> = {
  INVALID_NUMBER: "Bitte eine ganze Zahl von 1 bis 75 eingeben.",
  DUPLICATE_DRAW_NUMBER: "Diese Zahl wurde bereits veröffentlicht.",
  REVISION_CONFLICT: "Ein anderes Fenster hat den Stand geändert. Bitte aktuellen Stand laden; deine Eingaben bleiben erhalten.",
  REQUEST_REUSED: "Diese Anfrage wurde bereits mit anderen Angaben verwendet.",
  ACTIVE_RUN_EXISTS: "Es gibt bereits einen laufenden oder pausierten Durchlauf.",
  PREPARATION_CHANGED: "Die Vorbereitung wurde geändert. Bitte neu laden.",
  NO_ASSIGNED_CARDS: "Bitte zuerst vorhandene Kartenserien ausdrücklich dieser Runde zuordnen.",
  RUN_ENDED: "Dieser Durchlauf ist beendet und kann nicht verändert werden.",
  RUN_NOT_RUNNING: "Zahlen und neue Rufe sind nur bei laufendem Spiel möglich.",
  CLAIM_NOT_COVERED: "Die gerufene Gewinnstufe war zum Rufzeitpunkt nicht erfüllt.",
  CARD_OR_CALL_NOT_FOUND: "Karte oder Ruf nicht gefunden. Nur zugeordnete Karten dieses Durchlaufs sind erlaubt.",
  TARGET_BELOW_DRAW_COUNT: "Das Ziel darf nicht unter der Zahl veröffentlichter Ziehungen liegen.",
  REASON_REQUIRED: "Bitte eine Begründung mit 1 bis 1000 Zeichen eingeben.",
};
export async function saveLive(input:
  | { operation: "start"; gameId: string; roundId: string; requestId: string; expectedSeriesId: number; preparationRevision: number }
  | { operation: "command"; gameId: string; runId: string; requestId: string; revision: number; command: LiveCommand }) {
  const { actor } = await requireActor();
  try {
    if (input.operation === "start") return { success: true as const, ...await startLive(actor.userId, input) };
    if (input.operation !== "command") throw Error("INVALID_COMMAND");
    return { success: true as const, ...await commandLive(actor.userId, input) };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return { success: false as const, message: messages[code] ?? "Nicht gespeichert. Bitte Rechte, Produktfreischaltung und aktuellen Stand prüfen. Deine Eingaben bleiben erhalten." };
  }
}
