/** Legacy public media is a static deployment asset, not necessarily in a serverless function bundle. */
export function matchingStaticMediaUrl(reference:string,environment:Record<string,string|undefined>=process.env):string|null{
 if(environment.VERCEL!=='1'||!environment.VERCEL_URL||!/^[-a-z0-9]+\.vercel\.app$/i.test(environment.VERCEL_URL))return null;
 let relative:string;try{relative=decodeURIComponent(reference.replace(/^\/medien\//,''));}catch{return null;}
 if((!reference.startsWith('/medien/')&&(reference.includes(':')||reference.startsWith('/')))||/[\\?#\x00-\x1f]/.test(relative)||relative.split('/').some(p=>!p||p==='.'||p==='..'))return null;
 return `https://${environment.VERCEL_URL}/medien/${relative.split('/').map(encodeURIComponent).join('/')}`;
}
