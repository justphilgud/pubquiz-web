import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

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

export const proxy = auth((req) => {
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

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
