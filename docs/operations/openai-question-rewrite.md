# OpenAI-Formulierungshilfe: Betrieb und Release2

**Release abgeschlossen:** [Production-Abnahme mit Commit, beiden Aliasen,
vollständiger Usage und entferntem temporärem Zugriff](openai-question-rewrite-production-20261016.md).
Die folgenden Zwischenstände beschreiben die Vorbereitung und Preview-Abnahme;
der verlinkte Abschlussbericht enthält den tatsächlichen Production-Nachweis.

## Ausgangspunkt

Release1 ist auf Production kontrolliert:
[PR116-Abnahme](pr116-production-release-20261016.md), Commit
`b6d5388df4dd146a16b507219d50e02ea0bb1e1b`. Release2 liegt separat auf
`codex/openai-question-rewrite-release`. Quellen sind
[PR71](https://github.com/justphilgud/pubquiz-web/pull/71), dessen Head d30506cc,
und historischer Stand5f3786e9. Keine Übernahme alter Such-/Speicher-/Musikfunktionen.

## Serverkonfiguration

```dotenv
OPENAI_QUESTION_REWRITE_ENABLED=false
OPENAI_API_KEY=
OPENAI_QUESTION_REWRITE_MODEL=
OPENAI_INPUT_USD_PER_MILLION_TOKENS=
OPENAI_OUTPUT_USD_PER_MILLION_TOKENS=
```

Flag muss exakt `true` sein. Key und Modell sind erforderlich; andernfalls
kontrolliert NOT_CONFIGURED. Der Browser erhält lediglich ein rollenabhängiges
Boolean, niemals Key oder interne Anweisungen. Kein persönlicher ChatGPT-Login.
Lokale explizite Prozessvariablen haben auch für alle fünf OpenAI-Werte Vorrang
vor `.env.development.local`. Vercel/CI laden diese Datei nicht. Keine unbeabsichtigte
Übernahme lokaler/Preview-Werte in Production.

Am16.10.2026 wurde über den regulären Vercel-Zugang ausschließlich vorhandene
Konfigurationsmetadaten geprüft: In Preview/Production keine OpenAI-Variablen,
auch kein entsprechend benanntes Repositorysecret. Ein vorhandener lokaler
historischer Projektschlüssel wurde ausschließlich im Prozessspeicher gelesen.
Zwei lesende Modell-Metadatenversuche von Windows an api.openai.com ergaben
HTTP403 ohne OpenAI-JSON-Fehler. Das beweist weder einen ungültigen Key noch
funktionierenden Zielzugang. Keine Schlüsselwerte protokolliert oder neu erzeugt.
Nach gezielter direkter Freigabe sind die fünf dokumentierten Werte ausschließlich
für den Preview-Branch sensitive konfiguriert. Der vorhandene Key wurde nur im
Prozessspeicher und über stdin übertragen. Zehn echte Responses aus dem Preview
waren erfolgreich; damit sind Zielzugang, Modell und Parameter dort nachgewiesen.
Production ist zu diesem Berichtsstand noch unverändert, kein KI-Release behauptet.

## Aktuelle offizielle API-Grundlage

Am16.10.2026 tatsächlich abgerufene offizielle Dokumentation:

- [GPT5.6Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna):
  Responses und Structured Outputs unterstützt; Standardpreis0,20USD/Mio.Input,
  1,20USD/Mio.Output. Kein Nachweis der projektbezogenen Verfügbarkeit allein
  durch diese Dokumentation. Inzwischen durch echte Preview-Aufrufe bestätigt.
- [Responses-Migration](https://developers.openai.com/api/docs/guides/migrate-to-responses):
  `store:false`; striktes Ausgabeformat unter `text.format`.
- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses):
  JSON-Schema, Ablehnungen und unvollständige Antworten gesondert behandeln.

Das Modell wird ausdrücklich zentral konfiguriert, ohne historischen Fallback.
Der Provider setzt `service_tier:default`, `reasoning.effort:none`, maximal512
Outputtokens und12Sekunden Timeout; die tatsächliche Parameterkompatibilität ist
im Preview bestätigt. Keine Tools, kein Webzugriff, keine gespeicherte Konversation.
Antwortstream maximal64KiB, Request2KiB, Fragetext300Zeichen. Ausschließlich
Fragetext und notwendige serverseitige Anweisung, keine Lösungen/Medien/Teilnehmerdaten.

## Kosten- und Testvertrag

Gesamtes direkt freigegebenes Testbudget einschließlich Preview-/Browser-/Production-
Generierungen maximal1USD. Stand nach Preview: zehn erfolgreiche Generierungen,
2269Input-/248Outputtokens, konfigurierte Schätzung0,0007514USD. Zusätzlich ein
nach sichtbar laufender Anfrage clientseitig abgebrochener Versuch ohne Usage:
0,01USD Reserve bleibt gebunden. Ein weiterer UI-Request wurde vom Anwendungs-
Cooldown vor dem Provider abgefangen. Zwei GET-Modellmetadatenversuche ohne
Generierung. Konservativ noch0,9892486USD; weitere Production-Aufrufe gehören in
dasselbe Ledger. Vollständiger [Abnahmebericht](../reports/openai-question-rewrite-release-20261016.md).

Vor jedem echten Aufruf Modell/Preise und verbleibendes Budget prüfen. Geplanter
synthetischer Satz höchstens20Fragen einschließlich UI-Fällen; Zahlen, Einheiten,
Zitate, Eigennamen, Umlaute sowie kurze/lange Texte. Für das dokumentierte
Luna-Modell vorläufig konservativ0,01USD je Versuch reservieren, deutlich oberhalb
der aus maximal512Outputtokens und kurzem Texteingang abgeleiteten Kosten.
Auch abgebrochene/fehlgeschlagene Requests ohne Usage behalten diese Reserve.
Keine unbegrenzten Retries. Production-Aufruf und eventuelle notwendige Nachtests
ebenfalls in derselben Liste führen. Tatsächliche Usage gesondert erfassen; die
angezeigte Rechnung ist eine konfigurierte Schätzung, keine Providerrechnung.

Das bestehende Rate-Limit arbeitet pro Serverprozess, nicht verteilt. Es schützt
vor versehentlichem Mehrfachklicken, ist kein organisationsweites Kostenlimit.
Das Testbudget wird durch die begrenzte Testdurchführung und das Nachweisledger
eingehalten, nicht durch eine behauptete verteilte Kontingentsperre.

## Noch ausstehende Releasegates

1. Finale lokale Prüfungen/CI und klarer separater PR.
2. Regulär autorisierter geschützter Preview-Prozess. Keine Umgehung von
   TRUSTED_PREVIEW_BRANCHES, Environment-Branch-Policy oder zentraler
   Nonprod-Medienkonfiguration. Der aktuelle Guard verbietet Medien-Overrides
   pro Branch; die bestehende zentrale Nonprod-Konfiguration bleibt unverändert.
   Zusätzliche Branch-Zugriffserweiterung nur mit gezielter Freigabe.
3. Vorhandenen API-Zugang gezielt für diesen Server konfigurieren, echten
   angemeldeten UI-/HTTP-Weg bis normalem Speichern/Reload mit eigenen Fragen prüfen.
   Separat fehlende Anmeldung/Berechtigung und deaktiviertes Flag kontrollieren.
4. Provider- und redaktionelles Ergebnis getrennt dokumentieren. Bei fehlendem
   Zielzugang Implementierung/Tests/PR fertigstellen, deaktiviert lassen und
   konkreten Konfigurationsblocker melden. Kein KI-Merge/Release als abgenommen ausgeben.
5. Nur nach erfolgreicher Abnahme regulärer Merge, Main-CI, Production-Release
   und bewusste gültige Production-Konfiguration. Beide Aliase/Commit nachweisen.

## Rückfallweg

Flag `OPENAI_QUESTION_REWRITE_ENABLED=false` setzen und regulär redeployen, damit
die Konfiguration wirksam wird. Keine Datenmigration oder Rücknahme der Archivmigration.
Normale manuelle Fragebearbeitung/-speicherung bleibt verfügbar. Erfolgreiches
PR116-Release erhalten. Temporäre Branchfreigaben nach Abschluss/Abbruch gezielt
entfernen und erneut lesen; ursprüngliche Einträge beibehalten.
