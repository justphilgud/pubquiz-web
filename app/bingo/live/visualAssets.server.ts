import "server-only";
import type { SharedDesign } from "@/app/rendering/sharedDesign/sharedDesign";
import { printFont, loadPrintLogo } from "../preparation/printAssets.server";
import { asset, type EmbeddedAsset } from "../preparation/printSnapshot";
export type LiveAssets = { version: 1; display: EmbeddedAsset; body: EmbeddedAsset; logo: EmbeddedAsset | null; background: EmbeddedAsset | null };
/** Reuse bounded asset IO, not the independent print-design contract. */
export async function captureLiveAssets(design: SharedDesign): Promise<LiveAssets> {
  const t = design.config.tokens;
  const [display, body, logo, background] = await Promise.all([
    printFont(t.typography.displayFamily ?? t.typography.family), printFont(t.typography.family),
    t.assets.logo ? loadPrintLogo(t.assets.logo).then(bytes => asset("Live logo", bytes)) : null,
    t.assets.backgroundImage ? loadPrintLogo(t.assets.backgroundImage).then(bytes => asset("Live background", bytes)) : null,
  ]);
  return { version: 1, display, body, logo, background };
}
