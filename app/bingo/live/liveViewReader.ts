/** One reader per mounted view. Polling and refreshes after commands share its queue.
 * No global cache, no authorization reuse, no overlapping requests.
 */
export function createLiveViewReader<T>(url: string, fetcher: typeof fetch = fetch) {
  let etag: string | null = null, current: T | undefined, queue: Promise<unknown> = Promise.resolve();
  let generation=0,activeController:AbortController|undefined;
  return { cancel(){generation++;etag=null;activeController?.abort();}, read(signal?: AbortSignal): Promise<T> {
    const requestedGeneration=generation;
    const pending=queue.catch(()=>{}).then(async()=>{
      if(signal?.aborted || requestedGeneration!==generation) throw new DOMException("Aborted","AbortError");
      const controller=new AbortController(),abort=()=>controller.abort(),deadline=setTimeout(abort,8000);
      activeController=controller;
      signal?.addEventListener("abort",abort,{once:true});
      try {
        const response=await fetcher(url,{cache:"no-store",signal:controller.signal,headers:etag ? {"If-None-Match":etag} : {}});
        if(signal?.aborted || controller.signal.aborted || requestedGeneration!==generation) throw new DOMException("Aborted","AbortError");
        if(response.status===304) {
          if(current===undefined) throw Error("MISSING_LIVE_VIEW");
          current=advanceLiveClock(current,Number(response.headers.get("X-Bingo-Server-At")));
        } else {
          if(!response.ok) throw Error("CONNECTION");
          current=await response.json() as T;
        }
        etag=response.headers.get("ETag");
        return current as T;
      } catch(error) { etag=null; throw error; }
      finally { if(activeController===controller)activeController=undefined;clearTimeout(deadline);signal?.removeEventListener("abort",abort); }
    });
    queue=pending;
    return pending;
  }};
}
/** Only display clocks advance, exclusively from database time. Stored rules/revisions stay untouched. */
export function advanceLiveClock<T>(value:T,serverAt:number):T {
  const v=value as {live?:{serverAt:number;elapsedMs:number;roundElapsedMs?:number;between?:boolean;round?:{id:string};state:{run:{status:string}};summary?:{id:string;activeMs:number}[]}};
  const live=v?.live;
  if(!live || !Number.isSafeInteger(serverAt) || serverAt<live.serverAt) return value;
  const delta=live.state.run.status==="RUNNING" ? serverAt-live.serverAt : 0;
  return {...value,live:{...live,serverAt,elapsedMs:live.elapsedMs+delta,
    ...(live.roundElapsedMs===undefined ? {} : {roundElapsedMs:live.roundElapsedMs+(live.between?0:delta)}),
    ...(live.summary ? {summary:live.summary.map(r=>r.id===live.round?.id?{...r,activeMs:r.activeMs+delta}:r)} : {})}};
}
