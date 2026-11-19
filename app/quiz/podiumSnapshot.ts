import { resolveTeamAvatarCode } from "@/app/teams/teamProfile";

export function readPodiumSnapshot(value: unknown) {
  if (!Array.isArray(value)) return null;
  return value.flatMap((entry: unknown) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    if (typeof item.teamId !== "number" || typeof item.teamname !== "string" || typeof item.punkte !== "number") return [];
    return [{ teamId: item.teamId, teamname: item.teamname, punkte: item.punkte,
      tieBreakPlace: typeof item.tieBreakPlace === "number" ? item.tieBreakPlace : undefined,
      avatarCode: resolveTeamAvatarCode(item.teamId, typeof item.avatarCode === "string" ? item.avatarCode : null),
      photoUrl: typeof item.photoUrl === "string" ? item.photoUrl : null }];
  });
}
