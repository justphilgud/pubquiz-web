"use server";
import { loadLegacyWorkspaceContext, loadWorkspaceNavigation } from "./workspace.server";
export async function resolveWorkspaceObjectContext(path: string) {
  if (typeof path !== "string" || path.length > 500 || !path.startsWith("/") || /[?\\\r\n]/.test(path)) throw new Error("Ungültiger Kontext");
  const { choices } = await loadWorkspaceNavigation();
  return { path, ...await loadLegacyWorkspaceContext(path, choices) };
}
