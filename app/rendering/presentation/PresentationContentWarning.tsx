import { presentationContentWarning, type PresentationTextRole } from "./presentationReadability";

export function PresentationContentWarning({ text, role }: { text: string; role: PresentationTextRole }) {
  const warning = presentationContentWarning(text, role);
  return warning ? <p className="mt-2 text-sm text-amber-800" role="status">{warning}</p> : null;
}
