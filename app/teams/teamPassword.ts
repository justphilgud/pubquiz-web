import { randomInt } from "node:crypto";
import { TEAM_PASSWORT_WOERTER } from "@/app/lib/teamPasswortWoerter";

export function generateTeamPassword() {
  return TEAM_PASSWORT_WOERTER[randomInt(TEAM_PASSWORT_WOERTER.length)];
}
