import 'server-only';
import {notFound} from 'next/navigation';
import {requireActor,canManageEverything} from '@/app/lib/permissions';
export async function requirePrintTemplateReader(){
 const {actor}=await requireActor(),admin=canManageEverything(actor);
 if(!admin&&!actor.eventTypeAssignments?.some(a=>a.eventType==='BINGO'&&a.role==='EVENT_MANAGER'&&a.enabled))notFound();
 return {actor,admin};
}
