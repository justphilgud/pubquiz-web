import { defineConfig } from "prisma/config";
import { loadLocalEnvironment } from "./scripts/load-local-environment";

loadLocalEnvironment({ required: true });

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
