"use client";
/* eslint-disable @next/next/no-img-element -- Existing validated shared-design assets, native aspect ratio. */
import { useEffect, useRef, type CSSProperties } from "react";
import { contrastRatio } from '@/app/rendering/presentationTemplates/presentationTemplate';
import { PHIL_GUD } from "@/app/branding/philGud";
import type { AudienceView } from "./repository.server";
import styles from "./board.module.css";
import { bingoNumber, BINGO_LETTERS } from './numberDisplay';
import MatchingPresentation from './MatchingPresentation';
import {roundColor} from '../roundColors';
import {LOVD_LIGHT_LOGO,PHIL_PRINT_LOGO} from '../preparation/bingoPrint';
export function fitBingoBoard(root: HTMLElement) {
  const width = root.clientWidth, height = root.clientHeight;
  if (!width || !height) return;
  // Re-measure the actual board after a narrow-window fallback. Measuring a
  // display:none content area would otherwise keep a larger window unreadable.
  delete root.dataset.fit;
  const board = root.querySelector<HTMLElement>("ol");
  const content=root.querySelector<HTMLElement>('[data-board-content]'),currentPanel=root.querySelector<HTMLElement>('[data-current-panel]'),media=root.querySelector<HTMLElement>('[data-media-slot]');
  const availableHeight=(content?.clientHeight??height-138)-(currentPanel?.clientHeight??100)-(media?.clientHeight??0)-24*(media?2:1)-20;
  const cell = Math.min(((board?.clientWidth ?? width) - 75) / 16, availableHeight / 5);
  root.style.setProperty("--bingo-cell-edge", `${Math.max(26,cell)}px`);
  root.dataset.fit = cell >= 26 && width >= 640 && height >= 300 ? "fitted" : "unreadable";
  root.style.setProperty("--bingo-cell-font", `${Math.min(68, Math.max(18, cell * .57))}px`);
  root.style.setProperty("--bingo-current-font", `${Math.min(width * .3, (height - 150) * .34)}px`);
  const current = root.querySelector<HTMLElement>("[data-current-number]");
  const area = current?.parentElement;
  if (current && area) {
    const max = Math.min(width * .3, (height - 150) * .34);
    let low = 24, high = max;
    for (let i = 0; i < 9; i++) {
      const size = (low + high) / 2;
      root.style.setProperty("--bingo-current-font", `${size}px`);
      if (current.scrollWidth <= area.clientWidth && current.scrollHeight + 30 <= area.clientHeight) low = size;
      else high = size;
    }
    root.style.setProperty("--bingo-current-font", `${Math.max(24, low - .5)}px`);
    const heading=area.querySelector<HTMLElement>(':scope > span');
    if(heading){heading.style.width=`${Math.min(area.clientWidth,current.getBoundingClientRect().width)}px`;heading.style.whiteSpace='nowrap';let size=Math.min(74,current.getBoundingClientRect().width/6);heading.style.fontSize=`${size}px`;while(heading.scrollWidth>heading.clientWidth&&size>18){size-=1;heading.style.fontSize=`${size}px`;}}

  }
}
export default function BingoBoard({ data,connected=true }: { data: AudienceView;connected?:boolean }) {
  const ref = useRef<HTMLElement>(null), t = data.design.config.tokens;
  const theme=data.roundNumber?roundColor(data.roundNumber):null;
  const currentNumber = data.draws.at(-1)?.number;
  const mediaMode=Boolean(data.content&&data.content.kind!=='TEXT');
  const currentTerm=data.content?.kind==='TEXT'?data.content.text:currentNumber===undefined?undefined:data.labels?.[currentNumber];
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
  }, [currentNumber,currentTerm,data.termMode,mediaMode]);
  const current = data.draws.at(-1)?.number ?? null, drawn = new Set(data.draws.map(d => d.number));
  const status = data.phase==="BETWEEN"?"Runde beendet · nächste Runde noch nicht gestartet":data.status === "PREPARED" ? "Vorbereitet · noch nicht gestartet" : data.status === "PAUSED" ? "Pause" : data.status === "ENDED" ? "Beendet" : data.draws.length ? "Läuft" : "Bereit für die erste Zahl";

  const style = { background: theme?theme.background:t.colors.background, color: theme?theme.foreground:t.colors.text, "--bingo-surface": theme?`color-mix(in srgb, ${theme.background} 72%, white)`:t.colors.surface,
    ...(theme?{'--bingo-round-color':theme.background,'--bingo-round-ink':theme.foreground}:{}),
    "--bingo-highlight-ink":contrastRatio(t.colors.primary,"#171717")>=contrastRatio(t.colors.primary,"#FFFFFF")?"#171717":"#FFFFFF", "--bingo-primary": t.colors.primary, "--bingo-secondary": t.colors.secondary, "--bingo-ink": t.colors.background, "--bingo-border": theme?'#5F6C76':t.colors.border,
    "--bingo-radius": t.radii.medium,
    "--bingo-muted": theme?theme.foreground:t.colors.textMuted, fontFamily: theme ? '"Bingo Card Display", sans-serif' : data.assetBase ? '"Bingo Live Body", sans-serif' : t.typography.family,
    backgroundImage: !theme&&t.assets.backgroundImage ? `url("${data.assetBase ? data.assetBase + "/background" : t.assets.backgroundImage}")` : undefined } as CSSProperties;
  return <section ref={ref} className={styles.stage} style={style} data-round-number={data.roundNumber} data-quiz-theme-version="1" aria-label="Bingo-Präsentation" data-media-mode={mediaMode?"true":undefined} data-term-mode={data.termMode||data.content?.kind==="TEXT"?"true":undefined} data-run-id={data.id} data-revision={data.revision} data-status={data.status} data-bingo-brand={data.design.templateId === "phil-gud" && t.colors.primary.toLowerCase() === PHIL_GUD.colors.yellow.toLowerCase() && t.colors.secondary.toLowerCase() === PHIL_GUD.colors.pink.toLowerCase() && t.colors.background.toLowerCase() === PHIL_GUD.colors.black.toLowerCase() ? "phil-gud" : undefined}>
    <style>{`@font-face{font-family:"Bingo Card Display";font-display:swap;src:url("/branding/phil-gud/phil-gud.woff") format("woff")}`+(data.assetBase ? `@font-face{font-family:"Bingo Live Body";font-display:swap;src:url("${data.assetBase}/body")}@font-face{font-family:"Bingo Live Display";font-display:swap;src:url("${data.assetBase}/display")}` : "")}</style>
    <header className={styles.header}><strong style={{ fontFamily: theme ? '"Bingo Card Display", sans-serif' : data.assetBase ? '"Bingo Live Display", sans-serif' : t.typography.displayFamily ?? t.typography.family, fontWeight: t.typography.displayWeight }}>{data.label}</strong><span>{status}{data.status !== "PREPARED" && <> · {data.draws.length} / {data.target} Ziehungen</>}</span>{theme&&<div className={styles.partnerLogos}><img src={LOVD_LIGHT_LOGO} alt="LOVD"/><img src={PHIL_PRINT_LOGO} alt="Phil Gud"/></div>}{!theme&&t.assets.logo && <img src={data.assetBase ? `${data.assetBase}/logo` : t.assets.logo} alt={data.design.name} onLoad={() => { if (ref.current) fitBingoBoard(ref.current); }} />}</header>
    <p className={styles.insufficient}>Für das vollständige Zahlenboard ist mehr Platz erforderlich. Bitte ein größeres Fenster oder die Vollbildansicht verwenden.</p>
    <div data-board-content className={styles.content}><div data-current-panel className={styles.current}><span>{mediaMode?'Aktuelle Zahl':data.content?`Kugel ${bingoNumber(current)}`:data.termMode?"Aktueller Begriff":"Aktuelle Zahl"}</span><strong data-current-number key={data.draws.at(-1)?.id ?? "empty"}>{current===null?"–":data.content?.kind==='TEXT'?data.content.text:data.termMode?(data.labels?.[current]??"Verdeckt"):bingoNumber(current)}</strong></div>{mediaMode&&<div data-media-slot className={styles.mediaSlot}><MatchingPresentation key={`${data.id}:${connected?"online":"offline"}`} data={data} connected={connected}/></div>}
    <ol className={styles.board} aria-label="Alle Zahlen von 1 bis 75">{BINGO_LETTERS.flatMap((letter,row)=>[<li className={styles.rowLetter} key={letter} aria-label={`Reihe ${letter}`}>{letter}</li>,...Array.from({length:15},(_,col)=>{const n=row*15+col+1;return <li key={n} data-number={n} data-state={n===current?'current':drawn.has(n)?'drawn':'unseen'} aria-label={`${bingoNumber(n)}: ${n===current?'aktuell':drawn.has(n)?'gezogen':'noch nicht gezogen'}`}>{n}</li>;})])}</ol></div>
    <footer className={styles.footer}><strong>Letzte 10 Ziehungen</strong><ol aria-label="Letzte 10 Ziehungen">{data.draws.slice(-10).reverse().map(d=><li key={d.id}>{bingoNumber(d.number)}</li>)}</ol>{!data.draws.length&&<span>Noch keine Ziehung</span>}</footer>
  </section>;
}
