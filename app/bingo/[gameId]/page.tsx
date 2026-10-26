import GameEditorPage from "@/app/games/GameEditorPage";
import type { GameQuery } from "@/app/games/GameListPage";
export default async function Page({ params, searchParams }: { params: Promise<{ gameId: string }>; searchParams: Promise<GameQuery> }) { const { gameId } = await params; return <GameEditorPage type="BINGO" id={gameId} searchParams={searchParams} />; }
