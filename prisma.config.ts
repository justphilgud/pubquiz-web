import { defineConfig } from "prisma/config";
import { loadLocalEnvironment } from "./scripts/load-local-environment";

const databaseUrlWasExplicitlySet = Boolean(process.env.DATABASE_URL);
const environmentSource = loadLocalEnvironment({
  required: !databaseUrlWasExplicitlySet,
});

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL fehlt für Prisma.");
}

console.info(
  databaseUrlWasExplicitlySet
    ? "Prisma DATABASE_URL-Quelle: explizite Prozessvariable"
    : environmentSource.loaded
      ? "Prisma DATABASE_URL-Quelle: .env.development.local"
      : "Prisma DATABASE_URL-Quelle: Plattformumgebung",
);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
