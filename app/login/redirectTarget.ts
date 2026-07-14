const DEFAULT_LOGIN_REDIRECT = "/";

export function getSafeLoginRedirect(callbackUrl: string | undefined) {
  if (
    !callbackUrl ||
    !callbackUrl.startsWith("/") ||
    callbackUrl.startsWith("//")
  ) {
    return DEFAULT_LOGIN_REDIRECT;
  }

  try {
    const target = new URL(callbackUrl, "https://internal.invalid");

    if (target.origin !== "https://internal.invalid") {
      return DEFAULT_LOGIN_REDIRECT;
    }

    if (target.pathname === "/login" || target.pathname === "/logout") {
      return DEFAULT_LOGIN_REDIRECT;
    }

    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return DEFAULT_LOGIN_REDIRECT;
  }
}
