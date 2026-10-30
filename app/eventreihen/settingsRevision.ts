/** Includes product state, whose legacy single-toggle writer does not bump updated_at. */
export function eventSeriesSettingsRevision(updatedAt:Date|string, products:readonly {eventart:string;ist_freigeschaltet:boolean}[], logo:string|null) {
 return JSON.stringify([new Date(updatedAt).toISOString(),logo,[...products].sort((a,b)=>a.eventart.localeCompare(b.eventart)).map(p=>[p.eventart,p.ist_freigeschaltet])]);
}
