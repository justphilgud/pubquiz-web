"use client";
import BingoBoard from "./BingoBoard";
import type { AudienceView } from "./repository.server";
import { useLivePolling } from "./useLivePolling";
export default function AudienceClient({ initial, audienceKey }: { initial: AudienceView; audienceKey: string }) {
  const { data, connected } = useLivePolling(`/api/bingo/presentation/${audienceKey}`, initial);
  return <main style={{ position: "fixed", inset: 0, background: "#fff" }}><BingoBoard data={data} />{!connected && <p role="status" style={{ position: "absolute", bottom: 0, left: 0, background: "#fff", color: "#111", padding: 8 }}>Verbindung unterbrochen · letzter bestätigter Stand</p>}</main>;
}
