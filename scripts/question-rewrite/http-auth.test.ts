import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);

for (const enabled of ["true", "false"]) {
  test(`real built HTTP route: enabled=${enabled}, no session, no injected actor`, async () => {
    const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", "0"], {
      cwd: process.cwd(), windowsHide: true,
      env: { ...process.env, CI: "true", AUTH_SECRET: "synthetic-http-auth-test-only", AUTH_TRUST_HOST: "true",
        DATABASE_URL: "postgresql://synthetic:synthetic@127.0.0.1:1/synthetic?schema=pubquiz",
        OPENAI_API_KEY: "", OPENAI_QUESTION_REWRITE_MODEL: "", OPENAI_QUESTION_REWRITE_ENABLED: enabled },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    try {
      const origin = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Built HTTP server did not start")), 20_000);
        const read = (chunk: Buffer) => {
          output += chunk.toString();
          const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
          if (match && /Ready in/.test(output)) { clearTimeout(timeout); resolve(`http://127.0.0.1:${match[1]}`); }
        };
        child.stdout.on("data", read);
        child.stderr.on("data", read);
        child.once("error", error => { clearTimeout(timeout); reject(error); });
        child.once("exit", code => { clearTimeout(timeout); reject(new Error(`Server exited before HTTP check (${code})`)); });
      });
      const response = await fetch(`${origin}/api/question-rewrite`, { method: "POST", redirect: "manual",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionText: "Synthetischer Authentifizierungstest?", actor: { role: "ADMIN" } }),
        signal: AbortSignal.timeout(5_000),
      });
      assert.equal(response.status, enabled === "true" ? 401 : 404);
      assert.deepEqual(await response.json(), { ok: false, code: enabled === "true" ? "UNAUTHORIZED" : "FEATURE_DISABLED" });
      assert.equal(response.headers.get("Cache-Control"), "private, no-store");
      for (const path of ["/content/questions/new", "/api/question-rewrite-other"]) {
        const protectedResponse = await fetch(origin + path, { redirect: "manual", signal: AbortSignal.timeout(5_000) });
        assert.equal(protectedResponse.status, 307);
        assert.equal(new URL(protectedResponse.headers.get("location")!, origin).pathname, "/login");
      }
    } finally {
      child.kill();
    }
  });
}
