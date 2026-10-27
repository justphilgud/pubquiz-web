"use client";
/* eslint-disable @next/next/no-img-element -- Existing validated shared-design assets, native aspect ratio. */
import { useEffect, useRef, type CSSProperties } from "react";
import type { AudienceView } from "./repository.server";
import styles from "./board.module.css";
export function fitBingoBoard(root: HTMLElement) {
  const width = root.clientWidth, height = root.clientHeight;
  if (!width || !height) return;
  const cell = Math.min((width * .72 - 56) / 15, (height - 138) / 5);
  root.dataset.fit = cell >= 26 && width >= 640 && height >= 300 ? "fitted" : "unreadable";
  root.style.setProperty("--bingo-cell-font", `${Math.min(68, Math.max(18, cell * .57))}px`);
  root.style.setProperty("--bingo-current-font", `${Math.min(width * .23, (height - 150) * .7)}px`);
}
export default function BingoBoard({ data }: { data: AudienceView }) {
  const ref = useRef<HTMLElement>(null), t = data.design.config.tokens;
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
  }, []);
  const current = data.draws.at(-1)?.number ?? null, drawn = new Set(data.draws.map(d => d.number));
  const status = data.status === "PAUSED" ? "Pause" : data.status === "ENDED" ? "Beendet" : data.draws.length ? "Läuft" : "Bereit für die erste Zahl";
  const feedback = data.claims.filter(c => c.action).at(-1);
  const style = { background: t.colors.background, color: t.colors.text, "--bingo-surface": t.colors.surface,
    "--bingo-primary": t.colors.primary, "--bingo-border": t.colors.border,
    "--bingo-muted": t.colors.textMuted, fontFamily: t.typography.family,
    backgroundImage: t.assets.backgroundImage ? `url("${t.assets.backgroundImage}")` : undefined } as CSSProperties;
  return <section ref={ref} className={styles.stage} style={style} aria-label="Bingo-Präsentation" data-revision={data.revision} data-status={data.status}>
    <header className={styles.header}><strong style={{ fontFamily: t.typography.displayFamily ?? t.typography.family }}>{data.label}</strong><span>{status} · {data.draws.length} / {data.target} Ziehungen</span>{t.assets.logo && <img src={t.assets.logo} alt={data.design.name} onLoad={() => { if (ref.current) fitBingoBoard(ref.current); }} />}</header>
    <p className={styles.insufficient}>Für das vollständige Zahlenboard ist mehr Platz erforderlich. Bitte ein größeres Fenster oder die Vollbildansicht verwenden.</p>
    <div className={styles.content}><div className={styles.current}><span>Aktuelle Zahl</span><strong key={data.draws.at(-1)?.id ?? "empty"}>{current ?? "–"}</strong></div>
    <ol className={styles.board} aria-label="Alle Zahlen von 1 bis 75">{Array.from({ length: 75 }, (_, i) => i + 1).map(n => <li key={n} data-number={n} data-state={n === current ? "current" : drawn.has(n) ? "drawn" : "unseen"} aria-label={`${n}: ${n === current ? "aktuell" : drawn.has(n) ? "gezogen" : "noch nicht gezogen"}`}>{n}</li>)}</ol></div>
    <footer className={styles.footer}><span>Zuletzt: {data.draws.slice(-5).map(d => d.number).join(" · ") || "Noch keine Ziehung"}</span><span aria-live="polite">{feedback ? feedback.needsReview ? "Bingo: Nachprüfung erforderlich" : feedback.action === "CONFIRM" ? "Bingo bestätigt" : feedback.action === "REVOKE" ? "Bestätigung zurückgenommen" : "Bingo-Ruf ungültig" : "Gewinne werden durch die Moderation geprüft."}</span></footer>
  </section>;
}
