"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { MemeRenderer } from "@/app/rendering/meme/MemeRenderer";
import {
  applyMemeCaptionZonePreset,
  createMemeCaptionZone,
  DEFAULT_MEME_CAPTION_LAYOUT,
  getStrongMemeCaptionZoneOverlaps,
  MEME_CAPTION_ZONE_MAX_COUNT,
  MEME_CAPTION_ZONE_MIN_SIZE_PERCENT,
  MEME_CAPTION_ZONE_PRESETS,
  parseMemeCaptionLayoutConfig,
  resolveMemeCaptionLayout,
  STANDARD_MEME_CAPTION_ZONES,
  type MemeCaptionLayoutConfig,
  type MemeCaptionZone,
} from "@/app/quiz/memeCaptionZones";

type Props = {
  value: MemeCaptionLayoutConfig | undefined;
  imageUrl: string | null;
  disabled: boolean;
  validationError?: string | null;
  onChange: (value: MemeCaptionLayoutConfig) => void;
};

type Gesture = {
  kind: "MOVE" | "RESIZE";
  zoneId: string;
  startX: number;
  startY: number;
  zone: MemeCaptionZone;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.round(Math.min(maximum, Math.max(minimum, value)) * 10) / 10;
}

function nextZoneId(zones: readonly MemeCaptionZone[]) {
  for (let index = 1; index <= MEME_CAPTION_ZONE_MAX_COUNT + 1; index += 1) {
    const id = `caption-${index}`;
    if (!zones.some((zone) => zone.id === id)) return id;
  }
  return `caption-${zones.length + 1}`;
}

export function MemeCaptionLayoutEditor({ value, imageUrl, disabled, validationError, onChange }: Props) {
  const layout = value?.mode === "CUSTOM"
    ? { ...value, zones: value.zones }
    : resolveMemeCaptionLayout(value ?? DEFAULT_MEME_CAPTION_LAYOUT);
  const zones = layout.zones;
  const [selectedId, setSelectedId] = useState<string>(zones[0]?.id ?? "top");
  const [testCaptions, setTestCaptions] = useState<Record<string, string>>({});
  const gesture = useRef<Gesture | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const selected = zones.find((zone) => zone.id === selectedId) ?? zones[0];
  const overlaps = getStrongMemeCaptionZoneOverlaps(zones);
  const valid = parseMemeCaptionLayoutConfig(
    layout.mode === "STANDARD" ? DEFAULT_MEME_CAPTION_LAYOUT : layout,
  ) !== null;

  const commitZones = (next: MemeCaptionZone[]) => {
    const ordered = [...next]
      .sort((left, right) => left.order - right.order)
      .map((zone, index) => ({ ...zone, order: index + 1 }));
    onChange({ version: 1, mode: "CUSTOM", zones: ordered });
  };

  const updateSelected = (patch: Partial<MemeCaptionZone>) => {
    if (!selected || layout.mode !== "CUSTOM") return;
    commitZones(zones.map((zone) => zone.id === selected.id ? { ...zone, ...patch } : zone));
  };

  const startGesture = (
    event: ReactPointerEvent<HTMLElement>,
    zone: MemeCaptionZone,
    kind: Gesture["kind"],
  ) => {
    if (disabled || zone.placement !== "IMAGE") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {
      kind,
      zoneId: zone.id,
      startX: event.clientX,
      startY: event.clientY,
      zone,
    };
    setSelectedId(zone.id);
  };

  const moveGesture = (event: ReactPointerEvent<HTMLElement>) => {
    const active = gesture.current;
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!active || !bounds || layout.mode !== "CUSTOM") return;
    const dx = ((event.clientX - active.startX) / bounds.width) * 100;
    const dy = ((event.clientY - active.startY) / bounds.height) * 100;
    if (active.kind === "MOVE") {
      commitZones(zones.map((zone) => zone.id === active.zoneId ? {
        ...zone,
        x: clamp(active.zone.x + dx, 0, 100 - active.zone.width),
        y: clamp(active.zone.y + dy, 0, 100 - active.zone.height),
      } : zone));
    } else {
      commitZones(zones.map((zone) => zone.id === active.zoneId ? {
        ...zone,
        width: clamp(active.zone.width + dx, MEME_CAPTION_ZONE_MIN_SIZE_PERCENT, 100 - active.zone.x),
        height: clamp(active.zone.height + dy, MEME_CAPTION_ZONE_MIN_SIZE_PERCENT, 100 - active.zone.y),
      } : zone));
    }
  };

  const endGesture = () => {
    gesture.current = null;
  };

  return (
    <section data-meme-caption-layout-editor className="space-y-5 rounded-2xl border border-fuchsia-200 bg-white p-4">
      <div>
        <h2 className="font-semibold">Caption-Layout</h2>
        <p className="mt-1 text-sm text-slate-600">Das Layout gehört zur Frage. Teams geben später nur die Texte ein.</p>
      </div>
      {validationError ? <p role="alert" className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{validationError}</p> : null}

      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="sr-only">Caption-Layout auswählen</legend>
        {([
          ["STANDARD", "Standard: oben / unten"],
          ["CUSTOM", "Benutzerdefinierte Zonen"],
        ] as const).map(([mode, label]) => (
          <label key={mode} className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-300 px-3 py-2 font-medium">
            <input
              type="radio"
              name="meme-caption-layout-mode"
              checked={layout.mode === mode}
              disabled={disabled}
              onChange={() => {
                if (mode === "STANDARD") {
                  setSelectedId("top");
                  onChange(DEFAULT_MEME_CAPTION_LAYOUT);
                } else {
                  const customZones = STANDARD_MEME_CAPTION_ZONES.map((zone) => ({ ...zone }));
                  setSelectedId(customZones[0].id);
                  onChange({ version: 1, mode: "CUSTOM", zones: customZones });
                }
              }}
            />
            {label}
          </label>
        ))}
      </fieldset>

      {layout.mode === "CUSTOM" ? (
        <>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
            <div className="space-y-3">
              <div
                ref={canvasRef}
                data-meme-zone-canvas
                className="relative aspect-[4/3] touch-none overflow-hidden rounded-2xl bg-slate-950"
                onPointerMove={moveGesture}
                onPointerUp={endGesture}
                onPointerCancel={endGesture}
              >
                {imageUrl ? (
                  // Dynamic editor media can be a Blob URL without build-time dimensions.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt="Meme-Motiv für Caption-Zonen" className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm font-semibold text-white/70">Bild oben im Medienbereich hinzufügen</div>
                )}
                {zones.filter((zone) => zone.placement === "IMAGE").map((zone) => (
                  <div
                    key={zone.id}
                    role="button"
                    tabIndex={disabled ? -1 : 0}
                    aria-label={`${zone.label} verschieben`}
                    aria-pressed={zone.id === selected?.id}
                    className={`absolute cursor-move border-2 bg-fuchsia-500/25 text-left text-xs font-bold text-white outline-none ${zone.id === selected?.id ? "border-cyan-300 ring-2 ring-cyan-300/40" : "border-fuchsia-200"}`}
                    style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%` }}
                    onClick={() => setSelectedId(zone.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") setSelectedId(zone.id);
                    }}
                    onPointerDown={(event) => startGesture(event, zone, "MOVE")}
                  >
                    <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5">{zone.order}. {zone.label}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`${zone.label} skalieren`}
                      className="absolute bottom-0 right-0 h-6 w-6 cursor-se-resize border-l-2 border-t-2 border-white bg-fuchsia-700"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        startGesture(event, zone, "RESIZE");
                      }}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-600">Zonen im Bild lassen sich mit Maus oder Touch verschieben und am Griff unten rechts skalieren.</p>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {zones.map((zone) => (
                  <button key={zone.id} type="button" disabled={disabled} onClick={() => setSelectedId(zone.id)}
                    className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold ${zone.id === selected?.id ? "border-fuchsia-600 bg-fuchsia-50" : "border-slate-300"}`}>
                    {zone.order}. {zone.label}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={disabled || zones.length >= MEME_CAPTION_ZONE_MAX_COUNT}
                  className="min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"
                  onClick={() => {
                    const zone = createMemeCaptionZone(zones.length + 1);
                    zone.id = nextZoneId(zones);
                    commitZones([...zones, zone]);
                    setSelectedId(zone.id);
                  }}
                >+ Zone</button>
              </div>

              {selected ? (
                <div className="space-y-3 rounded-xl bg-slate-50 p-3">
                  <label className="block text-sm font-medium">Feldname für Teams
                    <input className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3" value={selected.label} disabled={disabled}
                      onChange={(event) => updateSelected({ label: event.target.value })}
                      onBlur={() => {
                        if (!selected.label.trim()) updateSelected({ label: `Text ${selected.order}` });
                      }} />
                  </label>
                  <div>
                    <p className="text-sm font-medium">Preset</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {MEME_CAPTION_ZONE_PRESETS.map((preset) => (
                        <button key={preset.id} type="button" disabled={disabled}
                          className="min-h-10 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
                          onClick={() => updateSelected(applyMemeCaptionZonePreset(selected, preset))}>
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {selected.placement === "IMAGE" ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {(["x", "y", "width", "height"] as const).map((key) => (
                        <label key={key} className="text-xs font-medium">{{ x: "X", y: "Y", width: "Breite", height: "Höhe" }[key]} (%)
                          <input type="number" min={key === "width" || key === "height" ? MEME_CAPTION_ZONE_MIN_SIZE_PERCENT : 0} max={100} step="0.5"
                            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-2" value={selected[key]} disabled={disabled}
                            onChange={(event) => {
                              const number = Number(event.target.value);
                              if (!Number.isFinite(number)) return;
                              if (key === "x") updateSelected({ x: clamp(number, 0, 100 - selected.width) });
                              else if (key === "y") updateSelected({ y: clamp(number, 0, 100 - selected.height) });
                              else if (key === "width") updateSelected({ width: clamp(number, MEME_CAPTION_ZONE_MIN_SIZE_PERCENT, 100 - selected.x) });
                              else updateSelected({ height: clamp(number, MEME_CAPTION_ZONE_MIN_SIZE_PERCENT, 100 - selected.y) });
                            }} />
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600">Außenbereiche verwenden die feste, bewährte AP5-Höhe von 21 %.</p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-sm font-medium">Maximale Zeilen
                      <select className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3" value={selected.maxLines} disabled={disabled}
                        onChange={(event) => updateSelected({ maxLines: Number(event.target.value) as 1 | 2 | 3 })}>
                        <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
                      </select>
                    </label>
                    <label className="flex min-h-11 items-center gap-2 pt-6 text-sm font-medium">
                      <input type="checkbox" checked={selected.required} disabled={disabled} onChange={(event) => updateSelected({ required: event.target.checked })} />
                      Erforderlich
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={disabled || selected.order === 1}
                      className="min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
                      onClick={() => {
                        const previous = zones.find((zone) => zone.order === selected.order - 1);
                        if (!previous) return;
                        commitZones(zones.map((zone) => zone.id === selected.id ? { ...zone, order: previous.order } : zone.id === previous.id ? { ...zone, order: selected.order } : zone));
                      }}>Früher</button>
                    <button type="button" disabled={disabled || selected.order === zones.length}
                      className="min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
                      onClick={() => {
                        const next = zones.find((zone) => zone.order === selected.order + 1);
                        if (!next) return;
                        commitZones(zones.map((zone) => zone.id === selected.id ? { ...zone, order: next.order } : zone.id === next.id ? { ...zone, order: selected.order } : zone));
                      }}>Später</button>
                  </div>
                  <button type="button" disabled={disabled || zones.length <= 1}
                    className="min-h-11 rounded-xl border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
                    onClick={() => {
                      const remaining = zones.filter((zone) => zone.id !== selected.id);
                      commitZones(remaining);
                      setSelectedId(remaining[0]?.id ?? "");
                    }}>Zone entfernen</button>
                </div>
              ) : null}
            </div>
          </div>

          {overlaps.length > 0 ? (
            <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">
              Starke Überlappung: Prüfe die markierten Caption-Zonen, damit Texte nicht übereinander liegen.
            </p>
          ) : null}
          {!valid ? <p role="alert" className="text-sm font-semibold text-red-700">Das Caption-Layout ist ungültig und kann nicht freigegeben werden.</p> : null}
        </>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Testtext</h3>
          {zones.map((zone) => (
            <label key={zone.id} className="block text-sm">{zone.label}
              <input className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3" value={testCaptions[zone.id] ?? ""}
                onChange={(event) => setTestCaptions((current) => ({ ...current, [zone.id]: event.target.value }))}
                placeholder={`Test für ${zone.label}`} />
            </label>
          ))}
        </div>
        {imageUrl ? (
          <div>
            <h3 className="mb-2 text-sm font-semibold">Vorschau</h3>
            <MemeRenderer imageUrl={imageUrl} alt="Vorschau des Caption-Layouts" captions={testCaptions} layout={layout} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
