/** Explicit management routes only. Public/live/game views never inherit admin CSS. */
export function isAdministrationPath(path: string): boolean {
  if (path === "/templates/presentation-quality") return false;
  if (["/", "/login", "/logout", "/quiz", "/bingo", "/karaoke", "/settings", "/hilfe"].includes(path)) return true;
  if (/^\/(?:admin|content|fragen|story-elemente|templates|profil)(?:\/|$)/.test(path)) return true;
  if (/^\/workspaces\/[1-9]\d*\/(?:settings|quiz|bingo|karaoke)(?:\/|$)/.test(path)) return true;
  return /^\/quiz\/[1-9]\d*(?:\/(?:slides(?:\/[^?#]*)?|auswertung))?$/.test(path);
}
