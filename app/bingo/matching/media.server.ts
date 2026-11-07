import 'server-only';
import {readFile,realpath,stat} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {head} from '@vercel/blob';
import {getBlobUploadAuthentication} from '@/app/fragen/editor/mediaUploadEnvironment';
import {mediaKindRules} from '@/app/fragen/editor/mediaSlots';
import {MatchingError,type MatchingSource} from '../preparation/matching';
import {sha256} from '../preparation/printSnapshot';
import {matchingContentType} from './mediaFormat';
import {matchingRange,type MatchingRange} from './mediaRange';
import {matchingStaticMediaUrl} from './staticMedia';
export async function matchingMediaAvailable(reference:string,kind:MatchingSource['kind']):Promise<boolean>{
 try{const rule=mediaKindRules[kind];
  if(reference.startsWith('/medien/')||!reference.includes(':')&&!reference.startsWith('/')){try{const root=await realpath(resolve('public/medien')),file=await realpath(resolve(root,decodeURIComponent(reference.replace(/^\/medien\//,''))));if(!file.startsWith(root+sep))return false;const info=await stat(file);return info.isFile()&&info.size>0&&info.size<=rule.maximumSizeInBytes;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')return false;const url=matchingStaticMediaUrl(reference);if(!url)return false;const response=await fetch(url,{method:'HEAD',redirect:'error',signal:AbortSignal.timeout(5000),cache:'no-store'});const size=Number(response.headers.get('content-length'));return response.ok&&size>0&&size<=rule.maximumSizeInBytes&&rule.mimeTypes.includes(response.headers.get('content-type')?.split(';')[0]??'');}}
  const url=new URL(reference);if(url.protocol!=='https:'||!url.hostname.endsWith('.public.blob.vercel-storage.com')||url.port||url.username||url.password||url.search||url.hash)return false;
  const metadata=await head(reference,getBlobUploadAuthentication());return metadata.size>0&&metadata.size<=rule.maximumSizeInBytes&&rule.mimeTypes.includes(metadata.contentType);
 }catch{return false;}
}
/** Bounded acquisition of an already authorized source, using the existing store. No provider/upload. */
export async function captureMatchingMedia(reference:string,kind:MatchingSource['kind']){
 const rule=mediaKindRules[kind];let bytes:Buffer,mime='';
 if(reference.startsWith('/medien/')||!reference.includes(':')&&!reference.startsWith('/')){
  try{const root=await realpath(resolve('public/medien')),file=await realpath(resolve(root,decodeURIComponent(reference.replace(/^\/medien\//,''))));
  if(!file.startsWith(root+sep)||(await stat(file)).size>rule.maximumSizeInBytes)throw new MatchingError('Medienpfad oder Dateigröße ist unzulässig.');
  bytes=await readFile(file);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;const url=matchingStaticMediaUrl(reference);if(!url)throw new MatchingError('Die lokale Mediendatei fehlt.');bytes=await fetchMedia(url,rule.maximumSizeInBytes);}
 }else{
  const url=new URL(reference);
  if(url.protocol!=='https:'||!url.hostname.endsWith('.public.blob.vercel-storage.com')||url.port||url.username||url.password||url.search||url.hash)throw new MatchingError('Die Medienquelle ist keine beständige freigegebene Referenz.');
  // Existing credential verifies ownership; a public URL alone never grants snapshot IO.
  const metadata=await head(reference,getBlobUploadAuthentication());
  if(!rule.mimeTypes.includes(metadata.contentType)||metadata.size<=0||metadata.size>rule.maximumSizeInBytes)throw new MatchingError('Medienformat oder Dateigröße ist unzulässig.');
  bytes=await fetchMedia(url,rule.maximumSizeInBytes);mime=metadata.contentType;
 }
 if(!bytes.length||bytes.length>rule.maximumSizeInBytes)throw new MatchingError('Medium fehlt oder ist zu groß.');
 mime=matchingContentType(bytes,kind)??'';
 if(!mime)throw new MatchingError('Die tatsächlichen Mediendaten entsprechen keinem unterstützten Format.');
 const {sanitizeMatchingMedia}=await import('./sanitizeMedia.server');
 const clean=await sanitizeMatchingMedia(bytes,mime);
 if(!clean.length||clean.length>rule.maximumSizeInBytes)throw new MatchingError('Die bereinigte Mediendatei überschreitet die erlaubte Größe.');
 return {bytes:clean,contentType:mime,sha256:sha256(clean)};
}
/** Opaque filename and explicit range support. Cached private responses must reauthorize. */
export function matchingMediaResponse(request:Request,media:{bytes:Uint8Array;contentType:string;byteRange?:MatchingRange;invalidRangeSize?:number}){
 const bytes=new Uint8Array(media.bytes),headers:Record<string,string>={'Content-Type':media.contentType,'Cache-Control':'private, no-store','Content-Disposition':'inline; filename="bingo-media"','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Accept-Ranges':'bytes'};
 if(media.invalidRangeSize!==undefined)return new Response(null,{status:416,headers:{...headers,'Content-Range':`bytes */${media.invalidRangeSize}`}});
 const range=media.byteRange??matchingRange(request.headers.get('range'),bytes.length);
 if(range==='invalid')return new Response(null,{status:416,headers:{...headers,'Content-Range':`bytes */${bytes.length}`}});
 if(range){return new Response(media.byteRange?bytes:bytes.slice(range.from,range.to+1),{status:206,headers:{...headers,'Content-Range':`bytes ${range.from}-${range.to}/${range.total}`,'Content-Length':String(range.to-range.from+1)}});}
 return new Response(bytes,{headers:{...headers,'Content-Length':String(bytes.length)}});
}

async function fetchMedia(url:URL|string,maximum:number){const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(12000),cache:'no-store'});if(!response.ok||!response.body||Number(response.headers.get('content-length')??0)>maximum)throw new MatchingError('Medium fehlt oder konnte nicht geladen werden.');const reader=response.body.getReader(),parts:Uint8Array[]=[];let size=0;try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>maximum)throw new MatchingError('Die Mediendatei überschreitet die erlaubte Größe.');parts.push(part.value);}}finally{await reader.cancel();}return Buffer.concat(parts);}
