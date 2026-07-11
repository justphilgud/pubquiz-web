import packageJson from "../../package.json";

export const appVersion = packageJson.version;

export const appEnvironment =
  process.env.NEXT_PUBLIC_APP_ENV ?? "development";