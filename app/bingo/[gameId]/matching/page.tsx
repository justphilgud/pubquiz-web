import Link from 'next/link';
import {ArrowLeftIcon} from '@heroicons/react/24/outline';
import styles from '../../matching/MatchingEditor.module.css';
import {notFound} from 'next/navigation';
import AppHeader from '@/app/components/AppHeader';
import {requireActor} from '@/app/lib/permissions';
import {readMatchingEditor} from '../../matching/repository.server';
import MatchingEditor from '../../matching/MatchingEditor';
export default async function Page({params,searchParams}:{params:Promise<{gameId:string}>;searchParams:Promise<{round?:string}>}){
 const {actor}=await requireActor(),{gameId}=await params,{round}=await searchParams;if(!round)notFound();
 const data=await readMatchingEditor(actor.userId,gameId,round).catch(()=>notFound());
 return <><AppHeader/><main className="mx-auto max-w-7xl space-y-5 px-4 py-8"><header className={styles.pageHeader}><Link href={`/bingo/${gameId}/vorbereitung`}><ArrowLeftIcon aria-hidden="true"/>Runden vorbereiten</Link><h1>Matching-Tabelle</h1><p>{data.title} · {data.label}</p></header><MatchingEditor key={`${data.roundId}:${data.revision}`} data={data}/></main></>;
}
