# Optionale Formulierungshilfe im Frageneditor

## Zweck und Grenzen

Eine bewusste Aktion erzeugt einen sprachlichen Vorschlag. Sie ersetzt keine
fachliche Prüfung. Nur `questionText` wird übergeben, verglichen und auf ausdrückliches
Übernehmen im ungespeicherten Draft ersetzt. Speichern bleibt ausschließlich die
vorhandene Save-Action; Lösungen, Varianten, Medien, Kategorien, Musikstruktur,
Schwierigkeit, Status und Quizzuordnungen bleiben unverändert. Keine Migration.

Die frühere Implementierung aus PR71 und Stand5f3786e9 wird gezielt übernommen;
kein Merge ihres veralteten Gesamtbranches. Ausgangspunkt ist der erfolgreich auf
Production kontrollierte PR116-Merge b6d5388d. Suche, Rückkehrnavigation, Freigabe,
Zuordnung und alle PR115-/116-Funktionen bleiben bestehen.

## Verantwortlichkeiten

- Bestehender `QuestionEditor`: Draft, Templatekontext, Feldfehler und Speichern.
- `QuestionSection`: bestehendes Textfeld und Einhängestelle des optionalen Panels.
- `QuestionRewritePanel`: Vergleich, bearbeitbarer Vorschlag und ausdrückliche Aktionen.
- `QuestionRewriteController`: unabhängiger, deterministisch testbarer Zustand,
  Anfrage-Tickets, Abbruch und Schutz gegen verspätete Antworten. Keine Persistenz.
- Endpoint: serverseitiges Flag, echte Sitzung/aktuelle Editorial-Rolle, Origin,
  begrenzter JSON-Eingang und Rate-Limit vor dem Provider.
- Proxy: ausschließlich die exakte API-Route erhält ihre kontrollierten JSON-Fehler
  aus dem selbst authentifizierenden Handler; Editor und andere Pfade behalten
  die bestehende Loginumleitung. Keine allgemeine API-Ausnahme.
- Provider: serverseitige Responses API, `store:false`, striktes Schema, begrenzte
  Antwort/Timeout und Zahlen-/Zitatprüfung. Keine Keys/Anweisungen im Client.

## Zustände und Invarianten

Ohne Flag keine UI und kein Provideraufruf. Eine reine Eventmanagerrolle genügt
nicht; Administrator oder explizite globale/eventbezogene Editorzuweisung ist nötig.
Read-only-Kontext und statischer Template-Fragetext bieten die Hilfe nicht an.
Die Editierbarkeit kommt aus der lokalisierten Template-Definition; dynamische
Vorlagen übernehmen FIXED/EXCLUDED/REQUIRED_NEW aus ihrem gespeicherten Snapshot.
Eine fehlende dynamische Definition wird nicht als editierbar geraten.

Ein expliziter Request geht von bereit auf ausstehend. Mehrfachklicks sind gesperrt.
Erfolg zeigt einen getrennten Vorschlag und tatsächliche Usage, Fehler lassen den
Draft erhalten. Verwerfen entfernt nur den aktiven Vorschlag; erneute Anfrage
erzeugt eine neue, begrenzte Sitzungshistorie. Manuelle Vorschlagsbearbeitung
verändert den Original-Draft nicht. Übernehmen liefert genau den Vorschlag an
`applyQuestionRewriteToDraft`, ohne Speichern oder Statuswechsel.

Jede Originaltextänderung invalidiert Tickets und aktive Vorschläge. Eine zusätzliche
Eingaberevision verhindert Wiederverwendung nach A→B→A. Der letzte Abgleich erfolgt
auch synchron beim Übernehmen. Frage-/Template-/Vorlagenwechsel remountet den
Controller; Cleanup invalidiert verspätete Ergebnisse auch dann, wenn Abort vom
Transport nicht mehr umgesetzt wird. Fehler, leere und unvollständige Antworten
sind kontrollierte Ergebnisse, keine stillen Draft-Änderungen.

Nur bestätigte Responses mit genau einem gültigen `proposal`-Feld werden akzeptiert.
Unbekannte/zusätzliche Ausgabe, Ablehnung, ungültiges JSON, geänderte Zahlen oder
Zitate und überlange Texte werden abgelehnt. Diese Prüfung garantiert keine
Fakten-, Eigennamen- oder Bedeutungsidentität: redaktionelle Prüfung erforderlich.
Fehlende/inkonsistente Usage wird nicht geschätzt. Kosten sind ausschließlich als
konfigurierte Schätzung bezeichnet; ohne valide Preiswerte keine Kostenzahl.

## Tests

`npm run test:question-rewrite` wird im bestehenden CI ausgeführt. Controllerfälle
prüfen tatsächliche asynchrone Abläufe mit zurückgehaltenen Antworten: Textänderung,
Rückkehr zum alten Text, Frage-/Template-Unmount, Mehrfachklicks, Editieren,
Übernehmen/Verwerfen, Retry und Fehler. Dazu Rollen-/Flag-/Origin-/Längen- und
Provider-Vertragstests, Zahlen/Zitate, Refusal/Timeout/Rate-Limit sowie SSR des Panels.

Bestehende Draft-, Musik-/dynamische Vorlagen-, Suchnavigation-, i18n- und
Environment-Tests bleiben Teil der Regression. Reale UI-/HTTP-/Provider-Abnahme
erfordert das echte Zieldeployment und darf nicht aus Testakteuren oder Mocks
abgeleitet werden. Betriebsnachweise und offene Gates stehen in der Betriebsdokumentation.

`npm run test:question-rewrite:http` startet nach dem Build den echten Next-Server
mit synthetischer Konfiguration, ohne Datenbank/Providerzugang. Tatsächliche
POSTs ohne Cookies liefern401 bzw. bei deaktiviertem Flag404; eingesetzte
Actor-Daten im Body verleihen keine Rechte. Editor und ähnlich benannte fremde
Pfade bleiben per307loginpflichtig. Diese Prüfung läuft auch im normalen CI nach
dem Build und verwendet keine injizierte Authentifizierungsfunktion.
