function formatSeconds(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return "--:--";
  }

  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const rest = safeSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0",
    )}:${String(rest).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function secondsSince(startAt: string | null, now: number) {
  if (!startAt) return null;

  return Math.max(0, Math.floor((now - new Date(startAt).getTime()) / 1000));
}

type Props = {
  slideIndex: number;
  slidesLength: number;
  quizStartedAt: string | null;
  now: number;
};

export default function ProgressPanel({
  slideIndex,
  slidesLength,
  quizStartedAt,
  now,
}: Props) {
  const currentSlideNumber = slidesLength === 0 ? 0 : slideIndex + 1;
  const completedSlides = Math.max(0, slideIndex);
  const remainingSlides = Math.max(0, slidesLength - currentSlideNumber);

  const progressPercent =
    slidesLength > 0
      ? Math.round((currentSlideNumber / slidesLength) * 100)
      : 0;

  const elapsedSeconds = secondsSince(quizStartedAt, now);

  const averageSecondsPerCompletedSlide =
    elapsedSeconds !== null && completedSlides > 0
      ? elapsedSeconds / completedSlides
      : null;

  const estimatedRemainingSeconds =
    averageSecondsPerCompletedSlide !== null
      ? Math.round(averageSecondsPerCompletedSlide * remainingSlides)
      : null;

  const estimatedEndAt =
    estimatedRemainingSeconds !== null
      ? new Date(now + estimatedRemainingSeconds * 1000)
      : null;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Fortschritt</h2>
        <div className="text-xl font-black text-cyan-300">
          {progressPercent}%
        </div>
      </div>

      <div className="mb-3 h-3 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-cyan-400 transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-zinc-950 p-2">
          <div className="text-xl font-black">
            {currentSlideNumber} / {slidesLength}
          </div>
          <div className="mt-1 text-xs text-zinc-400">Slides</div>
        </div>

        <div className="rounded-xl bg-zinc-950 p-2">
          <div className="text-xl font-black">{remainingSlides}</div>
          <div className="mt-1 text-xs text-zinc-400">verbleibend</div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-zinc-950 p-2">
          <div className="text-xl font-black" suppressHydrationWarning>
            {formatSeconds(estimatedRemainingSeconds)}
          </div>
          <div className="mt-1 text-xs text-zinc-400">Prognose Rest</div>
        </div>

        <div className="rounded-xl bg-zinc-950 p-2">
          <div className="text-xl font-black" suppressHydrationWarning>
            {estimatedEndAt
              ? estimatedEndAt.toLocaleTimeString("de-DE", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "--:--"}
          </div>
          <div className="mt-1 text-xs text-zinc-400">Prognose Ende</div>
        </div>
      </div>

      {!quizStartedAt && (
        <div className="mt-4 text-sm text-zinc-500">
          Prognose startet, sobald das Quiz gestartet wurde.
        </div>
      )}
    </div>
  );
}
