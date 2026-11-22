import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";
import { startNavigationTrace } from "./app/lib/navigationTrace";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = [
  "/login",
  "/kalender",
  "/calendar/subscribe",
  "/api/auth",
  "/api/quiz/team-live-snapshot",
  "/api/quiz/team-answer-draft",
  "/api/quiz/team-session",
  // This route verifies either a signed team session or manager access itself.
  "/api/quiz/meme-archive",
  "/api/team-profile-photo",
  "/frage-einreichen",
];

function isPublicPath(pathname: string) {
  // Exact API route returns JSON after its own real session/editor-role checks.
  // Do not redirect expired API sessions to an HTML login page.
  if (pathname === "/api/question-rewrite") return true;
  if (pathname === "/api/public/events") return true;
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) return true;

  if (pathname.startsWith("/quiz/") && pathname.endsWith("/antworten")) {
    return true;
  }

  return false;
}

const authenticatedProxy = auth((req) => {
  startNavigationTrace("proxy-after-auth", req.headers.get("x-qa-correlation"))();
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set(
      "callbackUrl",
      `${req.nextUrl.pathname}${req.nextUrl.search}`,
    );
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export async function proxy(...args: Parameters<typeof authenticatedProxy>) {
  const finishTrace = startNavigationTrace("proxy-request", args[0].headers.get("x-qa-correlation"));
  try { return await authenticatedProxy(...args); }
  finally { finishTrace(); }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
