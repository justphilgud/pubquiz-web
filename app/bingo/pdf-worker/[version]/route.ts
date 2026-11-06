import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { version as pdfVersion } from 'pdfjs-dist/package.json';
export const runtime='nodejs';
/** Public fixed library asset; never arbitrary file or game data. */
export async function GET(_request:Request,{params}:{params:Promise<{version:string}>}){
 if((await params).version!==pdfVersion)return new Response('Nicht gefunden',{status:404});
 const bytes=await readFile(resolve('node_modules/pdfjs-dist/build/pdf.worker.min.mjs'));
 return new Response(bytes,{headers:{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'}});
}
