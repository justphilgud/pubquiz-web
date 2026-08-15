import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import {
  livePerformanceDiagnosticsEnabled,
  recordPrismaQueryDuration,
} from "./prismaQueryDiagnostics.server";

const { Pool } = pg;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient<"query">;
  prismaQueryListenerRegistered?: boolean;
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const createPrismaClient = (): PrismaClient<"query"> => {
  if (livePerformanceDiagnosticsEnabled()) {
    return new PrismaClient({
      adapter,
      log: [{ emit: "event", level: "query" }],
    });
  }

  return new PrismaClient({ adapter }) as PrismaClient<"query">;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (
  livePerformanceDiagnosticsEnabled() &&
  !globalForPrisma.prismaQueryListenerRegistered
) {
  prisma.$on("query", (event) => {
    recordPrismaQueryDuration(event.duration);
  });
  globalForPrisma.prismaQueryListenerRegistered = true;
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
