# OpenAI-Formulierungshilfe im Frageneditor

Die Formulierungshilfe ist eine optionale Editor-Funktion. Sie verändert keine
Datenbankstruktur und speichert keine Vorschläge selbstständig. Der LOVD-Nachtauftrag
vom 10. Oktober 2026 erlaubt den Release nach vollständiger Preview-Abnahme.
Ohne bestehenden konfigurierten Providerzugang und echten Funktionstest bleibt
die Funktion technisch deaktiviert; eine Mock-Antwort genügt nicht als Abnahme.

## Konfiguration

Alle Werte sind serverseitig. Der Browser erhält weder API-Key noch
Systemanweisungen.

```dotenv
OPENAI_QUESTION_REWRITE_ENABLED=false
OPENAI_API_KEY=<server-only>
OPENAI_QUESTION_REWRITE_MODEL=gpt-5.6-luna
OPENAI_INPUT_USD_PER_MILLION_TOKENS=
OPENAI_OUTPUT_USD_PER_MILLION_TOKENS=
```

`OPENAI_QUESTION_REWRITE_ENABLED` ist der einzige Feature-Schalter. Fehlt er
oder ist er nicht exakt `true`, erscheinen weder UI noch Provideraufrufe. Ein
aktiviertes Flag ohne gültigen Key endet kontrolliert mit `NOT_CONFIGURED`.
Die Modellwahl liegt zentral in `OPENAI_QUESTION_REWRITE_MODEL`.

Die optionalen Preiswerte sind US-Dollar je eine Million Tokens. Kosten werden
nur als konfigurierte Schätzung angezeigt, wenn beide Werte gültig gesetzt sind.
Ohne diese Werte zeigt der Editor „nicht verfügbar“. Tokenzahlen stammen aus der
Usage-Antwort der OpenAI Responses API.

## Datenfluss und Sicherheit

1. Die Seite gibt lediglich den booleschen Featurestatus an den Client weiter.
2. Erst der explizite Button „Frage umformulieren“ sendet den aktuellen
   Fragetext an `/api/question-rewrite`.
3. Der Route Handler prüft Flag, Anmeldung, Editorial-Rolle, Länge und eine
   kurze Mehrfachaufruf-Sperre.
4. Nur der Fragetext wird serverseitig an `POST /v1/responses` übertragen.
   Antworten, richtige Lösung, Zusatzinformationen, Quellen, Medien, Teamdaten
   und Quiz-Laufzeitdaten bleiben in der Anwendung.
5. Der OpenAI-Aufruf verwendet `store: false` und ein strenges Structured-
   Output-Schema mit genau dem Feld `proposal`.
6. Der Vorschlag bleibt bis „Übernehmen“ getrennt vom Editor-Draft. Auch danach
   ist er nur eine ungespeicherte Draft-Änderung; der normale Speichervorgang
   bleibt erforderlich.
   Ein Vorschlag zu einem inzwischen geänderten Fragetext kann nicht übernommen
   werden. Statische Template-Fragetexte bieten keine Formulierungshilfe an.

Der serverseitige Prompt verlangt die Erhaltung von Bedeutung,
Schwierigkeitsgrad, Fakten, Eigennamen, Zahlen, Einheiten, Fachbegriffen,
Klammerzusätzen und Zitaten. Er verbietet Ergänzungen und Antwortleaks. Zahlen
und Zitate werden nach der Antwort zusätzlich deterministisch verglichen.
Die Funktion ist eine sprachliche Hilfe und keine fachliche Faktenprüfung.

## Fehler- und Rückfallverhalten

Timeout, OpenAI-Rate-Limit, Providerfehler, Ablehnungen, unvollständige oder
ungültige Antworten, fehlende Berechtigung und das lokale Rate-Limit liefern
qualifizierte Fehlercodes. Der aktuelle Fragetext bleibt in allen Fehlerfällen
unverändert. Die Sitzungsverlauf-, Token- und Kostenanzeige lebt nur im
Browserzustand und wird nicht persistiert.

## Isolierter Echttest

`scripts/question-rewrite/run-openai-live-test.ts` lädt ausschließlich die
Git-ignorierte `.env.development.local` und führt Testfragen durch die echte
Endpoint-/Provider-Kette. Der Test speichert keine Frage und schreibt keine
Datenbank. Resultate dürfen als Report gespeichert werden; der API-Key wird
weder ausgegeben noch in den Report übernommen.

Für den Entwicklungstest gilt ein Kostenlimit von 1 US-Dollar. Die Kalkulation
verwendet die im Testskript dokumentierten Modellpreise und bricht vor weiteren
Aufrufen ab, sobald das Budget gefährdet wäre.
