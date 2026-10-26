import GameListPage, { type GameQuery } from "@/app/games/GameListPage";
export default function Page({ searchParams }: { searchParams: Promise<GameQuery> }) { return <GameListPage type="POWERPOINT_KARAOKE" searchParams={searchParams} />; }
