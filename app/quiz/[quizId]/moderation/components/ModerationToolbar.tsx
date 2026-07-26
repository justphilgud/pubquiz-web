import {
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  BackwardIcon,
  ChartBarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  EyeIcon,
  LockClosedIcon,
  LockOpenIcon,
  PhotoIcon,
  PlayIcon,
  ScaleIcon,
  SpeakerWaveIcon,
  StopIcon,
} from "@heroicons/react/24/outline";

import { Button, IconButton } from "@/components/ui";

function formatSeconds(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return "--:--";
  }

  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const rest = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

type Props = {
  blockFreigegeben: boolean;
  mediumOverlayAktiv: boolean;
  audioLaeuft: boolean;
  hatMedien: boolean;
  hatAudio: boolean;
  istCountdownSlide: boolean;
  countdownDauerMinuten: number;
  countdownRestSekunden: number;
  showSchaetzfrageControls: boolean;

  onZurErstenSlide: () => void;
  onZurueck: () => void;
  onWeiter: () => void;
  onBlockToggle: () => void | Promise<void>;
  onMediumToggle: () => void | Promise<void>;
  onAudioToggle: () => void | Promise<void>;
  onAuswertungOeffnen: () => void;
  onSchaetzfrageStarten: () => void | Promise<void>;
  onSchaetzfrageLoesungZeigen: () => void | Promise<void>;
  onSchaetzfrageZurueck: () => void | Promise<void>;
  onCountdownDauerChange: (value: number) => void;
  onCountdownStart: () => void | Promise<void>;
  onCountdownReset: () => void | Promise<void>;
  onQuizBeenden: () => void;
};

export default function ModerationToolbar({
  blockFreigegeben,
  mediumOverlayAktiv,
  audioLaeuft,
  hatMedien,
  hatAudio,
  istCountdownSlide,
  countdownDauerMinuten,
  countdownRestSekunden,
  showSchaetzfrageControls,
  onZurErstenSlide,
  onZurueck,
  onWeiter,
  onBlockToggle,
  onMediumToggle,
  onAudioToggle,
  onAuswertungOeffnen,
  onSchaetzfrageStarten,
  onSchaetzfrageLoesungZeigen,
  onSchaetzfrageZurueck,
  onCountdownDauerChange,
  onCountdownStart,
  onCountdownReset,
  onQuizBeenden,
}: Props) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <IconButton
          icon={BackwardIcon}
          label="Zur ersten Slide"
          onClick={onZurErstenSlide}
        />
        <IconButton icon={ChevronLeftIcon} label="Zurück" onClick={onZurueck} />
        <IconButton
          icon={ChevronRightIcon}
          label="Weiter"
          tone="primary"
          onClick={onWeiter}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <IconButton
          icon={blockFreigegeben ? LockClosedIcon : LockOpenIcon}
          label={blockFreigegeben ? "Block schließen" : "Block freigeben"}
          tone={blockFreigegeben ? "warning" : "success"}
          onClick={onBlockToggle}
        />

        <IconButton
          icon={PhotoIcon}
          label={
            hatMedien
              ? "Bild anzeigen / schließen"
              : "Kein Medium auf diesem Slide"
          }
          tone="violet"
          active={mediumOverlayAktiv}
          disabled={!hatMedien}
          onClick={onMediumToggle}
        />

        <IconButton
          icon={SpeakerWaveIcon}
          label={
            hatAudio
              ? "Audio/Video abspielen oder pausieren"
              : "Kein abspielbares Medium auf diesem Slide"
          }
          tone="pink"
          active={audioLaeuft}
          disabled={!hatAudio}
          onClick={onAudioToggle}
        />

        <IconButton
          icon={ChartBarIcon}
          label="Auswertung öffnen"
          onClick={onAuswertungOeffnen}
        />

        {showSchaetzfrageControls && (
          <>
            <IconButton
              icon={ScaleIcon}
              label="Schätzfrage starten"
              tone="violet"
              onClick={onSchaetzfrageStarten}
            />
            <IconButton
              icon={EyeIcon}
              label="Lösung zeigen"
              tone="warning"
              onClick={onSchaetzfrageLoesungZeigen}
            />
            <IconButton
              icon={ArrowUturnLeftIcon}
              label="Zurück zum Endstand"
              onClick={onSchaetzfrageZurueck}
            />
          </>
        )}
      </div>

      <div
        className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
          istCountdownSlide
            ? "border-zinc-700 bg-zinc-900"
            : "border-zinc-800 bg-zinc-900/50"
        }`}
      >
        <ClockIcon
          className={`h-5 w-5 ${istCountdownSlide ? "text-cyan-300" : "text-zinc-600"}`}
        />

        <input
          type="number"
          min={1}
          value={countdownDauerMinuten}
          disabled={!istCountdownSlide}
          onChange={(event) =>
            onCountdownDauerChange(Number(event.target.value))
          }
          className={`w-20 rounded-lg border px-2 py-1 text-right pr-2 text-sm font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
            istCountdownSlide
              ? "border-zinc-700 bg-zinc-950 text-white"
              : "cursor-not-allowed border-zinc-800 bg-zinc-950 text-zinc-600"
          }`}
        />

        <span
          className={`text-xs ${istCountdownSlide ? "text-zinc-400" : "text-zinc-600"}`}
        >
          min
        </span>

        <div
          className={`w-16 text-center text-sm font-black ${istCountdownSlide ? "text-cyan-300" : "text-zinc-600"}`}
        >
          {formatSeconds(countdownRestSekunden)}
        </div>

        <IconButton
          icon={PlayIcon}
          label="Countdown starten"
          tone="success"
          disabled={!istCountdownSlide}
          onClick={onCountdownStart}
          className="rounded-lg p-2 [&>svg]:h-4 [&>svg]:w-4"
        />

        <IconButton
          icon={ArrowPathIcon}
          label="Countdown zurücksetzen"
          disabled={!istCountdownSlide}
          onClick={onCountdownReset}
          className="rounded-lg p-2 [&>svg]:h-4 [&>svg]:w-4"
        />
      </div>

      <div className="ml-auto pt-3">
        <Button
          type="button"
          variant="danger"
          onClick={onQuizBeenden}
          className="gap-2"
        >
          <StopIcon className="h-5 w-5" />
          Quiz beenden
        </Button>
      </div>
    </div>
  );
}
