import { notFound } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import { loadWorkspaceNavigation } from "./workspace.server";
import { getNavigationCapabilities } from "./workspacePolicy";
import WorkspaceSeriesFilter from "./WorkspaceSeriesFilter";
export default async function PreparedEventTypePage({ type }: { type: "BINGO" | "POWERPOINT_KARAOKE" }) {
  const { actor, choices } = await loadWorkspaceNavigation();
  const capabilities = getNavigationCapabilities(actor, choices);
  if (!(type === "BINGO" ? capabilities.bingo : capabilities.karaoke)) notFound();
  const options = choices.filter(choice => choice.eventTypes.includes(type));
  return <><AppHeader /><main className="mx-auto max-w-6xl space-y-4 px-4 py-8"><h1 className="text-3xl font-bold">{type === "BINGO" ? "Bingo" : "PowerPoint-Karaoke"}</h1><p className="text-lg font-semibold">Noch nicht verfügbar</p><p>Für diese Eventart sind noch keine Spielfunktionen implementiert.</p><p className="text-sm text-slate-600">Freigeschaltete und für dich erlaubte Eventreihen:</p><WorkspaceSeriesFilter options={options} seriesId={null} type={type === "BINGO" ? "bingo" : "karaoke"} />{!options.length && <p className="text-sm text-slate-600">Keine passende Eventreihe freigeschaltet. Produktfreigaben werden ausschließlich bei Eventreihen gepflegt.</p>}</main></>;
}
