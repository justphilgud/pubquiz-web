import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { OperationsError, requireCondition } from "./guards";
import { libpqEnvironment } from "./libpq";
import type { Environment } from "./acceptance-policy";

// Persistent native libpq connection: exported snapshots live until close().
// No raw SQL errors/stdout are logged. Only one request at a time.
export class PgSession {
  private child: ChildProcessWithoutNullStreams;
  private pending?: { marker: string; resolve: (value: string) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };
  private output = "";
  private dead = false;
  constructor(connection: string, env: Environment, launch: (args: string[], env: NodeJS.ProcessEnv) => ChildProcessWithoutNullStreams =
    (args, childEnv) => spawn("psql", args, { env: childEnv, stdio: "pipe", windowsHide: true })) {
    this.child = launch(["-X", "-w", "-qAt", "-v", "ON_ERROR_STOP=1"], libpqEnvironment(connection, env));
    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => {
      this.output = (this.output + chunk).replaceAll("\r\n", "\n");
      if (Buffer.byteLength(this.output) > 128 * 1024 * 1024) { this.fail(); return; }
      if (this.pending && this.output.endsWith(this.pending.marker + "\n")) {
        const p = this.pending; this.pending = undefined; clearTimeout(p.timer);
        const result = this.output.slice(0, -p.marker.length - 1).trim(); this.output = ""; p.resolve(result);
      }
    });
    this.child.stderr.resume(); // psql can include data values in diagnostics; discard them.
    this.child.on("error", () => this.fail()); this.child.on("exit", () => this.fail());
    this.child.stdin.on("error", () => this.fail());
  }
  private fail() {
    this.dead = true;
    if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(new OperationsError("LIBPQ_SESSION_FAILED")); this.pending = undefined; }
    this.child.kill();
  }
  async sql(sql: string): Promise<string> {
    requireCondition(!this.pending && !this.dead, "LIBPQ_SESSION_UNAVAILABLE");
    const marker = `ap94_${randomUUID().replaceAll("-", "")}`;
    return new Promise((resolve, reject) => {
      this.pending = { marker, resolve, reject, timer: setTimeout(() => this.fail(), 900000) };
      this.child.stdin.write(`${sql};\n\\echo ${marker}\n`);
    });
  }
  async json<T>(query: string): Promise<T> { return JSON.parse(await this.sql(query)) as T; }
  close() { this.fail(); }
}
export function pgTool(tool: "pg_dump" | "pg_restore" | "psql", args: string[], env: Environment, input?: string) {
  const result = spawnSync(tool, args, { env: { NODE_ENV: "production", ...env }, input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], windowsHide: true, timeout: 900000, maxBuffer: 256 * 1024 * 1024 });
  requireCondition(!result.error && result.status === 0, `${tool.toUpperCase()}_FAILED_DETAILS_WITHHELD`);
  return result.stdout;
}
export function toolsVersion(env: Environment) {
  for (const tool of ["pg_dump", "pg_restore", "psql"] as const) {
    requireCondition(/\(PostgreSQL\) (17|18)\./.test(pgTool(tool, ["--version"], { PATH: env.PATH, SystemRoot: env.SystemRoot })), "PG_TOOL_VERSION_UNSUPPORTED");
  }
}
