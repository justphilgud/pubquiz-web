import Link from "next/link";
import {EVENT_TYPES} from "@/app/roles/eventTypes";
export function EventTypeProducts({eventSeriesId,initialEnabled,canEdit}:{eventSeriesId:number;initialEnabled:string[];canEdit:boolean}) {
 return <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Freigeschaltete Eventarten</h2><p>{EVENT_TYPES.filter(t=>initialEnabled.includes(t.id)).map(t=>t.label).join(", ")||"Keine Eventarten ausgewählt"}</p>{canEdit&&<Link href={`/admin/eventreihen?edit=${eventSeriesId}`} className="inline-flex min-h-11 items-center underline">Reiheneinstellungen bearbeiten</Link>}<p className="text-sm text-slate-600">Freischaltung und Eventanlage sind getrennt. Änderungen werden in den Reiheneinstellungen gespeichert.</p></section>;
}
