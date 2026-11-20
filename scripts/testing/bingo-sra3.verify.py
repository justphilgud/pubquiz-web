"""Independent actual PDF geometry, duplex identity and raster design comparison."""
import json,subprocess,copy,math
from pathlib import Path
import pdfplumber
from pypdf import PdfReader,PdfWriter,Transformation
from pypdf.generic import RectangleObject
from PIL import Image,ImageChops,ImageStat,ImageOps,ImageDraw
root=Path('.artifacts/bingo-sra3'); out=root/'rendered';out.mkdir(exist_ok=True)
pt=72/25.4
manifest=json.loads((root/'pdf-manifest.json').read_text())
def frames(page,side):
 return [r for r in page.rects if abs(r['width']-side)<.001 and abs(r['height']-side)<.001 and r.get('fill')]
def normalize(src,index,rect,dest):
 reader=PdfReader(src);writer=PdfWriter();page=copy.copy(reader.pages[index]);page.add_transformation(Transformation().translate(-rect['x0'],-rect['y0']));page.mediabox=RectangleObject([0,0,rect['width'],rect['height']]);page.cropbox=page.mediabox;writer.add_page(page)
 with open(dest,'wb') as f:writer.write(f)
 subprocess.run(['pdftoppm','-singlefile','-r','144','-png',str(dest),str(dest.with_suffix(''))],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
 return Image.open(dest.with_suffix('.png')).convert('RGB')
results=[];thumbs=[]
for case in manifest:
 with pdfplumber.open(root/(case['name']+'-baseline.pdf')) as old,pdfplumber.open(root/(case['name']+'-sra3.pdf')) as new:
  for i in range(2):
   a,b=old.pages[i],new.pages[i];side=case['sideMm']*pt
   assert abs(b.width/pt-320)<1e-6 and abs(b.height/pt-450)<1e-6
   ar,br=frames(a,side),frames(b,side);assert len(ar)==len(br)==1
   ar,br=ar[0],br[0]
   assert min(br['x0'],br['y0'],b.width-br['x1'],b.height-br['y1'])/pt>=10-1e-6
   expected=case['front' if i==0 else 'back'];assert abs(br['x0']-expected['x'])<1e-4 and abs(br['y0']-expected['y'])<1e-4
   aa=normalize(root/(case['name']+'-baseline.pdf'),i,ar,out/f"{case['name']}-{i}-old.pdf")
   bb=normalize(root/(case['name']+'-sra3.pdf'),i,br,out/f"{case['name']}-{i}-new.pdf")
   assert aa.size==bb.size
   diff=ImageChops.difference(aa,bb);mean=sum(ImageStat.Stat(diff).mean)/3
   changed=sum(1 for rgb in diff.get_flattened_data() if max(rgb)>20)/(aa.width*aa.height)
   # PDF coordinates are rounded at serialization; translated raster edges may differ by antialiasing.
   ac=[(c['text'],c['size'],c['x0']-ar['x0'],c['y0']-ar['y0']) for c in a.chars]
   bc=[(c['text'],c['size'],c['x0']-br['x0'],c['y0']-br['y0']) for c in b.chars]
   assert len(ac)==len(bc)
   for ca,cb in zip(ac,bc):
    assert ca[0]==cb[0] and all(abs(x-y)<.001 for x,y in zip(ca[1:],cb[1:]))
   assert mean<2 and changed<.02,(case['name'],i,mean,changed)
   results.append({'case':case['name'],'side':'back' if i else 'front','edgeMm':br['width']/pt,'meanPixelDifference':mean,'pixelsOver20Fraction':changed})
   if case['version']==4 and case['kind']=='terms' and case['profile']=='A4_SIX':
    bb.thumbnail((260,260));thumbs.append((case['name']+(' back' if i else ' front'),bb.copy()))
# Actual codes and independently extracted front-cell identities, including a mid-series subrange.
for file,start,count in [('duplex-1.pdf',1,1),('duplex-12.pdf',1,12),('duplex-13.pdf',1,13),('duplex-range-5-17.pdf',5,13)]:
 with pdfplumber.open(root/file) as pdf:
  assert len(pdf.pages)==2*math.ceil(count/12)
  for offset in range(0,count,12):
   front,back=pdf.pages[2*(offset//12):2*(offset//12)+2];side=92.5*pt
   ff=sorted(frames(front,side),key=lambda r:(round(r['top'],3),r['x0']));bb=frames(back,side)
   assert len(ff)==len(bb)==min(12,count-offset)
   for slot,f in enumerate(ff):
    n=start+offset+slot;col=slot%3;row=slot//3
    x=(320*pt-3*side-2*5*pt)/2+(2-col)*(side+5*pt)
    candidates=[b for b in bb if abs(b['x0']-x)<1e-4 and abs(b['top']-f['top'])<1e-4];assert len(candidates)==1
    b=candidates[0];text=back.crop((b['x0'],b['top'],b['x1'],b['bottom'])).extract_text() or ''
    assert f'AA-{n:03}' in text,(file,n,text)
    assert abs(f['x0']+b['x0']+side-front.width)<1e-4
    assert all(c['upright'] for c in back.chars)
    # Read the first numeric cell from the transparent searchable text, not an expected geometry helper.
    digits=[c for c in front.chars if f['x0']+14<c['x0']<f['x0']+14+(side-28)/5 and f['top']+side-14-(side-70)/5*5<c['top']<f['top']+side-14-(side-70)/5*4]
    value=''.join(c['text'] for c in sorted(digits,key=lambda c:c['x0']))
    assert value==str(1+(n-1)%5),(file,n,value)
browser_summary=None
if (root/'browser-card-identities.json').exists():
 ids=json.loads((root/'browser-card-identities.json').read_text())
 with pdfplumber.open(root/'browser-13-duplex.pdf') as pdf,pdfplumber.open(root/'browser-13-front.pdf') as fronts,pdfplumber.open(root/'browser-preview-sheet.pdf') as preview:
  assert len(pdf.pages)==4 and len(fronts.pages)==2 and len(preview.pages)==2
  assert all(abs(p.width/pt-320)<1e-6 and abs(p.height/pt-450)<1e-6 for p in pdf.pages)
  side=92.5*pt;cell=(side-36)/5
  for offset in [0,12]:
   page,back=pdf.pages[2*(offset//12):2*(offset//12)+2]
   ff=sorted(frames(page,side),key=lambda r:(round(r['top'],3),r['x0']))
   assert len(ff)==min(12,13-offset)
   for slot,f in enumerate(ff):
    identity=ids[offset+slot];prefix=identity['prefix'];letters=''
    while prefix>0:letters=chr(65+(prefix-1)%26)+letters;prefix=(prefix-1)//26
    code=f"{letters}-{identity['ordinal']:03}"
    br=[r for r in frames(back,side) if abs(f['x0']+r['x0']+side-page.width)<.001 and abs(f['top']-r['top'])<.001];assert len(br)==1
    assert code in (back.crop((br[0]['x0'],br[0]['top'],br[0]['x1'],br[0]['bottom'])).extract_text() or '')
    for row in range(5):
     for col in range(5):
      expected=identity['cells'][row][col]
      if expected is None:continue
      x=f['x0']+18+col*cell;top=page.height-(f['y0']+14+(5-row)*cell)
      value=(page.crop((x+2,top+2,x+cell-2,top+cell-2)).extract_text() or '').strip()
      assert value==str(expected),(identity['ordinal'],row,col,value,expected)
  for i in range(2):
   assert [(round(r['x0'],4),round(r['top'],4),round(r['width'],4)) for r in frames(pdf.pages[i],side)]==[(round(r['x0'],4),round(r['top'],4),round(r['width'],4)) for r in frames(preview.pages[i],side)]
   assert pdf.pages[i].extract_text()==preview.pages[i].extract_text()
  browser_summary={'duplexPages':4,'frontPages':2,'previewPages':2,'all13FrontsAndBackCodesVerified':True,'previewMatchesFirstSheet':True}
summary={'cases':len(manifest),'cardSidesCompared':len(results),'maximumMeanPixelDifference':max(r['meanPixelDifference'] for r in results),'maximumChangedFraction':max(r['pixelsOver20Fraction'] for r in results),'pageMm':[320,450],'edgesMm':sorted(set(round(r['edgeMm'],6) for r in results)),'duplexCounts':[1,12,13],'range':'5–17','results':results,'browser':browser_summary}
(root/'verification.json').write_text(json.dumps(summary,indent=2))
canvas=Image.new('RGB',(560,310*math.ceil(len(thumbs)/2)),'#eeeeee');draw=ImageDraw.Draw(canvas)
for i,(label,im) in enumerate(thumbs):x=(i%2)*280;y=(i//2)*310;canvas.paste(im,(x+10,y+40));draw.text((x+10,y+8),label.replace('bingo-print-',''),fill='black')
canvas.save(root/'comparison-contact.png')
print(json.dumps({k:v for k,v in summary.items() if k!='results'}))
