import Link from 'next/link';
import {notFound} from 'next/navigation';
import AppHeader from '@/app/components/AppHeader';
import {requireActor} from '@/app/lib/permissions';
import {DesignError,type DesignTarget} from '@/app/rendering/sharedDesign/sharedDesignRepository.server';
import {BingoPreparationError} from './policy';
import {readPrintDesign} from './printDesignRepository.server';
import PrintDesignPanel from './PrintDesignPanel';
export default async function PrintDesignPage({target}:{target:DesignTarget}){const {actor}=await requireActor();const data=await readPrintDesign(actor.userId,target).catch(e=>{if(e instanceof DesignError||e instanceof BingoPreparationError)notFound();throw e;});const href=target.kind==='SERIES'?`/admin/eventreihen/${target.id}/design`:`/bingo/${target.id}/design`;return <>{target.kind!=='SERIES'&&<AppHeader/>}<main className="mx-auto max-w-5xl space-y-5 px-4 py-8"><Link href={href} className="underline">Zum gemeinsamen Design</Link><h1>Bingo-Druckgestaltung</h1><p className="text-sm">Gestaltungsvorschau mit Beispieldaten. Bestehende Karten erhalten nur durch eine ausdrücklich bestätigte neue Druckversion eine andere Gestaltung.</p><PrintDesignPanel key={data.stateHash} data={data} returnHref={href}/></main></>;}
