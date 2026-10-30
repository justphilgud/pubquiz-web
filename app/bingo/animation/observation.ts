/** Visual observation only. No commands, clocks, persistence or gameplay mutations. */
export type DrawObservation = Readonly<{ id: string; revision: number; startedAt: number; status: string; phase?: string;
  draws: readonly Readonly<{id:string;position:number;number:number}>[] }>;
export type Observation = Readonly<{view:DrawObservation; connected:boolean}>;
/** Only an observed, uninterrupted append is new. Everything else establishes a quiet baseline. */
export function newlyConfirmedDraw(previous:Observation|undefined,next:Observation){
 if(!previous||!previous.connected||!next.connected)return null;
 const a=previous.view,b=next.view;
 if(a.id!==b.id||a.startedAt!==b.startedAt||b.revision<=a.revision||b.status!=="RUNNING"||a.phase||b.phase)return null;
 if(b.draws.length<=a.draws.length)return null;
 if(!a.draws.every((d,i)=>{const n=b.draws[i];return n&&d.id===n.id&&d.number===n.number&&d.position===n.position;}))return null;
 const fresh=b.draws.slice(a.draws.length);
 if(!fresh.every((d,i)=>Number.isInteger(d.number)&&d.number>=1&&d.number<=75&&d.position===a.draws.length+i+1&&!a.draws.some(old=>old.id===d.id)))return null;
 // Coalesced publications use the latest, never a queue. Corrections retain IDs and cannot qualify.
 return fresh.at(-1)??null;
}
