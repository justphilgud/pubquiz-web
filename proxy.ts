import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
  "/api/quiz/live-snapshot",
];

function isPublicPath(pathname: string) {
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
