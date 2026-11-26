import AppHeader from '@/app/components/AppHeader';
import {requireActor} from '@/app/lib/permissions';
import {readRoundContent} from './repository.server';
import ContentLibrary from './ContentLibrary';
import Link from 'next/link';
export default async function Page() {
  const {actor}=await requireActor(),data=await readRoundContent(actor.userId);
  return <><AppHeader/><main className="mx-auto max-w-6xl space-y-5 px-4 py-8"><h1>Bingo · Content</h1><Link href="/bingo">Zu den Bingos</Link><ContentLibrary data={data}/></main></>;
}
