import {notFound} from 'next/navigation';
import {requireActor} from '@/app/lib/permissions';
import {prisma} from '@/app/lib/prisma';
import {readPreparation} from '@/app/bingo/preparation/readPreparation.server';
import {readCeremony} from '@/app/bingo/ceremonyRepository.server';
import CeremonyEditor from '@/app/bingo/CeremonyEditor';

export default async function Page({params}:{params:Promise<{gameId:string;placement:string}>}){
 const {gameId,placement}=await params;
 if(placement!=='intro'&&placement!=='outro')notFound();
 const {actor}=await requireActor();
 const data=await readPreparation(actor.userId,gameId);
 const state=await readCeremony(prisma,gameId);
 return <CeremonyEditor gameId={gameId} initial={state} placement={placement==='outro'?'outro':undefined} label={`${placement==='intro'?'Intro':'Outro'} · ${data.title}`} readOnly={data.archived}/>;
}
