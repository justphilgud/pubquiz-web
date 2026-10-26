"use client";
/* eslint-disable @next/next/no-img-element -- Validated local or managed template assets; preserve native aspect ratios. */
import { useState, type ReactNode, type CSSProperties } from "react";
import type { SharedDesign } from "./sharedDesign";
import styles from "./sharedDesign.module.css";
export type BingoDisplay = { current: string; previous: string[]; kind:"NUMBER"|"PHRASE" };
export type KaraokeDisplay = { title:string; body?:string; image?:string; imageAlt?:string };
function SafeImage({src,alt,className}:{src:string;alt:string;className?:string}){
 const [failed,setFailed]=useState(false);
 return failed?<span className={styles.missing}>Bild nicht verfügbar: {alt}</span>:<img key={src} src={src} alt={alt} className={className} onError={()=>setFailed(true)} />;
}
function DesignFrame({design,children,label}:{design:SharedDesign;children:ReactNode;label:string}){
 const t=design.config.tokens;
 const style={ '--sd-background':t.colors.background,'--sd-surface':t.colors.surface,'--sd-text':t.colors.text,'--sd-muted':t.colors.textMuted,'--sd-primary':t.colors.primary,'--sd-border':t.colors.border,'--sd-display':t.typography.displayFamily??t.typography.family,'--sd-body':t.typography.family,'--sd-radius':t.radii.medium,backgroundImage:t.assets.backgroundImage?`url("${t.assets.backgroundImage}")`:undefined } as CSSProperties;
 return <section className={styles.frame} style={style} data-quiz-theme-version="1" data-shared-design={design.templateId} aria-label={label}><header className={styles.header}><span>{label}</span>{t.assets.logo&&<SafeImage key={t.assets.logo} src={t.assets.logo} alt={design.name} className={styles.logo}/>}</header>{children}<footer className={styles.footer}>Designvorschau · synthetische Inhalte · kein Spielbetrieb</footer></section>;
}
export function BingoDisplayRenderer({design,data}:{design:SharedDesign;data:BingoDisplay}){
 return <DesignFrame design={design} label={data.kind==='NUMBER'?'Bingo · aktuelle Zahl':'Bingo · aktuelle Phrase'}><div className={styles.bingo}><p className={data.kind==='NUMBER'?styles.number:styles.phrase}>{data.current}</p></div><div className={styles.history}><span>Bisherige {data.kind==='NUMBER'?'Zahlen':'Phrasen'}</span><ol>{data.previous.map((v,i)=><li key={i}>{v}</li>)}</ol></div></DesignFrame>;
}
export function KaraokeSlideRenderer({design,data}:{design:SharedDesign;data:KaraokeDisplay}){
 return <DesignFrame design={design} label="PowerPoint-Karaoke"><div className={styles.karaoke}><h2>{data.title}</h2>{data.body&&<p>{data.body}</p>}{data.image&&<SafeImage key={data.image} src={data.image} alt={data.imageAlt??'Folienbild'} className={styles.image}/>}</div></DesignFrame>;
}

