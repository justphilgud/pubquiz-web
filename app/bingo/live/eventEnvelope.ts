import {parseEventCommand,type EventCommand} from "./eventRun";
import {parseRoundSnapshot} from "./roundSnapshot";
import type {FrozenRound} from "./live";
export type Envelope={version:2;input:{revision:number;command:EventCommand};opened:FrozenRound|null};
const integer=(v:unknown)=>{if(!Number.isSafeInteger(v)||Number(v)<0)throw Error("INVALID_REVISION");};
export function parseEventEnvelope(value:unknown):Envelope {
 if(!value||typeof value!=="object"||Array.isArray(value))throw Error("INVALID_EVENT_HISTORY");
 const r=value as Envelope;if(Object.keys(r).sort().join()!=="input,opened,version"||r.version!==2||!r.input||Object.keys(r.input).sort().join()!=="command,revision")throw Error("INVALID_EVENT_HISTORY");
 integer(r.input.revision);const command=parseEventCommand(r.input.command);
 if(command.kind==="startRound"){const opened=parseRoundSnapshot(r.opened,command.roundId);return {version:2,input:{revision:r.input.revision,command},opened};}
 if(r.opened!==null)throw Error("INVALID_EVENT_HISTORY");return {version:2,input:{revision:r.input.revision,command},opened:null};
}
