type AntwortStatus = {
  teamsAngemeldet: number;
  antwortenEingegangen: number;
  prozent: number;
  letzteAntwortAt: string | null;
};

type Props = {
  antwortStatus: AntwortStatus;
};

export default function TeamStatusPanel({ antwortStatus }: Props) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <h2 className="mb-3 text-lg font-semibold">Antworten</h2>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-zinc-950 p-2">
          <div className="text-xl font-black">
            {antwortStatus.teamsAngemeldet}
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">Teams</div>
        </div>

        <div className="rounded-xl bg-zinc-950 p-2">
          <div className="text-xl font-black">
            {antwortStatus.antwortenEingegangen}
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">Antworten</div>
        </div>

        <div className="rounded-xl bg-zinc-950 p-2">
          <div className="text-xl font-black">{antwortStatus.prozent}%</div>
          <div className="mt-1 text-[11px] text-zinc-400">Quote</div>
        </div>
      </div>

      <div className="mt-3 h-3 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-cyan-400"
          style={{ width: `${antwortStatus.prozent}%` }}
        />
      </div>

      <div className="mt-2 text-xs text-zinc-400">
        {antwortStatus.letzteAntwortAt
          ? `Letzte Antwort: ${new Date(
              antwortStatus.letzteAntwortAt,
            ).toLocaleTimeString("de-DE", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}`
          : "Noch keine Antwort eingegangen"}
      </div>
    </div>
  );
}
