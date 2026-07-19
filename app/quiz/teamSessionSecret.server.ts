import "server-only";

export function getTeamSessionSigningSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET ist für Team-Sessions nicht konfiguriert.");
  }
  return secret;
}
