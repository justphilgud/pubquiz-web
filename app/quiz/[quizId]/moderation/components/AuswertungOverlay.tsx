"use client";

type Props = {
  quizId: number;
  dialogOpen: boolean;
  iframeOpen: boolean;
  onAuswertungOeffnen: () => void;
  onDialogSchliessen: () => void;
  onIframeSchliessen: () => void;
};

export default function AuswertungOverlay({
  quizId,
  dialogOpen,
  iframeOpen,
  onAuswertungOeffnen,
  onDialogSchliessen,
  onIframeSchliessen,
}: Props) {
  return (
    <>
      {dialogOpen && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/75 p-6">
          <div className="w-full max-w-xl rounded-3xl border border-zinc-700 bg-zinc-900 p-8 text-white shadow-2xl">
            <div className="mb-4 text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
              Antwortzeit beendet
            </div>

            <h2 className="mb-4 text-3xl font-black">
              Die Antworten sind eingefroren.
            </h2>

            <p className="mb-8 text-lg text-zinc-300">
              Der zuletzt automatisch gespeicherte Stand zählt. Änderungen sind
              ab jetzt nicht mehr möglich.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onAuswertungOeffnen}
                className="rounded-xl bg-cyan-500 px-5 py-3 font-bold text-black hover:bg-cyan-400"
              >
                Auswertung öffnen
              </button>

              <button
                type="button"
                onClick={onDialogSchliessen}
                className="rounded-xl bg-zinc-700 px-5 py-3 font-bold hover:bg-zinc-600"
              >
                Später
              </button>
            </div>
          </div>
        </div>
      )}

      {iframeOpen && (
        <div className="fixed inset-0 z-10000 flex flex-col bg-zinc-950 p-4 text-white">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">
                Auswertung
              </div>

              <div className="text-xl font-black">Quiz {quizId}</div>
            </div>

            <button
              type="button"
              onClick={onIframeSchliessen}
              className="rounded-xl bg-zinc-800 px-4 py-2 font-bold hover:bg-zinc-700"
            >
              Schließen
            </button>
          </div>

          <iframe
            title={`Auswertung Quiz ${quizId}`}
            src={`/quiz/${quizId}/auswertung`}
            className="min-h-0 flex-1 rounded-2xl border border-zinc-700 bg-white"
          />
        </div>
      )}
    </>
  );
}
