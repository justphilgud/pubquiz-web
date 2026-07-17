import { getBlobEnvironmentPrefix, getLogicalEnvironment, validateUploadEnvironment } from "../config/environment";
import { LOCAL_ENV_FILE, loadLocalEnvironment } from "./load-local-environment";

function main() {
  const source = loadLocalEnvironment({ required: true });
  const results = validateUploadEnvironment();

  console.log(
    source.loaded
      ? `Environment-Quelle: ${LOCAL_ENV_FILE} (geladen)`
      : "Environment-Quelle: Plattformvariablen",
  );

  try {
    console.log(`Logische Umgebung: ${getLogicalEnvironment()}`);
    console.log(`Blob-Präfix: ${getBlobEnvironmentPrefix()}`);
  } catch {
    console.log("Logische Umgebung: FEHLER");
    console.log("Blob-Präfix: FEHLER");
  }

  for (const result of results) {
    console.log(
      `${result.ok ? "OK" : "FEHLER"} ${result.name}: ${result.message}`,
    );
  }

  if (results.some((result) => result.required && !result.ok)) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(
    `FEHLER Environment: ${error instanceof Error ? error.message : "unbekannter Fehler"}`,
  );
  process.exitCode = 1;
}
