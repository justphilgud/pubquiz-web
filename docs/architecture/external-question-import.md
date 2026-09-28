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
KI-Credential im Projekt gespeichert. Der Adapter verwendet den offiziellen
AI-SDK-Transport mit `perplexity/sonar`, strukturiertem Output und dem
bestehenden streng validierten Vertrag. Die tatsächlich verwendeten Quellen
werden ausschließlich aus `result.sources` des SDK-Resultats übernommen.

Eine vom Modell genannte Quellen-URL wird nur gespeichert, wenn sie zugleich in
den vom Gateway gelieferten URL-Zitaten vorkommt. Bleibt die strukturierte
Quellenauswahl leer, verwendet der Adapter ausschließlich die vom Provider als
für die Antwort verwendete URL-Zitate gelieferten HTTPS-Quellen. Eine genannte,
aber nicht zitierte URL wird weiterhin abgewiesen. OpenTDB und Quizseiten werden
als Fachquelle abgewiesen. Ein ausschließlich auf Wikipedia, Fandom oder Reddit
gestütztes Ergebnis darf nicht `VERIFIED` werden. Ohne natürliche deutsche
Lokalisierung und belastbare HTTPS-Fachquelle bleibt der Datensatz blockiert.
Freie Modellausgaben gelangen nicht ungeprüft in die Datenbank.

Nicht manuell bearbeitete und noch nicht in die Endkontrolle übernommene
Kandidaten mit `NO_RELIABLE_SOURCE` können in Fünfergruppen erneut durch die
Faktenprüfung laufen. Der Wiederaufnahmeweg ändert weder Originaldaten noch den
Freigabe-Lifecycle und ruft keine weiteren Providerfragen ab.

Deterministische Regeln markieren unter anderem zeitabhängige,
sprachabhängige, lokal stark gebundene, strukturell ungültige und doppelte
Inhalte. Exakte Dubletten blockieren die Übernahme. Semantische Treffer werden
angezeigt und bleiben eine redaktionelle Entscheidung.

## Lizenz

OpenTDB nennt CC BY-SA 4.0 für die API-Inhalte. Originaltext, Referenz,
Lizenz-URL und Importzeit bleiben am Importdatensatz. Bei Übernahme kombiniert
das Quellenfeld die fachliche Quelle mit dem Hinweis auf die bearbeitete bzw.
übersetzte OpenTDB-Fassung und die Lizenz-URL.

## Umgebungsschutz und Batchbetrieb

Der bestehende 100-Fragen-Pilot und seine Phase-2-Aufbereitung können nur in `preview`
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

Der Preview-Vollpilot ist mit Batch `#1` abgeschlossen. Preview wird künftig nur
für kleine repräsentative Piloten und technische Workflow-Abnahmen verwendet.
Weitere vollständige 100er- oder größere Contentbatches werden dort nicht
persistiert. Der bestehende Batch und seine Entscheidungen bleiben als
Abnahmenachweis erhalten; eine Bereinigung ist kein Bestandteil dieses Vertrags.

## Künftiger Production-Contentimport

Neue große Contentbatches werden außerhalb von Production vollständig
vorbereitet. Vor dem ersten Production-Schreibzugriff müssen Kandidaten,
Lokalisierung, Quellen, Qualitätsstatus und technische IDs feststehen. Ein
read-only Bestandsabgleich gegen Production prüft exakte und semantische
Dubletten, vorhandene Providerreferenzen, Quellenstatus und Kategorien.

Der kontrollierte Ablauf ist:

```text
Recherche / Lokalisierung / Quellenprüfung
  → Qualitätsbewertung
  → read-only Dubletten- und Bestandsprüfung gegen Production
  → finaler Importplan
  → frisches, vollständig validiertes Production-Backup
  → ausdrückliche Schreibfreigabe
  → idempotenter Production-Contentimport
  → lesende Nachvalidierung
```

Konflikte werden weder überschrieben noch automatisch zusammengeführt.
`READY_FOR_REVIEW`, `REVIEW_REQUIRED` und `REJECT_RECOMMENDED` bleiben getrennt.
Nur explizit ausgewählte Kandidaten dürfen in den normalen Fragen-Lifecycle
gelangen; KI-Prüfung ersetzt keine redaktionelle Freigabe. Ein reiner
Contentimport benötigt weder Migration noch Deployment. Die bestehende
Preview-Aktion wird nicht als Production-Importweg freigeschaltet.

## Production-Guard-Vertrag

`productionImportGuard.ts` bildet die zentrale, source-neutrale Sicherheitsgrenze.
Der Vertrag besteht aus einem kanonischen Importplan, dessen SHA-256, einem
read-only Production-Preflight, dem Backupnachweis und einer einmaligen
Schreibautorisierung. OpenTDB liefert nur den ersten Planadapter; spätere Quellen
verwenden denselben Vertrag.

Der eingefrorene Plan enthält Batch-ID, Quelle, Kandidatenreferenz,
Content-Fingerprint, Original- und vorbereitete Fassung, Antwortsatz, Kategorie,
Quellen, Reviewstatus, Lizenz und optionale Medienprovenienz. Nach dem Einfrieren
findet keine Recherche, Übersetzung oder Distraktorenerzeugung mehr statt.
Kanonisches JSON und SHA-256 machen jede Änderung nach der Freigabe sichtbar.

Der Preflight verwendet eine `REPEATABLE READ READ ONLY`-Transaktion und prüft
Providerreferenz, Content-Fingerprint, normalisierte Frage, richtige Antwort und
semantische Ähnlichkeit. Das Ergebnis je Kandidat ist `CREATE`,
`ALREADY_PRESENT`, `CONFLICT` oder `REVIEW_REQUIRED`. Konflikt und offener Review
blockieren den gesamten Schreibvertrag; bestehende Fragen werden nicht verändert.
Ein erfolgreicher Re-Run liefert ausschließlich `ALREADY_PRESENT`.

Der Guard prüft Defense in Depth:

- logische Production-Umgebung,
- erlaubten Vercel-Production- oder geschützten GitHub-Actions-Kontext,
- `main`, Repository, Workflow und Operations-Environment,
- feste Production-Datenbankidentität aus den bestehenden Operations-Guards,
- Batch-ID und Plan-Digest,
- aktuellen Production-SHA,
- vollständig abgeschlossenes Backup mit Manifest, privatem Readback und
  Integritätsnachweis,
- identische Backup- und aktuelle Production-Identität,
- explizite batch-, digest-, release- und datenbankgebundene Freigabe.

Da es bisher keine allgemeine Backup-Freshness-Konvention gab, gilt für externe
Contentimporte eine dokumentierte Obergrenze von zwei Stunden zwischen Snapshot
und Importbeginn. Der Snapshot muss weiterhin unmittelbar vor dem Import geplant
werden; die Obergrenze ersetzt keine operative Reihenfolge.

`writeAuthorized` ist standardmäßig und nach jedem Lauf `false`. Die einmalige
Autorisierung kann weder durch Preview noch Development erzeugt werden. Der
jetzige AP stellt bewusst keinen ausführbaren Production-Writer bereit. Damit
bleibt vor der späteren Main-Integration und der separaten Freigabe des ersten
echten Contentimports eine harte technische Lücke statt eines versteckten
Schreibpfads.

Der vorhandene Operations-Workflow
`external-question-import-preflight.yml` führt ausschließlich den read-only
Preflight mit `PRODUCTION_BACKUP_DATABASE_URL` aus. Ein zukünftiger Writer muss
den hier getesteten Guardvertrag unverändert konsumieren, im bestehenden
Rollenmodell einen aktiven globalen Admin binden, Ergebnisse je Kandidat
auditieren und seine Job-lokale Freigabe im `finally` schließen.

## Medienvertrag

Der Plan kann für jedes Medium Quell-URL, Lizenz, MIME-Type, erwartete Größe,
SHA-256 und Zielreferenz enthalten. Die Planvalidierung prüft diese Metadaten.
Ein späterer Writer darf die Frage erst abschließen, nachdem Download,
Dekodierung, Production-Upload, privater Readback sowie Hash und Größe bestätigt
sind. Der aktuelle OpenTDB-Testplan enthält keine Medien; es wurde keine zweite
Medienpipeline eingeführt.

## Offene Ausbaustufe

Vor einem Production-Massendurchlauf braucht es weiterhin die menschliche
Stichprobe mit Annahme-, Änderungs- und Reviewzeitmessung. Der Phase-2-Adapter
bleibt an Preview, Batch `#1` und den manuellen Fragen-Lifecycle gebunden. Die
Anbindung eines ausführbaren Writers, eine geschützte einmalige
Reviewer-Freigabe und der erste echte Production-Contentimport bleiben ein
separates Freigabegate. Der Previewguard wird dafür nicht gelockert.
