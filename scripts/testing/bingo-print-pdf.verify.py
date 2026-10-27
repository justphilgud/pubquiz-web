"""Verify real generated PDFs and visible raster ink; requires pypdf/pdfplumber/Pillow/Poppler."""
import argparse,json,re,subprocess,struct
from pathlib import Path
from pypdf import PdfReader
import pdfplumber
from PIL import Image

parser=argparse.ArgumentParser();parser.add_argument('--directory',default='output/pdf/square');parser.add_argument('--poppler',default='pdftoppm');args=parser.parse_args()
root=Path(args.directory);side=(595.276-56.7-14.17)/2;reports=[]
for file in sorted(root.glob('*.pdf')):
    brand='lovd-ungegoogelt' if 'lovd' in file.name else 'phil-gud';all_cards=json.loads((root/f'bingo-{brand}-expected.json').read_text())
    cards=all_cards[1:6] if 'partial' in file.name else all_cards[:8] if 'duplex' in file.name else all_cards
    duplex='font-' not in file.name;pdf=PdfReader(file);expected_pages=((len(cards)+3)//4)*(2 if duplex else 1);assert len(pdf.pages)==expected_pages
    prefix=root/file.stem;subprocess.run([args.poppler,'-scale-to','1100','-png',str(file),str(prefix)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    seen=[];font_streams=set()
    with pdfplumber.open(file) as doc:
        for index,page in enumerate(doc.pages):
            back=duplex and index%2==1;chunk_index=index//2 if duplex else index;chunk=cards[chunk_index*4:chunk_index*4+4]
            backgrounds=[r for r in page.rects if abs(r['width']-side)<.01 and abs(r['height']-side)<.01]
            assert len(backgrounds)==len(chunk),(file,index,'square count')
            for slot,card in enumerate(chunk):
                col=(1-slot%2) if back else slot%2;x=28.35+col*(side+14.17);y=841.89-28.35-side-(slot//2)*(side+14.17)
                assert any(abs(r['x0']-x)<.01 and abs(r['y0']-y)<.01 for r in backgrounds),(file,index,'duplex mirrored slot')
                images=[im for im in page.images if im['x0']>=x-.01 and im['x1']<=x+side+.01 and im['y0']>=y-.01 and im['y1']<=y+side+.01]
                assert len(images)==((2 if brand=='lovd-ungegoogelt' else 1) if back else 1),(file,index,'logo count')
                for im in images:assert abs(im['width']/im['height']-im['srcsize'][0]/im['srcsize'][1])<.001,(file,'distorted logo')
            text=pdf.pages[index].extract_text();assert not any(v in text for v in ['FREI','DO NOT PRINT','Runde','Druckabnahme','500 Karten','BG-'])
            if back:assert not text.strip(),(file,index,'back text')
            else:
                values=[]
                for line in text.splitlines():
                    line=line.strip()
                    if re.fullmatch(r'\d{1,2}',line):values.append(int(line))
                    if re.fullmatch(r'[A-Z]+-\d{3}',line):
                        card=cards[len(seen)];assert line==card['shortCode'];assert values==[v for row in card['cells'] for v in row if v is not None];values=[];seen.append(line)
                # Visible raster pixels must leave a margin inside every numeric cell.
                png=Path(f'{prefix}-{index+1}.png');image=Image.open(png).convert('RGB');scale=image.height/841.89;cell=(side-48)/5
                for slot in range(len(chunk)):
                    x=28.35+(slot%2)*(side+14.17)+24;y=841.89-28.35-side-(slot//2)*(side+14.17)+19
                    for row in range(5):
                        for col in range(5):
                            if row==2 and col==2:continue
                            left=x+col*cell;bottom=y+(4-row)*cell
                            bounds=(int((left+1)*scale),int((841.89-bottom-cell+1)*scale),int((left+cell-1)*scale),int((841.89-bottom-1)*scale))
                            points=[(xx,yy) for yy in range(bounds[1],bounds[3]) for xx in range(bounds[0],bounds[2]) if max(image.getpixel((xx,yy)))<50]
                            assert points,(file,index,row,col,'missing visible number')
                            assert min(p[0] for p in points)>(left+2)*scale and max(p[0] for p in points)<(left+cell-2)*scale,(file,index,row,col,'visible number crosses cell margin')
                for f in pdf.pages[index]['/Resources']['/Font'].values():
                    assert re.match(r'^/[A-Z]{6}\+Bingo(Heading|Numbers)',str(f.get_object()['/BaseFont'])), 'distinct standard subset font names'
                    stream=f.get_object()['/DescendantFonts'][0].get_object()['/FontDescriptor'].get_object()['/FontFile2'].get_object();program=stream.get_data()
                    # A five-letter BINGO subset can legitimately be below 1 KB.
                    # Validate the actual embedded SFNT directory and every table,
                    # rather than using a size proxy or accepting an empty program.
                    assert program[:4] in [b'true',b'\x00\x01\x00\x00',b'OTTO'];tables=struct.unpack_from('>H',program,4)[0];assert 3<=tables<=64 and 12+16*tables<len(program)
                    tags=set()
                    for t in range(tables):
                        tag,checksum,offset,length=struct.unpack_from('>4sIII',program,12+16*t);tags.add(tag);assert offset+length<=len(program)
                    assert {b'head',b'hhea',b'hmtx'}.issubset(tags) and (b'glyf' in tags or b'CFF ' in tags);font_streams.add(stream.indirect_reference.idnum)
    assert len(seen)==len(cards) and len(font_streams)==2
    reports.append({'file':file.name,'cards':len(cards),'pages':expected_pages,'squares':True,'mirroredBacks':duplex,'storedCells':'PASS','visibleNumericInkMargins':'PASS','embeddedFonts':2,'fullAspectLogos':'PASS'})
result={'reports':reports,'physicalDuplexTest':False};(root/'verification.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
