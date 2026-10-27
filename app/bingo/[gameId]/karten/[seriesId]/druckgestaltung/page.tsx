import Link from 'next/link';
import {notFound} from 'next/navigation';
import AppHeader from '@/app/components/AppHeader';
import {requireActor} from '@/app/lib/permissions';
import {readPreparation,readCards} from '../../../../preparation/readPreparation.server';
import {BingoPreparationError} from '../../../../preparation/policy';
import RedesignPanel from '../../../../preparation/RedesignPanel';
export default async function Page({params}:{params:Promise<{gameId:string;seriesId:string}>}){const {actor}=await requireActor(),{gameId,seriesId}=await params;const {prep,cards}=await(async()=>{try{return {prep:await readPreparation(actor.userId,gameId),cards:await readCards(actor.userId,gameId,seriesId)};}catch(e){if(e instanceof BingoPreparationError)notFound();throw e;}})();return <><AppHeader/><main className="mx-auto max-w-5xl space-y-4 px-4 py-8"><Link href={`/bingo/${gameId}/karten?series=${seriesId}`} className="underline">Zur Kartenserie</Link><h1>Bestehende Karten neu gestalten</h1><p>{cards.code} · {cards.total} gespeicherte Karten</p>{prep.archived?<p>Archivierte Reihen können nicht neu gestaltet werden.</p>:<RedesignPanel gameId={gameId} seriesId={seriesId} revision={prep.revision}/>}</main></>;}
