"use server";
import { requireActor } from "@/app/lib/permissions";
import { savePrintDesign, previewPrintDesign, redesignSeries } from "./printDesignRepository.server";
import { createCardsPdf } from "./pdf.server";
import { BingoPreparationError, type StoredCard } from "./policy";
import { DesignError } from "@/app/rendering/sharedDesign/sharedDesignRepository.server";
const failure=(e:unknown)=>({success:false as const,message:e instanceof BingoPreparationError||e instanceof DesignError?e.message:'Druckgestaltung konnte nicht verarbeitet werden. Bitte Angaben und Berechtigung prüfen.'});
export async function saveBingoPrint(input:unknown){const {actor}=await requireActor();try{return await savePrintDesign(actor.userId,input);}catch(e){return failure(e);}}
export async function getBingoPrintPreview(input:unknown){const {actor}=await requireActor();try{const data=await previewPrintDesign(actor.userId,input);const sample:StoredCard=data.card??{id:'synthetic-print-preview',code:'SYNTHETIC',shortCode:'A-001',ordinal:1,cells:[[1,16,31,46,61],[2,17,32,47,62],[3,18,null,48,63],[4,19,34,49,64],[5,20,35,50,65]]};const front=await createCardsPdf(data.snapshot,[sample],'front'),back=await createCardsPdf(data.snapshot,[sample],'back');return {success:true as const,hash:data.hash,front:Buffer.from(front).toString('base64'),back:Buffer.from(back).toString('base64')};}catch(e){return failure(e);}}
export async function confirmBingoRedesign(input:unknown){const {actor}=await requireActor();try{return await redesignSeries(actor.userId,input);}catch(e){return failure(e);}}
