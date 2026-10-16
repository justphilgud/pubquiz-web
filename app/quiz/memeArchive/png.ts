import sharp from "sharp";
import { resolve } from "node:path";
import { parseMemeCaptionPayload, memeCaptionPayloadValues } from "../memeCaption";
import { resolveMemeCaptionLayout } from "../memeCaptionZones";
import { getExternalMemeCaptionRowPercent, analyzeMemeCaptionLayout, isMemeCaptionPayloadReadable } from "../memeCaptionLayout";

const WIDTH = 1200;
const HEIGHT = 900;
// Serverless hosts need an explicit font file; Pango otherwise silently renders tofu.
const FONT_FILE = resolve(process.cwd(), "assets/fonts/arimo/Arimo.ttf");
const escapeMarkup = (text: string) => text.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

/** Render only the immutable confirmed payload and layout, never a client screenshot. */
export async function renderArchivedMeme(image: Uint8Array, rawPayload: unknown, rawLayout: unknown) {
  const payload = parseMemeCaptionPayload(rawPayload);
  const layout = resolveMemeCaptionLayout(rawLayout);
  if (!payload || !isMemeCaptionPayloadReadable(payload, layout)) throw new Error("Ungültige Meme-Abgabe.");
  const values = memeCaptionPayloadValues(payload).captions;
  const top = layout.zones.find(z => z.placement === "EXTERNAL_TOP");
  const bottom = layout.zones.find(z => z.placement === "EXTERNAL_BOTTOM");
  const topHeight = Math.round(HEIGHT * getExternalMemeCaptionRowPercent(values[top?.id ?? ""] ?? "", top) / 100);
  const bottomHeight = Math.round(HEIGHT * getExternalMemeCaptionRowPercent(values[bottom?.id ?? ""] ?? "", bottom) / 100);
  const imageHeight = HEIGHT - topHeight - bottomHeight;
  const base = await sharp(image, { limitInputPixels: 40_000_000 }).autoOrient()
    .resize(WIDTH, imageHeight, { fit: "contain", background: "black" }).flatten({ background: "black" }).png().toBuffer();
  const composites: sharp.OverlayOptions[] = [{ input: base, top: topHeight, left: 0 }];
  for (const zone of layout.zones) {
    const text = (values[zone.id] ?? "").trim();
    if (!text) continue;
    const overlay = zone.placement === "IMAGE";
    const x = overlay ? Math.round(WIDTH * zone.x / 100) : 0;
    const y = overlay ? topHeight + Math.round(imageHeight * zone.y / 100) : zone.placement === "EXTERNAL_TOP" ? 0 : HEIGHT - bottomHeight;
    const w = overlay ? Math.round(WIDTH * zone.width / 100) : WIDTH;
    const h = overlay ? Math.round(imageHeight * zone.height / 100) : zone.placement === "EXTERNAL_TOP" ? topHeight : bottomHeight;
    if (overlay) composites.push({ input: await sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: .55 } } }).png().toBuffer(), left: x, top: y });
    const width = w - 72;
    const availableHeight = h - 18;
    const analysis = analyzeMemeCaptionLayout(text, zone, imageHeight / 12, h / 12);
    const minimum = overlay ? 54 : 27;
    let rendered: Buffer | null = null;
    let dimensions: sharp.Metadata | null = null;
    for (let size = Math.min(76, Math.round(analysis.fontSizeCqw * 12)); size >= minimum; size--) {
      const candidate = await sharp({ text: { text: `<span foreground="white" weight="bold">${escapeMarkup(text)}</span>`, font: `Arimo Bold ${size}`, fontfile: FONT_FILE, width, align: "centre", wrap: "word-char", rgba: true, dpi: 72 } }).png().toBuffer();
      const metadata = await sharp(candidate).metadata();
      if (metadata.height! <= availableHeight && metadata.height! <= size * 1.3 * zone.maxLines) { rendered = candidate; dimensions = metadata; break; }
    }
    if (!rendered || !dimensions) throw new Error("Beschriftung passt nicht lesbar in das gespeicherte Layout.");
    composites.push({ input: rendered, left: x + Math.round((w - dimensions.width!) / 2), top: y + Math.round((h - dimensions.height!) / 2) });
  }
  return sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: "black" } }).composite(composites).png().toBuffer();
}
