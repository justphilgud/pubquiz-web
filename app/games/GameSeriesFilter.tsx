"use client";
import EventSeriesPicker from "@/app/workspaces/EventSeriesPicker";
import { gameTypeInfo, type GameType, type GameSeries } from "./gameDraft";
export default function GameSeriesFilter({ type, choices, selected }: { type: GameType; choices: GameSeries[]; selected: number | null }) {
  return <EventSeriesPicker options={choices} value={selected} hrefForValue={id => `${gameTypeInfo[type].path}${id ? `?series=${id}` : ""}`} />;
}