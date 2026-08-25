import { TEAM_PASSWORT_WOERTER } from "@/app/lib/teamPasswortWoerter";

export function generateTeamPassword(random: () => number = Math.random) {
  const index = Math.min(
    Math.floor(random() * TEAM_PASSWORT_WOERTER.length),
    TEAM_PASSWORT_WOERTER.length - 1,
  );
  return TEAM_PASSWORT_WOERTER[Math.max(0, index)];
}
