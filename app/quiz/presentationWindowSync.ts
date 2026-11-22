"use client";

import { useEffect, useRef } from "react";

type Position = { key: string; reveal: number };
type Peer = { at: number; position: Position };
type Message = { kind: "probe" } | ({ kind: "applied" | "rendered"; id: string } & Position);
const channelName = (quizId: number) => `pubquiz-presentation-${quizId}`;

export async function waitForPresentationPosition(position: Position, peers: Map<string, Peer>, probe: () => void,
  clock = { now: () => Date.now(), sleep: () => new Promise<void>(resolve => setTimeout(resolve, 50)) }, timeout = 15_000) {
  const connected = [...peers].filter(([, peer]) => clock.now() - peer.at < 4_000).map(([id]) => id);
  if (!connected.length) return true;
  const started = clock.now();
  probe();
  while (clock.now() - started < timeout) {
    if (connected.every(id => {
      const peer = peers.get(id);
      return peer?.position.key === position.key && peer.position.reveal === position.reveal;
    })) return true;
    await clock.sleep();
  }
  return false;
}

export function respondToPresentationProbe(data: unknown, publish: () => void) {
  if (data && typeof data === "object" && "kind" in data && data.kind === "probe") publish();
}

/** Render receipt only; navigation and persisted state remain server-authoritative. */
export function usePresentationWindowReceipt(quizId: number, onApplied?: (position: Position) => void) {
  const channel = useRef<BroadcastChannel | null>(null);
  const peers = useRef(new Map<string, Peer>());
  const notify = useRef(onApplied);
  useEffect(() => { notify.current = onApplied; }, [onApplied]);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const connection = new BroadcastChannel(channelName(quizId));
    peers.current.clear();
    channel.current = connection;
    connection.onmessage = ({ data }: MessageEvent<Message>) => {
      if (data.kind === "applied" || data.kind === "rendered") {
        peers.current.set(data.id, { at: Date.now(), position: data });
        notify.current?.(data);
      }
    };
    connection.postMessage({ kind: "probe" });
    return () => { connection.close(); channel.current = null; };
  }, [quizId]);

  return async (position: Position) => {
    const started = performance.now();
    const confirmed = await waitForPresentationPosition(position, peers.current, () => channel.current?.postMessage({ kind: "probe" }));
    if (confirmed) performance.measure("pubquiz-presentation-applied", { start: started, end: performance.now() });
    return confirmed;
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
      if (rendered.current) channel.postMessage({ kind: "applied", id, ...rendered.current });
    };
    publishReceipt.current = publish;
    channel.onmessage = ({ data }) => respondToPresentationProbe(data, publish);
    const timer = setInterval(publish, 1_000);
    return () => { clearInterval(timer); channel.close(); connection.current = null; publishReceipt.current = () => {}; };
  }, [quizId]);
  useEffect(() => {
    rendered.current = null;
    if (!ready) return;
    // React has committed the target. Background tabs can suspend rAF indefinitely;
    // acknowledging application must never depend on focus, paint or animation.
    rendered.current = { key, reveal };
    publishReceipt.current();
    return () => { rendered.current = null; };
  }, [key, reveal, ready]);
}
