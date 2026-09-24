# Externe Fragenquellen

## Ziel und Grenze

Die Importstrecke bereitet Inhalte externer Fragenanbieter für die bestehende
Fragenredaktion vor. Sie veröffentlicht keine Fragen. Der erste Provider ist
OpenTDB; das Domänenmodell bleibt providerunabhängig.

```text
ExternalQuestionProvider
  → Normalization
  → Filtering
  → Enrichment
  → Verification
  → DuplicateCheck
  → Review
  → bestehender Question-Lifecycle
```

Der Provider ist ausschließlich für Abruf und providernahe Validierung
zuständig. Normalisierung, Qualitätsregeln, strukturierte Enrichment-Daten,
Duplikatprüfung und Review verwenden gemeinsame Typen. Ein weiterer Provider
muss daher keine OpenTDB-spezifischen Felder in den Frageneditor tragen.

## Datenhaltung

`external_question_import_batches` protokolliert einen Lauf.
`external_question_import_items` bewahrt Original, Provider-Referenz, Lizenz,
aufbereitete Fassung, Fachquelle, Qualitätsbefunde und Duplikatkandidaten.
Die eindeutige Kombination aus Provider und externer Referenz macht den Import
idempotent. Da die klassische OpenTDB-Antwort keine stabile ID liefert, ist die
Referenz ein deterministischer SHA-256-Fingerprint aus Originalfrage und
Antworten.

Automatisch ausgesonderte oder manuell abgelehnte Datensätze bleiben in der
Importspur und erzeugen keine `fragen`-Zeile. Erst die Aktion „Freigeben (in
Prüfqueue)“ erzeugt eine Standardfrage mit `review_status = IN_REVIEW` und
`freigegeben = false`. Die normale Fragenfreigabe bleibt unverändert.

## Enrichment und Faktenprüfung

Im Repository existiert derzeit keine freigegebene LLM- oder
Übersetzungsinfrastruktur. Enrichment wird deshalb über einen streng
validierten strukturierten Vertrag angenommen. Ohne deutsche Lokalisierung und
belastbare HTTPS-Fachquelle bleibt der Datensatz blockiert. Ein künftiger
LLM-Adapter darf nur diesen Vertrag befüllen und muss seine Ausgabe erneut
validieren.

Deterministische Regeln markieren unter anderem zeitabhängige,
sprachabhängige, lokal stark gebundene, strukturell ungültige und doppelte
Inhalte. Exakte Dubletten blockieren die Übernahme. Semantische Treffer werden
angezeigt und bleiben eine redaktionelle Entscheidung.

## Lizenz

OpenTDB nennt CC BY-SA 4.0 für die API-Inhalte. Originaltext, Referenz,
Lizenz-URL und Importzeit bleiben am Importdatensatz. Bei Übernahme kombiniert
das Quellenfeld die fachliche Quelle mit dem Hinweis auf die bearbeitete bzw.
übersetzte OpenTDB-Fassung und die Lizenz-URL.

## Umgebungsschutz

Der 100-Fragen-Pilot kann nur in `preview` gestartet werden. Lokal ist er nur
mit dem expliziten Schalter `OPENTDB_PILOT_ALLOW_LOCAL=true` möglich. In
Production verweigern alle schreibenden Importaktionen die Ausführung.

## Offene Ausbaustufe

Vor einem Production-Massendurchlauf braucht es einen freigegebenen
Übersetzungs-/Enrichment-Adapter, eine belastbare Quellenrecherche je Frage und
eine Pilotentscheidung anhand der gemessenen Akzeptanzquote. Die bestehende
Implementierung skaliert diese Schritte bewusst nicht automatisch hoch.
