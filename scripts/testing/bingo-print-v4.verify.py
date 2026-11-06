"""Independent geometry/text/font/duplex QA of the actual V4 sample PDFs (not HTML)."""
import argparse,json,math,re,subprocess
from pathlib import Path
import pdfplumber
from pypdf import PdfReader
from PIL import Image,ImageOps,ImageDraw
p=argparse.ArgumentParser();p.add_argument('--directory',required=True);p.add_argument('--poppler',default='pdftoppm');a=p.parse_args()
root=Path(a.directory);render=root.parent/'rendered';render.mkdir(exist_ok=True)
formats={'A4_FOUR':(210,297,2,2,10,5),'A4_SIX':(210,297,2,3,10,5),'A6_ONE':(105,148,1,1,6,0)}
cells=[[1,16,31,46,61],[2,17,32,47,62],[3,18,None,48,63],[4,19,34,49,64],[5,20,35,50,65]]
labels=['ABBA','Bob Dylan','Take That','Queen','Adele','Lady Gaga','Pink Floyd','U2','Die Ärzte','Falco','Nena','AC/DC','Oasis','Prince','Lou Reed','Bon Jovi','Elton John','Boney M.','Kiss','Earth Wind & Fire','Dua Lipa','Billy Joel','R.E.M.','The Who']
# Original Phil Gud Display shares uppercase/lowercase outlines; subset CMaps may expose either case.
# Preserve every letter/accent/punctuation; normalize only case and line whitespace.
normalize=lambda t:re.sub(r'\s+','',t).lower()
results=[];thumbs=[]
for file in sorted(root.glob('bingo-print-*.pdf')):
 fmt=next(k for k in formats if k in file.stem);wm,hm,cols,rows,margin,gap=formats[fmt];factor=72/25.4;w,h=wm*factor,hm*factor;side=min((wm-2*margin-(cols-1)*gap)/cols,(hm-2*margin-(rows-1)*gap)/rows)*factor;capacity=cols*rows
 reader=PdfReader(file);assert len(reader.pages)==2*math.ceil(7/capacity)
 lovd='lovd' in file.name;terms='terms' in file.name
 with pdfplumber.open(file) as pdf:
  for index,page in enumerate(pdf.pages):
   back=index%2==1;offset=index//2*capacity;present=min(capacity,7-offset);assert abs(page.width-w)<.01 and abs(page.height-h)<.01
   frames=[r for r in page.rects if abs(r['width']-side)<.01 and abs(r['height']-side)<.01];assert len(frames)==present
   if back:
    assert len(page.chars)>0 and all(abs(c['size']-6.5)<.01 for c in page.chars)
    assert all(c.get('non_stroking_color')!= (1,1,1) for c in page.chars) # black reference backs use neutral grey
    # No small filled rectangle can masquerade as a white ID label.
    assert not any(r.get('fill') and r.get('non_stroking_color') in [(1,1,1),1] for r in page.rects)
   else:
    assert all(c['size']>=10-.001 for c in page.chars),'minimum font size'
    assert 'AA-' not in (page.extract_text() or '')
   for slot in range(present):
    col=cols-1-slot%cols if back else slot%cols;row=slot//cols;left=(w-cols*side-(cols-1)*gap*factor)/2;x=left+col*(side+gap*factor);y=h-margin*factor-side-row*(side+gap*factor)
    assert any(abs(r['x0']-x)<.01 and abs(r['y0']-y)<.01 for r in frames)
    images=[im for im in page.images if im['x0']>=x-.01 and im['x1']<=x+side+.01 and im['y0']>=y-.01 and im['y1']<=y+side+.01]
    assert len(images)==((2 if lovd else 1) if back else 1),'front/back logo count'
    for im in images:assert abs(im['width']/im['height']-im['srcsize'][0]/im['srcsize'][1])<.01,'logo aspect ratio'
    if back:
     code=f'AA-{offset+slot+1:03d}';word=next(v for v in page.extract_words() if v['text']==code)
     assert x+14<=word['x0']<x+side-10 and h-y-25<=word['top']<=h-y-8,'correct mirrored card ID position'
    else:
     cw=(side-28)/5;ch=(side-70)/5
     for r,values in enumerate(cells):
      for c,n in enumerate(values):
       if n is None:continue
       cx=x+14+c*cw;cy=y+14+(4-r)*ch
       # Crop includes the original font's text-layer side bearings; visible contour bounds are checked independently below.
       text=page.crop((cx+2,h-cy-ch+2,cx+cw-2,h-cy-2)).extract_text() or ''
       expected=labels[n-1] if terms and n<=len(labels) else f'Band {n}' if terms else str(n)
       assert normalize(text)==normalize(expected),(file.name,index,r,c,expected,text)
   if not back:
    # PDF vector contours are the visible ink; a font text-layer advance box is not a glyph bound.
    checked=0
    for curve in page.curves:
     mx=(curve['x0']+curve['x1'])/2;my=(curve['y0']+curve['y1'])/2
     for frame in frames:
      gx=frame['x0']+14;gy=frame['y0']+14;cw=(side-28)/5;ch=(side-70)/5
      if gx<=mx<gx+5*cw and gy<=my<gy+5*ch:
       cx=gx+int((mx-gx)//cw)*cw;cy=gy+int((my-gy)//ch)*ch
       assert curve['x0']>=cx+1.5 and curve['x1']<=cx+cw-1.5,(file.name,index,'horizontal visible overlap')
       assert curve['y0']>=cy+1.5 and curve['y1']<=cy+ch-1.5,(file.name,index,'vertical visible overlap')
       checked+=1
    assert checked>0,'visible original contours missing'
   resources=reader.pages[index]['/Resources'];fonts=resources.get('/Font',{}).get_object();assert any('/FontFile' in str(f.get_object()) or '/DescendantFonts' in f.get_object() for f in fonts.values()),'embedded originals'
 for page in sorted(set([1,2,len(reader.pages)])):
  prefix=render/(file.stem+f'-p{page}');subprocess.run([a.poppler,'-f',str(page),'-l',str(page),'-singlefile','-scale-to','1100','-png',str(file),str(prefix)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
  if page in [1,2]:
   im=Image.open(str(prefix)+'.png').convert('RGB');im.thumbnail((340,400));tile=Image.new('RGB',(360,435),'#eeeeee');tile.paste(im,((360-im.width)//2,10));ImageDraw.Draw(tile).text((8,413),file.stem.replace('bingo-print-','')+f' p{page}',fill='black');thumbs.append(tile)
 results.append({'file':file.name,'pages':len(reader.pages),'format':fmt,'side_mm':side/factor,'front_and_back_complete':True,'minimum_body_pt':10,'id_pt':6.5,'duplex_partial_sheet':'PASS'})
assert len(results)==12,'both brands x two content types x three formats'
contact=Image.new('RGB',(360*4,435*math.ceil(len(thumbs)/4)),'white')
for i,im in enumerate(thumbs):contact.paste(im,((i%4)*360,(i//4)*435))
contact.save(render/'contact-sheet.png');(root.parent/'pdf-verification.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(f'{len(results)} actual PDFs: geometry, text completeness, font minima, logos, no ID bar and mirrored partial duplex PASS')
