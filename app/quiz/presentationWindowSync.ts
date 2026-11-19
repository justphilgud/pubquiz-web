"use client";

import { useEffect, useRef } from "react";

type Position = { key: string; reveal: number };
type Message = { kind: "probe" } | ({ kind: "rendered"; id: string } & Position);
const channelName = (quizId: number) => `pubquiz-presentation-${quizId}`;

/** Render receipt only; navigation and persisted state remain server-authoritative. */
export function usePresentationWindowReceipt(quizId: number) {
  const channel = useRef<BroadcastChannel | null>(null);
  const peers = useRef(new Map<string, { at: number; position: Position }>());
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const connection = new BroadcastChannel(channelName(quizId));
    peers.current.clear();
    channel.current = connection;
    connection.onmessage = ({ data }: MessageEvent<Message>) => {
      if (data.kind === "rendered") peers.current.set(data.id, { at: Date.now(), position: data });
    };
    connection.postMessage({ kind: "probe" });
    return () => { connection.close(); channel.current = null; };
  }, [quizId]);

  return async (position: Position) => {
    const connected = [...peers.current].filter(([, peer]) => Date.now() - peer.at < 4_000).map(([id]) => id);
    if (!connected.length) return;
    const started = performance.now();
    channel.current?.postMessage({ kind: "probe" });
    while (performance.now() - started < 15_000) {
      if (connected.every(id => {
        const peer = peers.current.get(id);
        return peer?.position.key === position.key && peer.position.reveal === position.reveal;
      })) {
        performance.measure("pubquiz-presentation-visible", { start: started, end: performance.now() });
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error("Präsentation bestätigt den Wechsel noch nicht. Präsentationsfenster und Verbindung prüfen, dann „Anzeige erneut prüfen“ wählen.");
  };
}

export function usePresentationRenderReceipt(quizId: number, key: string, reveal: number, ready = true) {
  const rendered = useRef<Position | null>(null);
  const connection = useRef<BroadcastChannel | null>(null);
  const publishReceipt = useRef<() => void>(() => {});
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(channelName(quizId));
    connection.current = channel;
    const id = crypto.randomUUID();
    const publish = () => {
      if (rendered.current) channel.postMessage({ kind: "rendered", id, ...rendered.current });
    };
    publishReceipt.current = publish;
    channel.onmessage = publish;
    const timer = setInterval(publish, 1_000);
    return () => { clearInterval(timer); channel.close(); connection.current = null; publishReceipt.current = () => {}; };
  }, [quizId]);
  useEffect(() => {
    let active = true;
    rendered.current = null;
    if (!ready) return;
    let secondFrame = 0;
    const frame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const animations = document.querySelector(".presentation-template")?.getAnimations({ subtree: true }) ?? [];
        // Only finite ceremony animations delay a receipt, never looping intro media.
        const ceremony = animations.filter(animation => {
          const effect = animation.effect;
          return effect instanceof KeyframeEffect && effect.target instanceof Element &&
            effect.target.closest("[data-podium-ceremony]") && effect.getTiming().iterations !== Infinity;
        });
        void Promise.allSettled(ceremony.map(animation => animation.finished)).then(() => {
          if (active) { rendered.current = { key, reveal }; publishReceipt.current(); }
        });
      });
    });
    return () => { active = false; cancelAnimationFrame(frame); cancelAnimationFrame(secondFrame); };
  }, [key, reveal, ready]);
}
