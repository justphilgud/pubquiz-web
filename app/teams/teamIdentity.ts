export const TEAM_NAME_MAX_LENGTH = 120;
export const TEAM_PASSWORD_MAX_LENGTH = 80;

export function normalizeTeamName(value: string) {
  return value.trim().toLocaleLowerCase("de-DE");
}

export function validateTeamName(value: string) {
  const teamName = value.trim();
  if (!teamName) return "Bitte einen Teamnamen eingeben.";
  if (teamName.length > TEAM_NAME_MAX_LENGTH) {
    return `Der Teamname darf höchstens ${TEAM_NAME_MAX_LENGTH} Zeichen lang sein.`;
  }
  return null;
}

export function normalizeTeamPassword(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export function validateTeamPassword(value: string) {
  const password = normalizeTeamPassword(value);
  if (!password) return "Bitte ein Team-Passwort eingeben.";
  if (password.length > TEAM_PASSWORD_MAX_LENGTH) {
    return `Das Team-Passwort darf höchstens ${TEAM_PASSWORD_MAX_LENGTH} Zeichen lang sein.`;
  }
  return null;
}

export function teamPasswordMatches(stored: string | null, supplied: string | null | undefined) {
  if (!stored) return true;
  return stored === normalizeTeamPassword(supplied);
}
