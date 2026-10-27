import { defaultBingoPrint, parseBingoPrint, type BingoPrint } from "@/app/bingo/preparation/bingoPrint";
import type { SharedDesign } from "@/app/rendering/sharedDesign/sharedDesign";
import { BingoPreparationError } from "./policy";
export function resolveBingoPrint(design:SharedDesign,series:unknown,game?:unknown):BingoPrint{
  const value=game??series;if(value===null||value===undefined)return defaultBingoPrint(design);
  const parsed=parseBingoPrint(value);if(!parsed)throw new BingoPreparationError('Die gespeicherten Bingo-Druckeinstellungen sind ungültig.');return parsed;
}
