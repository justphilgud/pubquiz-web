import {notFound} from 'next/navigation';
import AppHeader from '@/app/components/AppHeader';
import {requireActor} from '@/app/lib/permissions';
import MatchingEditor from '../../matching/MatchingEditor';
import {readContentMatching} from '../repository.server';
export default async function Page({params}:{params:Promise<{templateId:string}>}) {
  const {actor}=await requireActor(),{templateId}=await params;
  const data=await readContentMatching(actor.userId,templateId).catch(()=>notFound());
  return <><AppHeader/><main className="mx-auto max-w-7xl px-4 py-8"><h1>Bingo-Content · {data.title}</h1><p>Änderungen betreffen ausschließlich die Rundenvorlage. Bereits eingefügte Runden und Karten bleiben unverändert.</p><MatchingEditor data={data}/></main></>;
}
