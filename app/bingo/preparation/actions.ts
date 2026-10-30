"use server";
import { requireActor } from "@/app/lib/permissions";
import { revalidatePath } from "next/cache";
import { writePreparation } from "./repository.server";
import { BingoPreparationError } from "./policy";

export async function savePreparation(input: unknown): Promise<{ success: true; seriesId?: string } | { success: false; message: string; field?: string }> {
  const { actor } = await requireActor();
  try {
    const result = await writePreparation(actor.userId, input);
    const id = (input as { gameId: string }).gameId;
    revalidatePath(`/bingo/${id}/vorbereitung`);
    revalidatePath(`/bingo/${id}`);
    revalidatePath(`/bingo/${id}/moderation`);
    revalidatePath(`/bingo/${id}/karten`);
    return { success: true, ...result };
  } catch (error) {
    if (error instanceof BingoPreparationError) return { success: false, message: error.message, field: error.field };
    console.error("bingo_preparation_failed", { kind: error instanceof Error ? error.name : "unknown" });
    return { success: false, message: "Die Änderung konnte nicht gespeichert werden. Deine Eingaben bleiben erhalten. Bitte erneut versuchen." };
  }
}
