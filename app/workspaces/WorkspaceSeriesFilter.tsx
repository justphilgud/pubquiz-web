"use client";
import { useSearchParams } from "next/navigation";
import { workspaceCollectionHref } from "./workspacePolicy";
import EventSeriesPicker, { type SeriesOption } from "./EventSeriesPicker";
export default function WorkspaceSeriesFilter({ options, seriesId, area, type = "quiz" }: { options: SeriesOption[]; seriesId: number | null; area?: string; type?: "quiz" | "bingo" | "karaoke" }) {
  const params = useSearchParams();
  const href = (id: number | null) => workspaceCollectionHref(id, type, area, params.toString());
  return <div className="mx-auto w-full max-w-6xl px-4 pt-4"><div className="max-w-xl"><EventSeriesPicker options={options} value={seriesId} hrefForValue={href} /></div></div>;
}
