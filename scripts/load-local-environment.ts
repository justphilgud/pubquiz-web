import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { processEnv } from "@next/env";

export const LOCAL_ENV_FILE = ".env.development.local";

const LOCAL_MANAGED_VARIABLES = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "NEXTAUTH_SECRET",
  "AUTH_TRUST_HOST",
  "AUTH_URL",
  "NEXTAUTH_URL",
  "NEXT_PUBLIC_APP_ENV",
  "MEDIA_UPLOAD_ENV",
  "BLOB_READ_WRITE_TOKEN",
  "BLOB_WEBHOOK_PUBLIC_KEY",
  "VERCEL_BLOB_CALLBACK_URL",
  "PRODUCTION_DATABASE_HOST",
] as const;

export function loadLocalEnvironment(options?: { required?: boolean }) {
  if (
    process.env.VERCEL === "1" ||
    (Boolean(process.env.CI) && process.env.CI !== "false")
  ) {
    return { loaded: false, path: null } as const;
  }

  const path = resolve(process.cwd(), LOCAL_ENV_FILE);

  if (!existsSync(path)) {
    if (options?.required) {
      throw new Error(`${LOCAL_ENV_FILE} fehlt.`);
    }

    return { loaded: false, path } as const;
  }

  const loadedFile = {
    path: LOCAL_ENV_FILE,
    contents: readFileSync(path, "utf8"),
    env: {} as Record<string, string | undefined>,
  };

  for (const name of LOCAL_MANAGED_VARIABLES) {
    delete process.env[name];
  }

  processEnv([loadedFile], process.cwd(), console, true);

  for (const name of LOCAL_MANAGED_VARIABLES) {
    if (!(name in loadedFile.env)) {
      delete process.env[name];
    }
  }

  for (const [name, value] of Object.entries(loadedFile.env)) {
    if (value !== undefined) {
      process.env[name] = value;
    }
  }

  return { loaded: true, path } as const;
}
