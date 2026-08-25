export const TEAM_AVATAR_CODES = [
  "teekanne",
  "toaster",
  "giesskanne",
  "tischlampe",
  "wecker",
  "staubsauger",
  "schneebesen",
  "gummistiefel",
  "thermoskanne",
  "buegeleisen",
] as const;

export type TeamAvatarCode = (typeof TEAM_AVATAR_CODES)[number];

export type TeamProfile = {
  teamId: number;
  avatarCode: TeamAvatarCode;
  photoUrl: string | null;
  photoUploadLocked: boolean;
};

export function isTeamAvatarCode(value: unknown): value is TeamAvatarCode {
  return typeof value === "string" && TEAM_AVATAR_CODES.some((code) => code === value);
}

export function getDefaultTeamAvatarCode(teamId: number): TeamAvatarCode {
  const stableIndex = Number.isInteger(teamId) ? Math.abs(teamId) % TEAM_AVATAR_CODES.length : 0;
  return TEAM_AVATAR_CODES[stableIndex];
}

export function resolveTeamAvatarCode(teamId: number, avatarCode: string | null | undefined) {
  return isTeamAvatarCode(avatarCode) ? avatarCode : getDefaultTeamAvatarCode(teamId);
}

export function mapTeamProfile(team: {
  team_id: number;
  avatar_code: string | null;
  foto_url: string | null;
  foto_upload_gesperrt: boolean;
}): TeamProfile {
  return {
    teamId: team.team_id,
    avatarCode: resolveTeamAvatarCode(team.team_id, team.avatar_code),
    photoUrl: team.foto_url,
    photoUploadLocked: team.foto_upload_gesperrt,
  };
}
