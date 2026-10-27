import "server-only";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, concatTransformationMatrix, popGraphicsState, pushGraphicsState, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { parsePrintSnapshot, type PrintSnapshot } from "./printSnapshot";
import { BingoPreparationError, decodeCard, MAX_EXPORT, type StoredCard } from "./policy";
import { createSquareCardsPdf, type PrintMode } from "./pdfSquare.server";

function fittedLines(text: string, font: PDFFont, width: number, maxLines: number, initial: number) {
  for (let size = initial; size >= 7; size -= 0.5) {
    const lines: string[] = []; let line = "";
    // Break long words too; never silently shorten stored titles.
    for (const word of text.trim().split(/\s+/)) {
      if (line && font.widthOfTextAtSize(`${line} ${word}`, size) > width) { lines.push(line); line = ""; }
      if (font.widthOfTextAtSize(word, size) > width) {
        for (const char of word) {
          if (font.widthOfTextAtSize(line + char, size) > width && line) { lines.push(line); line = ""; }
          line += char;
        }
      } else line = line ? `${line} ${word}` : word;
    }
    if (line.trim()) lines.push(line.trim());
    if (lines.length <= maxLines) return { lines, size };
  }
  throw new BingoPreparationError("Der Titel ist für das Druckfeld zu lang. Es wurde kein unvollständiges PDF erzeugt.");
}
type FontFace = ReturnType<typeof fontkit.create>;
function centered(page: PDFPage, text: string, font: PDFFont, size: number, x: number, y: number, width: number, face: FontFace) {
  const left = x + (width - font.widthOfTextAtSize(text, size)) / 2;
  if ([...text].some(c => !face.hasGlyphForCodePoint(c.codePointAt(0)!))) throw new BingoPreparationError("Die Druckschrift unterstützt nicht alle Zeichen. Bitte Titel und Schrift prüfen.");
  // Embedded searchable text and visible original glyph outlines use the same
  // face/weight/positions. The vector outlines avoid the variable-font subset
  // rendering defect found in raster QA, without substituting or rasterizing text.
  page.drawText(text, { font, size, x: left, y, opacity: 0 });
  const run = face.layout(text), scale = size / face.unitsPerEm;
  let advance = 0;
  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(1, 0, 0, -1, 0, 0));
  run.glyphs.forEach((glyph, i) => {
    const p = run.positions[i], path = glyph.path.toSVG();
    if (path.trim()) page.drawSvgPath(path, { x: left + (advance + p.xOffset) * scale, y: -y - p.yOffset * scale, scale, color: rgb(0.08, 0.1, 0.12) });
    advance += p.xAdvance;
  });
  page.pushOperators(popGraphicsState());
}
function color(value: string) {
  const match = /^#([a-f0-9]{6})$/i.exec(value);
  if (!match) throw new BingoPreparationError("Die Druckfarbe wird nicht unterstützt.");
  return rgb(parseInt(match[1].slice(0, 2), 16) / 255, parseInt(match[1].slice(2, 4), 16) / 255, parseInt(match[1].slice(4, 6), 16) / 255);
}
/** Pure export of stored cards and frozen bytes. No repository writes or asset fetches. */
export async function createCardsPdf(input: PrintSnapshot, cards: readonly StoredCard[], mode: PrintMode = 'front'): Promise<Uint8Array> {
  const snapshot = parsePrintSnapshot(input);
  if(snapshot.version===2)return createSquareCardsPdf(snapshot,cards,mode);
  if(mode!=='front')throw new BingoPreparationError('Dieses historische Druckdesign hat keine Rückseite. Bitte eine neue Druckdesign-Version anlegen.');
  if (!cards.length || cards.length > MAX_EXPORT || new Set(cards.map(c => c.id)).size !== cards.length) throw new BingoPreparationError("Ungültige Kartenmenge für den PDF-Export.");
  for (const card of cards) decodeCard(card.cells);
  const pdf = await PDFDocument.create();
  const face = (bytes: Uint8Array, weight: number) => {
    const font = fontkit.create(bytes) as ReturnType<typeof fontkit.create> & { variationAxes?: Record<string, { min: number; max: number }>; getVariation?: (axes: Record<string, number>) => ReturnType<typeof fontkit.create> };
    const axis = font.variationAxes?.wght;
    if (axis && (weight < axis.min || weight > axis.max)) throw new BingoPreparationError("Das gewählte Schriftgewicht ist in dieser Originalschrift nicht verfügbar. Bitte das Druckdesign prüfen.");
    return axis && font.getVariation ? font.getVariation({ wght: weight }) : font;
  };
  pdf.setTitle(`${snapshot.title} – ${snapshot.roundLabel}`); pdf.setSubject("Bingo-Karten · gespeicherte Kartenserie");
  const displayFace = face(Buffer.from(snapshot.display.bytes, "base64"), snapshot.design.config.tokens.typography.displayWeight);
  const bodyFace = face(Buffer.from(snapshot.body.bytes, "base64"), snapshot.design.config.tokens.typography.bodyWeight);
  pdf.registerFontkit({ create: () => displayFace });
  const display = await pdf.embedFont(Buffer.from(snapshot.display.bytes, "base64"), { subset: true });
  pdf.registerFontkit({ create: () => bodyFace });
  const body = await pdf.embedFont(Buffer.from(snapshot.body.bytes, "base64"), { subset: true });
  const logo = snapshot.logo ? await pdf.embedPng(Buffer.from(snapshot.logo.bytes, "base64")) : null;
  const accent = color(snapshot.design.config.tokens.colors.primary);
  const pageWidth = 595.276, pageHeight = 841.89, margin = 28.35, gap = 14.17;
  const width = (pageWidth - margin * 2 - gap) / 2, height = (pageHeight - margin * 2 - gap) / 2;
  for (let offset = 0; offset < cards.length; offset += 4) {
    const page = pdf.addPage([pageWidth, pageHeight]);
    for (let slot = 0; slot < 4 && offset + slot < cards.length; slot++) {
      const card = cards[offset + slot], x = margin + (slot % 2) * (width + gap), y = pageHeight - margin - Math.floor(slot / 2) * (height + gap) - height;
      page.drawRectangle({ x, y, width, height, color: rgb(1, 1, 1), borderColor: accent, borderWidth: 0.6 });
      page.drawRectangle({ x, y: y + height - 5, width, height: 5, color: accent });
      if (logo) {
        const scale = Math.min(86 / logo.width, 30 / logo.height), logoX = x + (width - logo.width * scale) / 2, logoY = y + height - 42;
        // Original light/transparent logos remain legible on a light paper card.
        page.drawRectangle({ x: logoX - 4, y: logoY - 3, width: logo.width * scale + 8, height: logo.height * scale + 6, color: rgb(0.08, 0.1, 0.12) });
        page.drawImage(logo, { x: logoX, y: logoY, width: logo.width * scale, height: logo.height * scale });
      }
      const title = fittedLines(snapshot.title, display, width - 20, 2, 15);
      title.lines.forEach((line, i) => centered(page, line, display, title.size, x, y + height - 65 - i * (title.size + 2), width, displayFace));
      const round = fittedLines(snapshot.roundLabel, body, width - 20, 2, 9);
      round.lines.forEach((line, i) => centered(page, line, body, round.size, x, y + height - 100 - i * 10, width, bodyFace));
      const gridX = x + 10, gridY = y + 38, cellWidth = (width - 20) / 5, cellHeight = 38;
      for (let r = 0; r < 6; r++) for (let c = 0; c < 5; c++) {
        const cx = gridX + c * cellWidth, cy = gridY + (5 - r) * cellHeight;
        const free = r === 3 && c === 2;
        page.drawRectangle({ x: cx, y: cy, width: cellWidth, height: cellHeight, borderColor: rgb(0.25, 0.25, 0.25), borderWidth: 0.5, color: r === 0 || free ? rgb(0.94, 0.95, 0.95) : rgb(1, 1, 1) });
        const text = r === 0 ? "BINGO"[c] : card.cells[r - 1][c] === null ? "FREI" : String(card.cells[r - 1][c]);
        centered(page, text, r === 0 ? display : body, free ? 11 : 22, cx, cy + 11, cellWidth, r === 0 ? displayFace : bodyFace);
      }
      centered(page, card.code, body, 8, x, y + 16, width, bodyFace);
      // Cut marks outside the card keep all content inside the printable margins.
      for (const dx of [0, width]) for (const dy of [0, height]) {
        const px = x + dx, py = y + dy;
        page.drawLine({ start: { x: px - 4, y: py }, end: { x: px + 4, y: py }, thickness: 0.3, color: rgb(0.6, 0.6, 0.6) });
        page.drawLine({ start: { x: px, y: py - 4 }, end: { x: px, y: py + 4 }, thickness: 0.3, color: rgb(0.6, 0.6, 0.6) });
      }
    }
  }
  return pdf.save();
}
