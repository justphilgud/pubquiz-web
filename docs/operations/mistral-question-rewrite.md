# Mistral-Formulierungshilfe im Frageneditor

Die Formulierungshilfe ist eine optionale Editor-Funktion. Sie verändert keine
Datenbankstruktur und speichert keine Vorschläge selbstständig. Production bleibt
ohne separate Freigabe deaktiviert; eine Production-Betrachtung ist frühestens ab
dem 22. Oktober 2026 vorgesehen.

## Konfiguration

Alle Werte sind serverseitig. Der Browser erhält weder API-Key noch Systemprompt.

```dotenv
MISTRAL_QUESTION_REWRITE_ENABLED=false
MISTRAL_API_KEY=<server-only>
MISTRAL_QUESTION_REWRITE_MODEL=mistral-small-latest
MISTRAL_INPUT_EUR_PER_MILLION_TOKENS=
MISTRAL_OUTPUT_EUR_PER_MILLION_TOKENS=
```

`MISTRAL_QUESTION_REWRITE_ENABLED` ist der einzige Feature-Schalter. Fehlt er
oder ist er nicht exakt `true`, erscheinen weder UI noch Provideraufrufe. Ein
aktiviertes Flag ohne gültigen Key endet kontrolliert mit `NOT_CONFIGURED`.

Die optionalen Preiswerte sind Euro je eine Million Tokens. Kosten werden nur
als konfigurierte Schätzung angezeigt, wenn beide Werte gültig gesetzt sind.
Ohne diese Werte zeigt der Editor „nicht verfügbar“. Tokenzahlen stammen direkt
aus der Usage-Antwort des Providers.

## Datenfluss und Sicherheit

1. Die Seite gibt lediglich den booleschen Featurestatus an den Client weiter.
2. Erst der explizite Button „Frage umformulieren“ sendet den aktuellen
   Fragetext an `/api/question-rewrite`.
3. Der Route Handler prüft Flag, Anmeldung, Editorial-Rolle, Länge und eine
   kurze Mehrfachaufruf-Sperre.
4. Nur der Fragetext wird an Mistral übertragen. Antworten, Lösung,
   Zusatzinformationen, Quellen und Medien bleiben in der Anwendung.
5. Der Vorschlag bleibt bis „Übernehmen“ getrennt vom Editor-Draft. Auch danach
   ist er nur eine ungespeicherte Draft-Änderung; der normale Speichervorgang
   bleibt erforderlich.

Der serverseitige Prompt verlangt die Erhaltung von Bedeutung,
Schwierigkeitsgrad, Fakten, Eigennamen, Zahlen, Einheiten und Zitaten. Er
verbietet Ergänzungen und Antwortleaks. Die Funktion ist eine sprachliche Hilfe
und keine fachliche Faktenprüfung.

## Fehler- und Rückfallverhalten

Timeout, Providerfehler, ungültige Antworten, fehlende Berechtigung und
Mehrfachaufrufe liefern qualifizierte Fehlercodes. Der aktuelle Fragetext bleibt
in allen Fehlerfällen unverändert. Die Sitzungsverlauf- und Usage-Anzeige lebt
nur im Browserzustand und wird nicht persistiert.
