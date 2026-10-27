"use server";
import { requireActor } from "@/app/lib/permissions";
import { DesignError, writeDesign } from "./sharedDesignRepository.server";
export async function saveSharedDesign(input:unknown){
  const {actor}=await requireActor();
  try{return await writeDesign(actor.userId,input);}catch(e){return {success:false as const,message:e instanceof DesignError?e.message:'Design konnte nicht gespeichert werden. Bitte Auswahl und Berechtigung prüfen.'};}
}
