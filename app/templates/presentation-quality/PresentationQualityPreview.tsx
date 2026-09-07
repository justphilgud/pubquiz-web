"use client";

import { useMemo, useState } from "react";
import PresentationSlideRenderer from "@/app/rendering/presentation/PresentationSlideRenderer";
import { buildPresentationQualityFixture, qualityScenarios, type QualityScenario } from "@/app/rendering/presentation/presentationQualityFixtures";
import type { PresentationDesignStyle } from "@/app/rendering/templateRegistry";

/** Internal read-only fixtures, rendered by the production component and shell. */
export function PresentationQualityPreview() {
  const [scenario, setScenario] = useState<QualityScenario>("short");
  const [style, setStyle] = useState<PresentationDesignStyle>("NEON");
  const fixture = useMemo(() => buildPresentationQualityFixture(scenario, style), [scenario, style]);
  return <main className="h-dvh overflow-hidden bg-black p-4">
    <PresentationSlideRenderer key={`${scenario}:${style}`} {...fixture} />
    <details className="fixed bottom-1 left-2 z-[80] max-w-[95vw] rounded-lg bg-white p-2 text-sm text-slate-950 shadow-lg">
      <summary>Interne Präsentationsreferenz</summary>
      <div className="flex flex-wrap gap-3 p-2">
        <label>Inhalt <select aria-label="Referenzinhalt" value={scenario} onChange={(event) => setScenario(event.target.value as QualityScenario)}>{qualityScenarios.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Vorlage <select aria-label="Referenzvorlage" value={style} onChange={(event) => setStyle(event.target.value as PresentationDesignStyle)}><option value="NEON">Standard</option><option value="EDITORIAL">LOVD</option><option value="CORPORATE">Corporate</option><option value="BIRTHDAY">Storybook</option></select></label>
        <p>Nur Referenzdaten · Vorschau bleibt stumm · keine Speicherung</p>
      </div>
    </details>
  </main>;
}
