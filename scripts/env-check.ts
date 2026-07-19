import { getSafeEnvironmentSummary, validateUploadEnvironment } from "../config/environment";
import { LOCAL_ENV_FILE, loadLocalEnvironment } from "./load-local-environment";

function main() {
  const inheritedDatabaseUrl = process.env.DATABASE_URL;
  const source = loadLocalEnvironment({ required: true });
  const results = validateUploadEnvironment();

  console.log(source.loaded ? `Environment-Quelle: ${LOCAL_ENV_FILE} (geladen)` : "Environment-Quelle: Plattformvariablen");
  try {
    const summary = getSafeEnvironmentSummary();
    console.log(`Logische Umgebung: ${summary.environment}`);
    console.log(`Datenbank-Host: ${summary.databaseHost}`);
    console.log(`Datenbankname: ${summary.databaseName}`);
    console.log(`Datenbankschema: ${summary.databaseSchema}`);
    console.log(`Blob-Präfix: ${summary.blobPrefix}`);
    if (summary.environment !== "development") {
      throw new Error("Der lokale Entwicklungsstart erwartet MEDIA_UPLOAD_ENV=development.");
    }
    if (process.env.PRODUCTION_DATABASE_HOST && summary.databaseHost === process.env.PRODUCTION_DATABASE_HOST) {
      throw new Error("Die Development-Konfiguration verweist auf den konfigurierten Production-Datenbankhost.");
    }
  } catch (error) {
    console.error(`FEHLER Konfiguration: ${error instanceof Error ? error.message : "unbekannter Fehler"}`);
    process.exitCode = 1;
  }

  if (inheritedDatabaseUrl && inheritedDatabaseUrl !== process.env.DATABASE_URL) {
    console.error("FEHLER DATABASE_URL: Die geerbte Shell-Variable widerspricht .env.development.local. Next.js und Prisma verwenden die lokale Datei; entferne die Shell-Variable.");
    process.exitCode = 1;
  }
  for (const result of results) {
    console.log(`${result.ok ? "OK" : "FEHLER"} ${result.name}: ${result.message}`);
  }
  if (results.some((result) => result.required && !result.ok)) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(`FEHLER Environment: ${error instanceof Error ? error.message : "unbekannter Fehler"}`);
  process.exitCode = 1;
}
