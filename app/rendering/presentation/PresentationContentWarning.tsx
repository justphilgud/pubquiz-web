import { presentationContentWarning, type PresentationTextRole } from "./presentationReadability";

export function PresentationContentWarning({ text, role }: { text: string; role: PresentationTextRole }) {
  const warning = presentationContentWarning(text, role);
  return warning ? <div className="presentation-content-warning mt-2 text-sm text-amber-800" role="status">
    <p className="presentation-content-warning-desktop">{warning}</p>
    <details className="presentation-content-warning-mobile"><summary>Präsentationshinweis · {text.length} Zeichen</summary><p>{warning}</p></details>
  </div> : null;
}
