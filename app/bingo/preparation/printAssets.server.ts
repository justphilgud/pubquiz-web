import "server-only";
import { readFile, realpath, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import sharp from "sharp";
import { isSafeTemplateAssetReference } from "@/app/rendering/presentationTemplates/presentationTemplateAssets";
import { parseSharedDesign, type SharedDesign } from "@/app/rendering/sharedDesign/sharedDesign";
import { asset, designHash, parsePrintSnapshot, type PrintSnapshot } from "./printSnapshot";
import { BingoPreparationError } from "./policy";

const fonts: Record<string, string> = {
  "geist-sans": "geist", "geist-mono": "geistmono", "source-sans-3": "sourcesans3", "plus-jakarta-sans": "plusjakartasans", "space-grotesk": "spacegrotesk", montserrat: "montserrat", nunito: "nunito", oswald: "oswald", "roboto-slab": "robotoslab", lora: "lora", "playfair-display": "playfairdisplay",
};
export async function printFont(family: string) {
  if (family.startsWith('"Phil Gud Display"')) return asset("Phil Gud Display", await readFile(resolve("public/branding/phil-gud/phil-gud.woff")));
  if (family === "Arial, Helvetica, sans-serif") return asset("Arimo (Arial-kompatibel)", await readFile(resolve("assets/fonts/arimo/Arimo.ttf")));
  if (family === "system-ui, sans-serif") return asset("Geist (druckfähige Systemschrift)", await readFile(resolve("assets/fonts/bingo/geist.ttf")));
  const key = /^var\(--font-([a-z0-9-]+)\)/.exec(family)?.[1];
  if (!key || !fonts[key]) throw new BingoPreparationError("Für die gewählte Schrift ist keine eingebettete Druckschrift verfügbar. Bitte ein unterstütztes Design wählen.");
  return asset(key, await readFile(resolve(`assets/fonts/bingo/${fonts[key]}.ttf`)));
}
/** Template-owned references only, bounded, no redirects, no arbitrary remote hosts. */
export async function loadPrintLogo(reference: string): Promise<Uint8Array> {
  if (!isSafeTemplateAssetReference(reference)) throw new BingoPreparationError("Das Logo ist keine zulässige Bildreferenz.");
  let bytes: Buffer;
  if (reference.startsWith("/")) {
    const root = await realpath(resolve("public"));
    // Keep the actual IO path statically rooted in public for file tracing.
    // Canonical resolution is still mandatory before following any local link.
    const file = join(resolve("public"), decodeURIComponent(reference).slice(1));
    const canonicalFile = await realpath(file);
    if (!canonicalFile.startsWith(root + sep) || (await stat(file)).size > 10 * 1024 * 1024) throw new BingoPreparationError("Das Logo kann nicht sicher für den Druck geladen werden.");
    bytes = await readFile(file);
    if (bytes.length > 10 * 1024 * 1024) throw new BingoPreparationError("Das Logo ist zu groß für den Druck.");
  } else {
    const url = new URL(reference);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".blob.vercel-storage.com") || url.port || url.username || url.password || url.search || url.hash) throw new BingoPreparationError("Das Logo ist keine zulässige Bildreferenz.");
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(5000) });
    if (!response.ok || Number(response.headers.get("content-length")) > 10 * 1024 * 1024 || !response.body) throw new BingoPreparationError("Das Logo konnte nicht geladen werden. Es wurden keine Karten erzeugt.");
    const reader = response.body.getReader(); const parts: Uint8Array[] = []; let size = 0;
    try { for (;;) { const next = await reader.read(); if (next.done) break; size += next.value.length; if (size > 10 * 1024 * 1024) throw new Error("PRINT_LOGO_SIZE"); parts.push(next.value); } } finally { await reader.cancel(); }
    bytes = Buffer.concat(parts);
  }
  return sharp(bytes, { limitInputPixels: 16_000_000 }).resize({ width: 1000, height: 1000, fit: "inside", withoutEnlargement: true }).png().toBuffer();
}
export async function capturePrintSnapshot(input: SharedDesign, title: string, roundLabel: string): Promise<PrintSnapshot> {
  const design = parseSharedDesign(input);
  if (!design) throw new BingoPreparationError("Das ausgewählte Druckdesign ist ungültig.");
  const t = design.config.tokens;
  const [display, body, logo] = await Promise.all([printFont(t.typography.displayFamily ?? t.typography.family), printFont(t.typography.family), t.assets.logo ? loadPrintLogo(t.assets.logo).then(b => asset("Logo", b)) : null]);
  return parsePrintSnapshot({ version: 1, title, roundLabel, design, designHash: designHash(design), display, body, logo });
}
