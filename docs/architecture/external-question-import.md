# Externe Fragenquellen

## Ziel und Grenze

Die Importstrecke bereitet Inhalte externer Fragenanbieter für die bestehende
Fragenredaktion vor. Sie veröffentlicht keine Fragen. Der erste Provider ist
OpenTDB; das Domänenmodell bleibt providerunabhängig.

```text
ExternalQuestionProvider
  → Normalization
  → Localization
  → Filtering
  → Enrichment
  → Verification
  → DuplicateCheck
  → QualityGate
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

Phase 2 verwendet in Preview Vercel AI Gateway mit dem kurzlebigen, vom
Deployment bereitgestellten OIDC-Token. In Vercel Functions liest die
authentifizierte Server Action den Token aus dem providerverwalteten
`x-vercel-oidc-token`-Request-Header; Builds und lokale Vercel-Entwicklung
können ihn als `VERCEL_OIDC_TOKEN` erhalten. Es wird kein statisches
KI-Credential im Projekt gespeichert. Der Adapter arbeitet über einen streng
validierten strukturierten Vertrag und verwendet `perplexity/sonar`, dessen
Anfragen eine Live-Websuche ausführen.

Eine vom Modell genannte Quellen-URL wird nur gespeichert, wenn sie zugleich in
den vom Gateway gelieferten Suchzitaten vorkommt. Bleibt die strukturierte
Quellenauswahl leer, verwendet der Adapter ausschließlich die vom Provider als
für die Antwort verwendete Suchzitate gelieferten HTTPS-Quellen. Eine genannte,
aber nicht zitierte URL wird weiterhin abgewiesen. OpenTDB und Quizseiten werden
als Fachquelle abgewiesen. Ein ausschließlich auf Wikipedia, Fandom oder Reddit
gestütztes Ergebnis darf nicht `VERIFIED` werden. Ohne natürliche deutsche
Lokalisierung und belastbare HTTPS-Fachquelle bleibt der Datensatz blockiert.
Freie Modellausgaben gelangen nicht ungeprüft in die Datenbank.

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

Der 100-Fragen-Pilot und seine Phase-2-Aufbereitung können nur in `preview`
gestartet werden. Lokal ist der Schreibpfad nur
mit dem expliziten Schalter `OPENTDB_PILOT_ALLOW_LOCAL=true` möglich. In
Production verweigern alle schreibenden Importaktionen die Ausführung.

Phase 2 akzeptiert ausschließlich den bereits vorhandenen Batch `#1` mit exakt
100 Datensätzen. Jeder Aufruf verarbeitet höchstens fünf noch nicht bearbeitete
Kandidaten. Fehler werden am einzelnen Kandidaten gespeichert und brechen nicht
den restlichen Batch ab. Ein erneuter Providerabruf findet nicht statt.

Das Quality Gate unterscheidet `READY_FOR_REVIEW`, `REVIEW_REQUIRED` und
`REJECT_RECOMMENDED`. Keine dieser Einstufungen veröffentlicht eine Frage. Erst
eine explizite Adminaktion erzeugt wie bisher eine unveröffentlichte Frage mit
`review_status = IN_REVIEW`.

## Offene Ausbaustufe

Vor einem Production-Massendurchlauf braucht es weiterhin die menschliche
Stichprobe mit Annahme-, Änderungs- und Reviewzeitmessung. Der Phase-2-Adapter
ist absichtlich an Preview, Batch `#1` und den manuellen Fragen-Lifecycle
gebunden. Eine spätere Freigabe für weitere Quellen oder Production ist eine
separate Entscheidung.
