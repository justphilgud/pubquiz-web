/** One in-flight Matching request; only the newest queued intent may update its dialog. */
export function createMatchingRequestLane(){
 let version=0,running=false,queued:(()=>Promise<void>)|null=null;
 async function drain(){
  if(running)return;
  running=true;
  try{while(queued){const next=queued;queued=null;await next();}}
  finally{running=false;}
 }
 return {
  invalidate(){version++;queued=null;},
  request<T>(load:()=>Promise<T>,accept:(value:T)=>void,reject:(error:unknown)=>void){
   const ticket=++version;
   queued=async()=>{try{const value=await load();if(ticket===version)accept(value);}catch(error){if(ticket===version)reject(error);}};
   void drain();
  },
 };
}
