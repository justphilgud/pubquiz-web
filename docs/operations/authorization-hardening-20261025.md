# Berechtigungsabsicherung: Befunde und Abnahme, 25.10.2026

## Ausgangsstand und Begrenzung

Isolierter Branch `codex/authorization-hardening`, ab Main
`07a46427e1f7691a211304654c542c6264a40759`. Keine uncommitteten Änderungen aus
`preview/content-and-quiz-flow` übernommen. Der letzte erfolgreiche Productionlauf
40089161571 und Deployment 7297853976 zeigen auf denselben Commit. Zusätzlich am
25.10. im tatsächlich ausgelieferten `/admin/monitoring` auf
`https://pubquiz-web.vercel.app` als vollständige Release-ID abgelesen.
Vercel: `dpl_9BL8jyDiP9gWV9K1nAzpxMpTG2MS`, READY/production,
`https://pubquiz-8rbmbzh8m-just-phil-gud.vercel.app`.

Keine Schemaänderung, Migration, Berechtigungserweiterung oder Änderung an
Produktfreischaltungen, Navigation, Templates oder Branding. Produktionsdaten und
bestehende Migrationshistorien bleiben unangetastet.

## Gegen aktuellen Main und Production verifizierte Befunde

| Befund der früheren Analyse | Aktueller Ausgangsstand | Änderung |
| --- | --- | --- |
| Freigabe/Umzuordnung fremder Fragen | Weiterhin vorhanden; echte Action lehnt manipulierte eigene Zielreihe nicht bereits an der Objektgrenze ab | Persistierte und gewünschte Zuordnung gemeinsam prüfen, erneute Prüfung unter Fragensperre |
| Alt-Actions ohne konkrete Objektprüfung | Weiterhin vorhanden | VIEW/EDIT-Guards ergänzen; generelle Redaktionseingangsschranke beim Detailabruf erhalten |
| Live-Snapshot nur mit Sessionprüfung | Bereits behoben: aktuelle Route nutzt Quiz-Guards und damit aktive Konten/aktuelle Rollen | Keine unnötige Codeänderung; direkte positive/negative Route-Tests |
| Fremde Quizmetadaten in Fragenverwendungen | Weiterhin vorhanden | Verwaltbare Quiz im Query filtern, einschließlich Details, Anzahl und USED/UNUSED |
| Quizwechsel ohne Prüfung bestehender Inhalte | Weiterhin vorhanden | Fragen und relevante Story-/Umfrage-Scope-Prüfung mit atomarem Wechsel |
| Ähnlichkeitssuche nach Entzug einer Reihenrolle | Weiterhin vorhanden, wenn andere redaktionelle Rechte verbleiben | Aktuelle Fragen-Sichtbarkeit zusätzlich zur bisherigen Urhebergrenze |
| Pauschale Archivierungsaktion im Content | Weiterhin vorhanden | Capability aus bestehender Bearbeitungspolicy ableiten |

Die Alt-UI `FragenWorkspace`/`FrageSuche` referenziert `getFrageDetails`; die aktuelle
Fragen-Seite verwendet inzwischen `ContentLibraryPage`. Für `getFrageForEdit` und
`updateFrage` wurde keine produktive Importstelle gefunden. Die Exporte bleiben
trotzdem erhalten und geschützt; fehlende UI-Verwendung ist kein Sicherheitsbeweis.
Der optimierte Build bestätigt alle drei Exporte im Server-Action-Manifest, auch
am öffentlichen Teamseiten-Worker. Ihre tatsächliche HTTP-Erreichbarkeit wurde
gegen den gebauten lokalen Server geprüft: jeweils fremde ID abgelehnt, Admin-
Detailabruf erlaubt. Es wurde kein Production-Endpunkt mit Angriffs-Payloads getestet.

## Automatische Abnahme

`scripts/testing/authorization.server.test.ts` bündelt die echten Actions und die
Live-Snapshot-Route mit ihren echten Guards und Policies. Nur Auth-Provider,
Persistenz und Next-Nebeneffekte sind Adapter. Synthetische Fixtures: Reihen 10/20,
Admin, globaler Editor, Manager, Reihen-Editor; globale/eigene/fremde Fragen,
Entwürfe, freigegebene/archivierte Fragen und Mehrfachzuordnungen.

35 Prüfungen: direkte fremde IDs, manipulierte Freigabe-Ziele, Schreibschutz globaler
Originale, unverändertes globales Kopierverbot, erlaubte eigene Bearbeitung,
Quizmetadaten, Rechteentzug bei erhaltener Sitzung, deaktivierte Konten, Zielrechte,
unverträgliche Fragen/Story-Platzierungen/Umfragen/übernommene Story-Verknüpfungen,
erlaubte globale und quizlokale Inhalte sowie erlaubte/verbotene Live-Route-Zugriffe.

Reproduktion mit identischer Suite gegen die ursprünglichen Quelldateien:
`AUTHORIZATION_TEST_BASELINE=07a46427e1f7691a211304654c542c6264a40759`.
Die vollständigen 35 Prüfungen ergaben 18 Fehler und 17 erfolgreiche Tests auf dem
Ausgangsstand; nach Korrektur alle 35 erfolgreich. Das sind Prüfabweichungen, keine
Behauptung von 18 voneinander unabhängigen Sicherheitslücken.

Prisma-Validierung, Typecheck, strikter ESLint der geänderten Dateien und vollständiger
lokaler `npm test` waren erfolgreich. Ein zunächst gescheiterter unveränderlicher
Importplan-Prüfsummentest lag an Windows-CRLF im Checkout; erneuter Lauf mit den
unveränderten Git-Dateibytes bestand. Inhalt und erwartete Prüfsumme blieben gleich.
Der optimierte lokale Webpack-Build einschließlich TypeScript ist ebenfalls
erfolgreich. Zusätzlich acht echte HTTP-Prüfungen gegen den gebauten Server und
die isolierte echte QA-Datenbank: drei fremde Alt-Action-Aufrufe abgelehnt, Admin-
Detailabruf erlaubt, manipulierte globale Freigabe abgelehnt, deaktivierte und
entzogene Sitzungen abgelehnt, unverträglicher Quizwechsel abgelehnt. Danach wurden
die unveränderten Frage-/Quizdaten erneut lesend geprüft.
Der genaue Head-/CI- und Releasestand wird am zugehörigen PR mit den verknüpften
Actions-Läufen protokolliert; dieser lokale Abnahmebericht ersetzt kein grünes CI-Gate.

## Browserabnahme auf isolierter echter Datenbank

Neue Datenbank `authorization_qa_20261025` auf dem bestehenden Development-Host
`ep-dry-dust-aljik09f-pooler.c-3.eu-central-1.aws.neon.tech`. Der separat über GitHub
verifizierte Productionhost ist `ep-dawn-paper-alws45vx-pooler.c-3.eu-central-1.aws.neon.tech`.
Die neue leere Datenbank erhielt ausschließlich das aktuelle Schema und synthetische
Fixtures; kein bestehender Datenbestand und keine Migrationshistorie wurden
zurückgesetzt oder kopiert. Kein Kennwort eines bestehenden Kontos geändert.
Verbindungsdaten wurden nur aus der vorhandenen lokalen Development-Konfiguration
in den Prozess übernommen und nicht in neue Testdateien kopiert.

Vier unabhängig angemeldete Rollen über getrennte Host-Cookies auf
`admin.authqa.localhost`, `global.authqa.localhost`, `manager.authqa.localhost`,
`editor.authqa.localhost`, Port 3045. Zusätzlich Publikumspräsentation und anonymes
Teamformular. Nur die genauen QA-Hostnamen wurden vorübergehend in der lokalen
Next-Entwicklungsursprungsliste eingetragen; diese Konfiguration wird vor Commit
vollständig entfernt. Konto-/Objekt-/Rollenprüfungen blieben aktiv.

Bereits tatsächlich geprüft:

- Admin kann den fremden Reihenentwurf öffnen; Manager ohne Zuweisung erhält 404.
- Reihen-Editor und globaler Editor speichern eigene Entwürfe über die echten
  Next-Actions; gespeicherte Texte bleiben nach Neuladen erhalten.
- Globale freigegebene Frage beim Manager nur lesbar, keine Bearbeitungs-/Kopieraktion;
  Quizverwendung zeigt ausschließlich das eigene verwaltbare Quiz.
- Mehrfach zugeordnete Frage ist für den Reihen-Editor lesbar, aber schreibgeschützt.
- Zuständiger Manager gibt den vollständigen Reihenentwurf erfolgreich frei.
- Manager mit Rechten für beide Reihen versucht, ein separates QA-Quiz mit einer
  ausschließlich Reihe A zugeordneten Frage nach B zu verschieben: verständliche
  Ablehnung, Quiz bleibt in A, Inhalte bleiben erhalten.
- Synthetisches Quiz starten; separate echte Präsentation nach Freigabe zeigt die
  synchronisierte Frage. Anonymes synthetisches Team tritt bei und speichert „Zwei“;
  nach Neuladen werden Sitzung und Antwort wiederhergestellt.

- Offener eigener Entwurf 107: Zuordnung des Editors entfernt, danach im bereits
  geöffneten Formular Speichern versucht. Redaktionszugriff verloren; erneuter
  Direktaufruf ebenfalls abgewiesen. DB-Leseprüfung bestätigt unveränderten Text
  und null verbliebene Zuweisungen.
- Offene globale Editor-Sitzung: synthetisches Konto deaktiviert, danach Speichern
  versucht. Rückleitung zur Anmeldung; DB-Leseprüfung bestätigt inaktives Konto
  und unveränderten Entwurf.
- Wechsel zur Auflösung: Moderation zeigt eine Antwort und 100 Prozent Quote;
  Präsentation zeigt die richtige Lösung, Teamformular ist gesperrt mit
  „Beim Schließen automatisch übernommen“. DB-Leseprüfung bestätigt genau eine
  finale Submission, `CORRECT`, `1.0000` Punkte. Keine bestehende Sitzung zurückgesetzt.

Vor Integration zusätzlich erforderlich: grüne CI am genauen Head und
abschließende Review. Die geänderten Regeln wurden nicht nur anhand von Code oder
ausgeblendeten Menüpunkten bewertet. Screenshots liegen als lokale Abnahmebelege
`authorization-quiz-change-blocked.png` und `authorization-public-resolution.png` vor.

## Bewusst unverändert / Grenzen

Kein neuer globaler Kopierpfad, keine Reaktivierungsrechte für Nicht-Admins und kein
anonymer Zugang zur bisher angemeldeten Publikumspräsentation. Keine Rückholung von
bereits ausgelieferten Browserinhalten und kein zentraler Abbruch gleichzeitig schon
autorisierter Aufrufe. Die vorläufige frühere Analyse gilt nicht als vollständige
Sicherheitszertifizierung aller übrigen Endpunkte.

`PRIVATE_READBACK_FAILED` bleibt ein ungeklärtes historisches Betriebsproblem;
dieser Berechtigungsfix behauptet keinen Ursachenfix und ändert weder Backupdiagnose
noch Wochenplan. Der echte Wochenplan-Nachweis bleibt separat zu bewerten.

## Release

Merge-/Deployment-Ergebnis und genaue Commit-/Deployment-URLs gehören in das
abschließende PR-Protokoll. Integration erst nach vollständiger Abnahme,
grüner erforderlicher CI am konkreten Head und abschließender Review. Bestehende
Production-Environment-Freigaben und Schutzregeln bleiben unverändert. Anschließend
ausgelieferten Commit erneut am Runtime-Monitor verifizieren und nur lesenden
Production-Smoke durchführen; kein Session-Reset. Geöffnete Ansichten nach einem
Release neu laden und die Präsentation wieder freigeben.
