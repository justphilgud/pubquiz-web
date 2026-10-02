type ParticipantLivePoll = {
  runId: number;
  state: "LOCKED" | "OPEN" | "COUNTDOWN" | "CLOSED" | "REVEALED";
  type: "SINGLE_CHOICE" | "FREE_TEXT";
  prompt: string;
  options: { id: string; label: string }[];
  response: {
    selectedOptionId: string | null;
    text: string | null;
  } | null;
};

export default function ParticipantLivePollCard({
  poll,
  position,
  active,
  response,
  text,
  disabled,
  onTextChange,
  onSave,
}: {
  poll: ParticipantLivePoll;
  position: number;
  active: boolean;
  response: ParticipantLivePoll["response"];
  text: string;
  disabled: boolean;
  onTextChange: (value: string) => void;
  onSave: (value: { selectedOptionId?: string; text?: string }) => void;
}) {
  const writable = active && poll.state === "OPEN" && !disabled;
  const stateLabel = writable
    ? "Antwort offen – Änderungen sind bis zum Schließen möglich."
    : poll.state === "OPEN"
      ? "Diese Livefrage ist auf einem anderen Gerät geöffnet."
      : "Die Livefrage ist geschlossen. Deine letzte gültige Antwort bleibt erhalten.";

  return (
    <article
      className={`answer-question rounded-2xl border p-4 ${
        active
          ? "border-cyan-500 bg-cyan-50 ring-2 ring-cyan-100"
          : "border-slate-200 bg-slate-50"
      }`}
      data-live-poll-run-id={poll.runId}
      data-live-poll-active={active ? "true" : "false"}
      aria-current={active ? "step" : undefined}
    >
      <div className="answer-question-meta mb-3 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-slate-500">
        <span>Livefrage {position}</span>
        {active ? (
          <span className="rounded-full bg-cyan-700 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
            Jetzt aktiv
          </span>
        ) : null}
      </div>
      <h3 className="text-lg font-bold text-slate-900">{poll.prompt}</h3>
      <p className="mt-2 text-sm text-slate-600">{stateLabel}</p>

      {poll.type === "SINGLE_CHOICE" ? (
        <div className="mt-4 grid gap-3">
          {poll.options.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={!writable}
              onClick={() => onSave({ selectedOptionId: option.id })}
              className={`min-h-12 rounded-xl border px-4 py-3 text-left font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${
                response?.selectedOptionId === option.id
                  ? "border-cyan-700 bg-white text-cyan-950 ring-2 ring-cyan-100"
                  : "border-slate-300 bg-white text-slate-900 hover:border-cyan-500"
              }`}
            >
              <span aria-hidden className="mr-2">
                {response?.selectedOptionId === option.id ? "●" : "○"}
              </span>
              {option.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <textarea
            className="min-h-28 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            maxLength={500}
            value={active ? text : response?.text ?? ""}
            disabled={!writable}
            onChange={(event) => onTextChange(event.target.value)}
            placeholder="Kurzen Beitrag eingeben …"
          />
          {writable ? (
            <button
              type="button"
              className="answer-primary-button min-h-11 w-full rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-50"
              disabled={!text.trim()}
              onClick={() => onSave({ text })}
            >
              Beitrag senden
            </button>
          ) : null}
          {response?.text ? (
            <p className="text-sm text-slate-600">Gespeichert: {response.text}</p>
          ) : null}
        </div>
      )}
    </article>
  );
}

export type { ParticipantLivePoll };
