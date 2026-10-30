import {parseGameFields,GameDraftError} from "@/app/games/gameDraft";
import {assertUuid} from "./live/live";
/** Transaction resource budget, not a maximum number of rounds in an event. */
export const INITIAL_ROUND_BATCH=10000;
export function parseBingoCreation(value:unknown){
 if(!value||typeof value!=="object"||Array.isArray(value))throw new GameDraftError("Ungültige Eventanlage.");
 const {requestId,roundCount,...fields}=value as Record<string,unknown>;assertUuid(requestId);
 if(!Number.isSafeInteger(roundCount)||Number(roundCount)<1||Number(roundCount)>INITIAL_ROUND_BATCH)throw new GameDraftError(`Bitte 1 bis ${INITIAL_ROUND_BATCH} Runden pro Anlage wählen. Weitere Runden können später ergänzt werden.`);
 const parsed=parseGameFields(fields);if(parsed.id)throw new GameDraftError("Eine Eventanlage darf kein vorhandenes Spiel überschreiben.");
 return {...parsed,requestId,roundCount:Number(roundCount)};
}
