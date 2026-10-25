export function contentReturnHref(value: string | null | undefined) {
  if (!value || value.length > 5000 || /[\\\r\n]/.test(value)) return "/content";
  try {
    const url = new URL(value, "https://content.invalid");
    if (url.origin !== "https://content.invalid" || (!/^\/workspaces\/[1-9]\d*\/quiz\/(content|questions|stories|polls)$/.test(url.pathname) && !["/content", "/content/questions", "/content/story-elements", "/content/polls", "/fragen", "/story-elemente", "/umfragen"].includes(url.pathname))) return "/content";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return "/content"; }
}

export type ContentResume = { pages: number; anchor: string | null; offset: number; focus: string | null; index: number };
export function contentResumeKey(pathname: string, paramsKey: string) { return `content-resume:v1:${pathname}?${paramsKey}`; }

export function readContentResume(value: string | null): ContentResume | null {
  try {
    const parsed = JSON.parse(value ?? "null") as ContentResume | null;
    return parsed && Number.isSafeInteger(parsed.pages) && parsed.pages > 0 && parsed.pages <= 10000 &&
      Number.isFinite(parsed.offset) && (parsed.anchor === null || typeof parsed.anchor === "string") &&
      (parsed.focus === null || typeof parsed.focus === "string") && Number.isSafeInteger(parsed.index) && parsed.index >= 0 ? parsed : null;
  } catch { return null; }
}
