"use client";
/* eslint-disable @next/next/no-img-element -- Existing validated shared-design assets, native aspect ratio. */
import { useEffect, useRef, type CSSProperties } from "react";
import type { AudienceView } from "./repository.server";
import styles from "./board.module.css";
export function fitBingoBoard(root: HTMLElement) {
  const width = root.clientWidth, height = root.clientHeight;
  if (!width || !height) return;
  const board = root.querySelector<HTMLElement>("ol");
  const cell = Math.min(((board?.clientWidth ?? width * .72) - 70) / 15, (height - 138) / 5);
  root.style.setProperty("--bingo-cell-edge", `${Math.max(26,cell)}px`);
  root.dataset.fit = cell >= 26 && width >= 640 && height >= 300 ? "fitted" : "unreadable";
  root.style.setProperty("--bingo-cell-font", `${Math.min(68, Math.max(18, cell * .57))}px`);
  root.style.setProperty("--bingo-current-font", `${Math.min(width * .23, (height - 150) * .7)}px`);
  const current = root.querySelector<HTMLElement>("[data-current-number]");
  const area = current?.parentElement;
  if (current && area) {
    const max = Math.min(width * .23, (height - 150) * .7);
    let low = 24, high = max;
    for (let i = 0; i < 9; i++) {
      const size = (low + high) / 2;
      root.style.setProperty("--bingo-current-font", `${size}px`);
      if (current.scrollWidth <= area.clientWidth && current.scrollHeight + 40 <= area.clientHeight) low = size;
      else high = size;
    }
    root.style.setProperty("--bingo-current-font", `${Math.max(24, low - .5)}px`);
  }
}
export default function BingoBoard({ data }: { data: AudienceView }) {
  const ref = useRef<HTMLElement>(null), t = data.design.config.tokens;
  const currentNumber = data.draws.at(-1)?.number;
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const fit = () => fitBingoBoard(root), observer = new ResizeObserver(fit);
    observer.observe(root); fit();
    let disposed = false;
    void document.fonts.ready.then(() => { if (!disposed) fit(); });
    document.fonts.addEventListener("loadingdone", fit);
    document.addEventListener("fullscreenchange", fit);
    return () => { disposed = true; observer.disconnect(); document.fonts.removeEventListener("loadingdone", fit); document.removeEventListener("fullscreenchange", fit); };
  }, [currentNumber]);
  const current = data.draws.at(-1)?.number ?? null, drawn = new Set(data.draws.map(d => d.number));
  const status = data.phase==="BETWEEN"?"Runde beendet · nächste Runde noch nicht gestartet":data.status === "PREPARED" ? "Vorbereitet · noch nicht gestartet" : data.status === "PAUSED" ? "Pause" : data.status === "ENDED" ? "Beendet" : data.draws.length ? "Läuft" : "Bereit für die erste Zahl";
  const feedback = data.claims.filter(c => c.action).at(-1);
  const style = { background: t.colors.background, color: t.colors.text, "--bingo-surface": t.colors.surface,
    "--bingo-primary": t.colors.primary, "--bingo-secondary": t.colors.secondary, "--bingo-ink": t.colors.background, "--bingo-border": t.colors.border,
    "--bingo-radius": t.radii.medium,
    "--bingo-muted": t.colors.textMuted, fontFamily: data.assetBase ? '"Bingo Live Body", sans-serif' : t.typography.family,
    backgroundImage: t.assets.backgroundImage ? `url("${data.assetBase ? data.assetBase + "/background" : t.assets.backgroundImage}")` : undefined } as CSSProperties;
  return <section ref={ref} className={styles.stage} style={style} data-quiz-theme-version="1" aria-label="Bingo-Präsentation" data-run-id={data.id} data-revision={data.revision} data-status={data.status} data-bingo-brand={data.design.templateId === "phil-gud" ? "phil-gud" : undefined}>
    <style>{data.assetBase ? `@font-face{font-family:"Bingo Live Body";font-display:swap;src:url("${data.assetBase}/body")}@font-face{font-family:"Bingo Live Display";font-display:swap;src:url("${data.assetBase}/display")}` : ""}</style>
    <header className={styles.header}><strong style={{ fontFamily: data.assetBase ? '"Bingo Live Display", sans-serif' : t.typography.displayFamily ?? t.typography.family, fontWeight: t.typography.displayWeight }}>{data.label}</strong><span>{status}{data.status !== "PREPARED" && <> · {data.draws.length} / {data.target} Ziehungen</>}</span>{t.assets.logo && <img src={data.assetBase ? `${data.assetBase}/logo` : t.assets.logo} alt={data.design.name} onLoad={() => { if (ref.current) fitBingoBoard(ref.current); }} />}</header>
    <p className={styles.insufficient}>Für das vollständige Zahlenboard ist mehr Platz erforderlich. Bitte ein größeres Fenster oder die Vollbildansicht verwenden.</p>
    <div className={styles.content}><div className={styles.current}><span>Aktuelle Zahl</span><strong data-current-number key={data.draws.at(-1)?.id ?? "empty"}>{current ?? "–"}</strong></div>
    <ol className={styles.board} aria-label="Alle Zahlen von 1 bis 75">{Array.from({ length: 75 }, (_, i) => i + 1).map(n => <li key={n} data-number={n} data-state={n === current ? "current" : drawn.has(n) ? "drawn" : "unseen"} aria-label={`${n}: ${n === current ? "aktuell" : drawn.has(n) ? "gezogen" : "noch nicht gezogen"}`}>{n}</li>)}</ol></div>
    <footer className={styles.footer}><span>Zuletzt: {data.draws.slice(-5).map(d => d.number).join(" · ") || "Noch keine Ziehung"}</span><span aria-live="polite">{feedback ? feedback.needsReview ? "Bingo: Nachprüfung erforderlich" : feedback.action === "CONFIRM" ? "Bingo bestätigt" : feedback.action === "REVOKE" ? "Bestätigung zurückgenommen" : "Bingo-Ruf ungültig" : "Gewinne werden durch die Moderation geprüft."}</span></footer>
  </section>;
}
