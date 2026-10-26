import GameEditorPage from "@/app/games/GameEditorPage";
import type { GameQuery } from "@/app/games/GameListPage";
export default function Page({ searchParams }: { searchParams: Promise<GameQuery> }) { return <GameEditorPage type="BINGO" searchParams={searchParams} />; }
