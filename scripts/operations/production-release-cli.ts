import { appendFileSync } from "node:fs";
import { deployedProductionCommit } from "./production-release";

async function main() {
  if (process.env.GITHUB_REPOSITORY !== "justphilgud/pubquiz-web" || !process.env.GITHUB_TOKEN || !process.env.GITHUB_OUTPUT) throw new Error("PRODUCTION_METADATA_CONTEXT_REQUIRED");
  const sha = await deployedProductionCommit(async path => {
    const response = await fetch(`https://api.github.com/repos/justphilgud/pubquiz-web${path}`, {
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      redirect: "error",
    });
    if (!response.ok) throw new Error("PRODUCTION_METADATA_READ_FAILED");
    return response.json();
  });
  appendFileSync(process.env.GITHUB_OUTPUT!, `sha=${sha}\n`);
}
main().catch(error => { console.error(error instanceof Error ? error.message : "PRODUCTION_METADATA_READ_FAILED"); process.exitCode = 1; });
