import {parseGameFields,GameDraftError} from "@/app/games/gameDraft";
import {assertUuid} from "./live/live";
import {cardQuantity} from './preparation/cardSet';
import {MAX_BINGO_ROUNDS} from "./roundColors";
/** Product limit for newly prepared Bingo evenings. */
export const INITIAL_ROUND_BATCH=MAX_BINGO_ROUNDS;
export function parseBingoCreation(value:unknown){
 if(!value||typeof value!=="object"||Array.isArray(value))throw new GameDraftError("Ungültige Eventanlage.");
 const {requestId,roundCount,defaultCardCount,...fields}=value as Record<string,unknown>;assertUuid(requestId);
 if(!Number.isSafeInteger(roundCount)||Number(roundCount)<1||Number(roundCount)>INITIAL_ROUND_BATCH)throw new GameDraftError(`Bitte 1 bis ${INITIAL_ROUND_BATCH} Runden pro Bingoabend wählen.`);
 const parsed=parseGameFields(fields);if(parsed.id)throw new GameDraftError("Eine Eventanlage darf kein vorhandenes Spiel überschreiben.");
 return {...parsed,requestId,roundCount:Number(roundCount),...(defaultCardCount===undefined?{}:{defaultCardCount:cardQuantity(defaultCardCount)})};
}
