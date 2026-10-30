import AppHeader from "@/app/components/AppHeader";
import {requireActor} from "@/app/lib/permissions";
import {readEventCollection} from "./readEvents.server";
import {EventCollection} from "./EventCollection";
export default async function EventsPage(){const {actor}=await requireActor();const data=await readEventCollection(actor.userId);return <><AppHeader/><main className="mx-auto max-w-6xl space-y-5 px-4 py-8"><h1>Alle Events</h1><EventCollection {...data}/></main></>}
