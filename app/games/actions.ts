"use server";
import { revalidatePath } from "next/cache";
import { requireActor } from "@/app/lib/permissions";
import { GameDraftError, gameTypeInfo, isGameType, type GameDraftView } from "./gameDraft";
import { writeGameDraft } from "./gameDraftRepository.server";
export async function saveGameDraft(type: unknown, input: unknown): Promise<{ success: true; game: GameDraftView } | { success: false; message: string }> {
  const { actor } = await requireActor();
  if (!isGameType(type)) return { success: false, message: "Ungültige Eventart." };
  try {
    const game = await writeGameDraft(actor.userId, type, input);
    const path = gameTypeInfo[type].path;
    revalidatePath(path); revalidatePath(`${path}/${game.id}`);
    revalidatePath(`/workspaces/${game.seriesId}/${path.slice(1)}`);
    return { success: true, game };
  } catch (error) {
    if (error instanceof GameDraftError) return { success: false, message: error.message };
    console.error("game_draft_save_failed", { kind: error instanceof Error ? error.name : "unknown" });
    return { success: false, message: "Das Spiel konnte nicht gespeichert werden. Deine Eingaben bleiben erhalten. Bitte erneut versuchen." };
  }
}

export async function createBingoDraft(input:unknown){
 const {actor}=await requireActor();
 try{const {createBingoEvent}=await import("@/app/bingo/eventCreation.server");const game=await createBingoEvent(actor.userId,input);revalidatePath("/bingo");revalidatePath("/events");return {success:true as const,game};}
 catch(error){return {success:false as const,retryable:!(error instanceof GameDraftError),message:error instanceof GameDraftError?error.message:"Speicherergebnis unbestätigt. Bitte dieselbe Anfrage wiederholen; Eingaben bleiben bis zur Klärung gesperrt."};}
}
