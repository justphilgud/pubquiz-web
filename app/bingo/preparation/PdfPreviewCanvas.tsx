'use client';
import { useEffect,useRef,useState } from 'react';
import type { PDFDocumentProxy,RenderTask } from 'pdfjs-dist';
/** Displays the actual generated PDF. No independent card drawing or native PDF plugin. */
export default function PdfPreviewCanvas({base64,label}:{base64:string;label:string}){
  const canvas=useRef<HTMLCanvasElement>(null),container=useRef<HTMLDivElement>(null);
  const [pdf,setPdf]=useState<PDFDocumentProxy|null>(null),[page,setPage]=useState(1),[zoom,setZoom]=useState(1),[message,setMessage]=useState('PDF wird geladen …');
  useEffect(()=>{
    let disposed=false,document:PDFDocumentProxy|undefined,loading:ReturnType<typeof import('pdfjs-dist')['getDocument']>|undefined;
    void import('pdfjs-dist').then(async pdfjs=>{
      if(disposed)return;
      pdfjs.GlobalWorkerOptions.workerSrc=`/bingo/pdf-worker/${pdfjs.version}`;
      loading=pdfjs.getDocument({data:Uint8Array.from(atob(base64),c=>c.charCodeAt(0))});
      document=await loading.promise;
      if(disposed){await loading.destroy();return;}
      setPdf(document);setMessage('');
    }).catch(()=>{if(!disposed)setMessage('Die PDF-Vorschau konnte nicht geladen werden. Bitte das Vorschau-PDF öffnen.');});
    return()=>{disposed=true;void loading?.destroy();};
  },[base64]);
  useEffect(()=>{
    if(!pdf||!canvas.current||!container.current)return;
    let disposed=false,task:RenderTask|undefined;
    const target=canvas.current,host=container.current;
    let sequence=Promise.resolve();
    function render(){
      task?.cancel();
      sequence=sequence.catch(()=>{}).then(async()=>{
        if(disposed)return;
        const sheet=await pdf!.getPage(page);if(disposed)return;
        const natural=sheet.getViewport({scale:1}),scale=Math.min(3,(host.clientWidth-24)/natural.width,Math.max(240,window.innerHeight*.65)/natural.height)*zoom;
        const viewport=sheet.getViewport({scale}),ratio=Math.min(2,window.devicePixelRatio||1),context=target.getContext('2d');
        if(!context)throw Error('CANVAS_UNAVAILABLE');
        target.width=Math.ceil(viewport.width*ratio);target.height=Math.ceil(viewport.height*ratio);
        target.style.width=`${viewport.width}px`;target.style.height=`${viewport.height}px`;
        task=sheet.render({canvas:target,canvasContext:context,viewport,transform:[ratio,0,0,ratio,0,0]});
        await task.promise;
        if(!disposed){target.dataset.rendered='true';setMessage('');}
      });
      void sequence.catch(error=>{if(!disposed&&error?.name!=='RenderingCancelledException')setMessage('PDF-Seite konnte nicht dargestellt werden. Bitte das Vorschau-PDF öffnen.');});
    }
    const observer=new ResizeObserver(render);observer.observe(host);window.addEventListener("resize",render);render();
    return()=>{disposed=true;observer.disconnect();window.removeEventListener("resize",render);task?.cancel();};
  },[pdf,page,zoom]);
  return <div className="min-w-0 space-y-3"><div className="flex flex-wrap items-center gap-3"><button type="button" className="min-h-11 rounded border px-3" disabled={!pdf||page<=1} onClick={()=>setPage(n=>n-1)}>Vorherige PDF-Seite</button><span>{page} / {pdf?.numPages??'…'}</span><button type="button" className="min-h-11 rounded border px-3" disabled={!pdf||page>=pdf.numPages} onClick={()=>setPage(n=>n+1)}>Nächste PDF-Seite</button><label>Vergrößerung<select aria-label="Vergrößerung" className="ml-2 min-h-11 rounded border bg-white px-2" value={zoom} onChange={e=>setZoom(Number(e.target.value))}><option value={1}>Seite einpassen</option><option value={1.5}>150 %</option><option value={2}>200 %</option></select></label></div>{message&&<p role="status">{message}</p>}<div ref={container} className="max-h-[75vh] min-w-0 overflow-auto rounded border bg-slate-100 p-3"><canvas ref={canvas} role="img" aria-label={label} className="block bg-white"/></div></div>;
}
