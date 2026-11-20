"""Actual LOVD PDFs: colors, original typography, protected transparent logos and duplex IDs."""
import json,copy,subprocess,io,re
from pathlib import Path
import pdfplumber
from pypdf import PdfReader,PdfWriter,Transformation
from pypdf.generic import RectangleObject
from PIL import Image,ImageChops,ImageStat
root=Path('.artifacts/bingo-sra3');out=root/'lovd-correction';out.mkdir(exist_ok=True);pt=72/25.4
profiles={'A4_FOUR':92.5,'A4_SIX':89,'A6_ONE':93};red=(106/255,36/255,28/255)
def close(a,b,eps=1e-5):return all(abs(x-y)<eps for x,y in zip(a,b))
def frame(page,side):return [r for r in page.rects if abs(r['width']-side)<.001 and abs(r['height']-side)<.001 and r.get('fill')]
def normalize(src,index,r,dest,dpi=144):
 page=copy.copy(PdfReader(src).pages[index]);page.add_transformation(Transformation().translate(-r['x0'],-r['y0']));page.mediabox=RectangleObject([0,0,r['width'],r['height']]);page.cropbox=page.mediabox;w=PdfWriter();w.add_page(page)
 with open(dest,'wb') as f:w.write(f)
 subprocess.run(['pdftoppm','-singlefile','-r',str(dpi),'-png',str(dest),str(dest.with_suffix(''))],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
 return Image.open(dest.with_suffix('.png')).convert('RGB')
comparisons=[]
for profile,mm in profiles.items():
 for kind in ['numbers','terms']:
  stem=out/f'{profile}-{kind}'
  with pdfplumber.open(str(stem)+'-old.pdf') as old,pdfplumber.open(str(stem)+'-new.pdf') as new,pdfplumber.open(str(stem)+'-sra3.pdf') as sra:
   for p in [new.pages[0],sra.pages[0]]:
    assert sum(1 for r in p.rects if r.get('fill') and isinstance(r.get('non_stroking_color'),tuple) and close(r['non_stroking_color'],red))==6
   a,b=old.pages[0],new.pages[0]
   assert len(a.chars)==len(b.chars)
   for ca,cb in zip(a.chars,b.chars):assert ca['text']==cb['text'] and close([ca[k] for k in ['size','x0','y0']],[cb[k] for k in ['size','x0','y0']],.001)
   for index in [0,1]:
    pa,pb=new.pages[index],sra.pages[index];ar,br=frame(pa,mm*pt)[0],frame(pb,mm*pt)[0]
    aa=normalize(str(stem)+'-new.pdf',index,ar,out/f'{profile}-{kind}-{index}-a.pdf');bb=normalize(str(stem)+'-sra3.pdf',index,br,out/f'{profile}-{kind}-{index}-b.pdf');assert aa.size==bb.size
    mean=sum(ImageStat.Stat(ImageChops.difference(aa,bb)).mean)/3;assert mean<2
    comparisons.append({'profile':profile,'kind':kind,'side':index,'edgeMm':br['width']/pt,'meanPixelDifference':mean})
# Browser sample uses all 13 real generated cards; the companion generic verifier checks every numeric cell and matching back code.
browser=root/'browser-13-duplex.pdf'
with pdfplumber.open(browser) as pdf:
 assert len(pdf.pages)==4
 side=92.5*pt
 for page_index,page in enumerate(pdf.pages):
  assert close([page.width/pt,page.height/pt],[320,450])
  if page_index%2:
   assert len(frame(page,side))==[12,1][page_index//2]
   assert page.chars and all(abs(c['size']-6.5)<.001 for c in page.chars)
   assert not any(r.get('fill') and close(r.get('non_stroking_color',()),(1,1,1)) for r in page.rects)
   diagonals=[l for l in page.lines if abs(l['linewidth']-.35)<.001 and l['width']>1 and l['height']>1]
   assert len(diagonals)==2*len(frame(page,side))
   # Primary LOVD logo is above the cross, and its L-length expanded box remains free.
   for r in frame(page,side):
    images=[im for im in page.images if r['x0']<=im['x0'] and im['x1']<=r['x1'] and r['y0']<=im['y0'] and im['y1']<=r['y1']]
    assert len(images)==2;lovd=max(images,key=lambda im:im['y0']);clearance=lovd['width']*752/3126
    assert min(lovd['x0']-r['x0'],r['x1']-lovd['x1'],r['y1']-lovd['y1'])>=clearance
    assert lovd['y0']-clearance>=r['y0']+side*.565+6
  else:
   rects=[r for r in page.rects if r.get('fill') and isinstance(r.get('non_stroking_color'),tuple) and close(r['non_stroking_color'],red)]
   assert len(rects)==6*len(frame(page,side))
   for im in page.images:
    owner=next(r for r in rects if r['x0']<=im['x0'] and r['x1']>=im['x1'] and r['y0']<=im['y0'] and r['y1']>=im['y1']);clearance=im['width']*752/3126
    assert min(im['x0']-owner['x0'],owner['x1']-im['x1'],im['y0']-owner['y0'],owner['y1']-im['y1'])>=clearance
 # Actual card A-012: front bottom right; its back bottom left.
 f=sorted(frame(pdf.pages[0],side),key=lambda r:(round(r['top'],3),r['x0']))[11]
 b=next(r for r in frame(pdf.pages[1],side) if 'A-012' in (pdf.pages[1].crop((r['x0'],r['top'],r['x1'],r['bottom'])).extract_text() or ''))
 normalize(browser,0,f,out/'A-012-front.pdf',600);back_image=normalize(browser,1,b,out/'A-012-back.pdf',600)
 # Transparent corners of both image bounds paint the exact same background, without a black rectangle.
 for im in pdf.pages[1].images:
  if b['x0']<=im['x0']<b['x1'] and b['y0']<=im['y0']<b['y0']+side*.5:
   x=int((im['x0']-b['x0']+1)*600/72);y=int((b['y1']-im['y1']+1)*600/72)
   assert max(abs(a-bb) for a,bb in zip(back_image.getpixel((x,y)),(20,24,28)))<=1
reader=PdfReader(browser);fonts=[]
for index in [1,3]:
 page=reader.pages[index];objects=page['/Resources']['/XObject'].get_object()
 assert all('/SMask' in obj.get_object() for obj in objects.values() if obj.get_object().get('/Subtype')=='/Image')
 for font in page['/Resources']['/Font'].get_object().values():
  f=font.get_object();d=f['/DescendantFonts'][0].get_object()['/FontDescriptor'].get_object();data=d['/FontFile2'].get_object().get_data();font_path=out/f'embedded-code-{index}.ttf';font_path.write_bytes(data)
  cmap=f['/ToUnicode'].get_object().get_data().decode();pairs=[]
  for block in re.findall(r'beginbfchar(.*?)endbfchar',cmap,re.S):
   pairs += [(int(cid,16),bytes.fromhex(value).decode('utf-16-be')) for cid,value in re.findall(r'<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>',block)]
  mapping=out/f'embedded-code-{index}.json';mapping.write_text(json.dumps(pairs))
  code="""const fs=require('fs'),kit=require('@pdf-lib/fontkit'),assert=require('assert/strict');const subset=kit.create(fs.readFileSync(process.argv[1]));let source=kit.create(fs.readFileSync('assets/fonts/arimo/Arimo.ttf'));const family=source.familyName;if(source.variationAxes?.wght)source=source.getVariation({wght:400});const pairs=JSON.parse(fs.readFileSync(process.argv[2]));assert.ok(pairs.length);for(const [id,char] of pairs){const a=subset.getGlyph(id),b=source.glyphForCodePoint(char.codePointAt(0));assert.equal(a.path.toSVG(),b.path.toSVG());assert.equal(a.advanceWidth,b.advanceWidth);}console.log(JSON.stringify({family,weight:400,glyphOutlinesMatched:pairs.length}));"""
  verified=json.loads(subprocess.check_output(['node','-e',code,str(font_path),str(mapping)],text=True));assert 'Arimo' in verified['family'];fonts.append(verified)
# Historical rendering is invariant before and after an explicitly confirmed new version.
with pdfplumber.open(root/'lovd-old-browser-13.pdf') as original:
 for path in ['browser-legacy-reexport.pdf','browser-legacy-after-redesign.pdf']:
  with pdfplumber.open(root/path) as historical:
   assert len(historical.pages)==len(original.pages)
   for a,b in zip(original.pages,historical.pages):
    assert a.extract_text()==b.extract_text()
    assert [(r['x0'],r['y0'],r['width'],r['height'],r.get('non_stroking_color')) for r in a.rects]==[(r['x0'],r['y0'],r['width'],r['height'],r.get('non_stroking_color')) for r in b.rects]
   assert all(c['size']==8 for p in historical.pages[1::2] for c in p.chars)
summary={'RGB':[106,36,28],'profilesMm':[89,92.5,93],'frontTypographyUnchanged':True,'regularCodePt':6.5,'regularCodeFonts':fonts,'transparentOriginalsWithSoftMasks':True,'crossPerBack':True,'LProtectionMeasured':True,'historicalV3Still8ptAndOriginalColors':True,'comparisons':comparisons}
(out/'verification.json').write_text(json.dumps(summary,indent=2));print(json.dumps({k:v for k,v in summary.items() if k!='comparisons'}))
