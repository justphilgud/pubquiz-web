import {readFile} from 'node:fs/promises';

/** Chrome creates DevToolsActivePort before necessarily writing both lines. */
export function chromeEndpoint(contents:string):string|null {
 const [port,path,...extra]=contents.trim().split(/\r?\n/);
 if(extra.length||!/^\d+$/.test(port??'')||Number(port)<1||Number(port)>65535||!/^\/devtools\/browser\/[a-zA-Z0-9-]+$/.test(path??''))return null;
 return `ws://127.0.0.1:${Number(port)}${path}`;
}

export async function waitForChromeEndpoint(file:string,{timeoutMs=30_000,pollMs=50,exited=()=>false}:{timeoutMs?:number;pollMs?:number;exited?:()=>boolean}={}):Promise<string>{
 const deadline=Date.now()+timeoutMs;
 do {
  if(exited())throw Error('Test browser exited before its debugging endpoint was ready');
  try {
   const endpoint=chromeEndpoint(await readFile(file,'utf8'));
   if(endpoint)return endpoint;
  }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  await new Promise(resolve=>setTimeout(resolve,pollMs));
 }while(Date.now()<deadline);
 throw Error('Test browser debugging endpoint did not become ready before timeout');
}
