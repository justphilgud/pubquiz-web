# PR #160: Matching-Ansicht und Suche

## Gehostete technische Abnahme bestanden

7. November 2026. Die zuvor fehlende menschliche Freigabe für genau
`codex/bingo-matching-ux-polish` wurde ausdrücklich erteilt und umgesetzt.
Vorhandene Allowlist-Einträge, Branch-Policies und Environment-Schutzregeln sind
nachweislich erhalten; keine Wildcards. Der Branch ist zusätzlich vom gemeinsamen
Migrationsjob ausgeschlossen und exakt an seine eigene Datenbank gebunden.

**Vollständig gehostet geprüfter Anwendungsstand:**
`f51390b3f6c1ff311787112f2d60903ce1442cf3`.
[Push-CI](https://github.com/justphilgud/pubquiz-web/actions/runs/42415800967) und
[PR-CI](https://github.com/justphilgud/pubquiz-web/actions/runs/42415803638) vollständig
PASS. Die nachfolgende Änderung enthält nur Browser-Prüfharness, Nachweise und
Dokumentation; keinen Anwendungscode. Abschließender Head, dessen CI und erneut
abgeglichene Alias-/Runtime-Revision werden in [PR160](https://github.com/justphilgud/pubquiz-web/pull/160)
ausgewiesen. Reviewbereit erst nach diesen abschließenden Prüfungen.

### Direkte Preview und isolierte Daten

[Ungestarteter Abnahmefall – Matching-Tabelle](https://pubquiz-web-git-codex-bingo-matching-ux-polish-just-phil-gud.vercel.app/bingo/f4f47ffe-e986-45a1-a11a-c32412175ca0/matching?round=31fbbca7-6520-4b19-b4f3-4c2d9428e95b).
Anmeldung mit dem vorhandenen synthetischen Admin oder Manager aus der privaten,
ignorierten lokalen Zugangsdatei. Keine Zugangsdaten im Repository oder PR.
Der Abnahmefall wurde zweimal vollständig geöffnet/neu geladen und dabei nicht verändert.

Erstes verifiziertes Deployment: `dpl_5QW2giQ6CyvQWoRwe9Hoha834kbt`,
[Deployment-URL](https://pubquiz-3w8bxcio9-just-phil-gud.vercel.app), READY.
Branch-Alias und authentifizierte `/api/admin/monitoring`-Runtime bestätigen exakt
diesen Commit, Preview-Umgebung und erfolgreiche Datenbankleseprüfung.
Der finale Dokumentations-Head wird anschließend erneut über denselben geprüften
Git-Preview-Prozess ausgeliefert und im PR nachgewiesen; die erste URL wird dadurch
nicht als finale Revision ausgegeben.

- Eigene Datenbank **bingo_matching_ux_review**, bestehendes Launch-Nonprod-Projekt
  **falling-sky-48140800**, Endpunkt **ep-holy-term-baa881iq**.
- Tatsächlich geprüft: ein Read-write-Compute, **0,25 CU** Minimum/Maximum,
  Suspendierung nach **300 Sekunden**, keine zusätzliche Compute oder Replikate.
- Neue leere Datenbank erhielt ausschließlich die geprüfte eigene lokale Schema-Basis,
  fünf synthetische Konten und 268 synthetische Quellen inklusive des 210/50-Suchfalls.
  Keine echten Benutzer, Quizze, Teams oder Live-Durchläufe. Vier Karten nur im
  gesonderten schreibgeschützten Prüffall; der eigentliche Abnahmefall hat keine Karten.
- Keine neue Anwendungsmigration, kein Zurücksetzen/Baseline/Resolve einer bestehenden
  Migrationshistorie. Die bekannte historische Bootstrap-Grenze bleibt: Schema-Basis
  ist kein behaupteter Replay aller historischen Prisma-Migrationen. Kein bestehendes
  Development-, Matching-, Druck- oder Production-Ziel migriert oder zurückgesetzt.
- Nur vier genaue Vercel-Branch-Overrides für Datenbank/EXPECTED_DATABASE-Werte;
  andere Environment-Metadaten unverändert geprüft. Medien im eigenen Präfix
  `preview/f328f8ab8997e3ea86ddb4103c4ce6017cbadec34b17fbe07fbf619dbd02c6e2/`.
  Zentrale Medienkonfiguration geerbt, keine Medien-Credentials exportiert und keine
  fremden Medien geändert/gelöscht.

### Tatsächlich gehostet geprüft

| Bereich | Ergebnis |
| --- | --- |
| Vollständige Oberfläche | Echter AppHeader, ursprüngliche Phil-Gud-Schrift, 1366×768, 1280×720, 390×844; Seite/Zeilen/Dialog ohne horizontalen Überlauf |
| Bedienung | Native Tab-/Escape-Bedienung, Fokus zur Lupe zurück, letzte Zeile über Speicherleiste; tatsächlicher nativer Abbruch erhält Seite und Eingabe |
| Persistenz | Echte Server Actions, unveränderliche Speicherung, voller Reload und erneutes Öffnen; echter Zwei-Fenster-CAS erhält abgewiesenen Entwurf |
| Zeilen/Filter | 15–26/Sammelaktionen, versteckte Einträge erhalten, alle 90 gespeichert, 76–90-Hinweis, inaktive Alternative erhalten, Drucktextkopplung, Dubletten und ausgeblendete Fehler |
| Suche | 210 Bilder vor 50 Audioquellen: 20/20/10, letzte Teilseite, Filterwechsel zur ersten Seite, tatsächliche Vorlagennamen hinter Quelle 200, stabile Codes, lange Auswahl vollständig im Kontext |
| Medien/Karte | Original/Rückwärts × Interpret/Titel/Kombination und eigener Text jeweils tatsächlich übernommen/gespeichert/neu geladen; geschützte Bildvorschau 320px mit Japan-Kartenantwort geladen |
| Fehlende Quellen | Browser-TTS ohne Datei und fehlende tatsächliche Datei über echte Quellenantworten getrennt erklärt; Übernahme in beiden Fällen gesperrt |
| Netzwerkfehler | Tatsächliche Browseranfragen gezielt gestört: Vorlagen-/Suchfehler sichtbar, Wiederholen erfolgreich, Entwurf erhalten; keine simulierten Server Actions |
| Verspätete Anfrage | Echte Anfrage im Browser verzögert, Filter inzwischen geändert; anschließend keine alten Treffer unter dem neueren Filter |
| Frische Quellenprüfung | Freigabe der eigenen synthetischen Quelle nach Auswahl entzogen; Übernahme abgewiesen, Dialog und Hauptentwurf erhalten; Freigabe danach wiederhergestellt |
| Rollen/Objekte | Frische getrennte Anmeldungen: Admin/Manager positiv; Editor/reine Verwaltung/unzugeordnet negativ. Fremde Reihe und manipulierte Rundenzuordnung404 |
| Nur Bingo-Zugriff | Quiz-Produkt im eigenen synthetischen Fall kurz deaktiviert: Bingo-Editor erreichbar, Quellen und Vorlagen leer; Produkt danach wiederhergestellt |
| Tatsächliche Schreibabweisung | Rechte- sowie Bingo-Produktentzug nach Öffnen: Server lehnt Save aus alter Ansicht ab; Entwurf, Vorbereitungsrevision und Zahl der Fassungen unverändert. Direktlink ebenfalls abgewiesen; eigene Fixture exakt wiederhergestellt |
| Bestand | Verwendete Kartenrunde sichtbar schreibgeschützt; 4 Karten unverändert. Sauberer Abnahmefall weiterhin DRAFT, 0 Kartenserien, 0 Live-Durchläufe |
| Ruhephasen | Je 10 s vor Öffnen, im ruhenden Dialog und nach Schließen: 0 weitere Quellen-POSTs. 60 gezielte Server Actions im funktionalen Hauptablauf, 81,142 s zwischen erstem/letztem protokollierten Bingo-Request; keine Transfer-/Kostenhochrechnung |

Der Hauptablauf umfasst 22 protokollierte Prüfgruppen, ergänzt durch zwei tatsächliche
Schreibabweisungsfälle und die gesonderte Bild-/Datei-/TTS-Prüfung. Lokale/CI-Nachweise
unten bleiben erhalten: 36 Vorbereitungstests, 37 Bingo-Tests, 39 gezielte Quiz-/Quellen-/
Medien-/Navigationsprüfungen, Typecheck, strikter Changed-file-Lint, Build und vollständige
PostgreSQL-Abnahme. 54 Preview-/Trust-/Umgebungs-Guards zusätzlich PASS.

Reproduzierbarer vollständiger Browserablauf nach Einrichtung der eigenen Fixture:
`node scripts/testing/bingo-matching-ux.browser.mjs --hosted`.
Der Parameter bindet genau diesen Preview-Alias und diese eigene synthetische
Datenbank; der Default bleibt die eigene lokale Prüfung. Der vorhandene private
Automation-Zugang bleibt ausschließlich im Prozess; kein Schlüssel im Testprotokoll.

Grenzen: automatisierte Headless-Browser mit echten Seiten/Serveraktionen, keine
menschliche fachliche Abnahme behauptet. Keine physischen Mobilgeräte, Bildschirmtastatur,
Beamer oder hörbare Audioprüfung. Ein zusätzlich versuchter Video-Upload im Standardtemplate
wurde vom bestehenden Medienvertrag korrekt abgewiesen; keine Freischaltung oder neue
Film-/Serienvorlage ergänzt und keine neue gehostete Video-Wiedergabe behauptet.
Keine Codeblocker in der Matching-Überarbeitung gefunden. Historische Betriebs-/Bootstrap-
Themen werden nicht als durch diesen PR behoben dargestellt.

[Bereinigte gehostete Nachweise, Runtime-/Alias-/Datenbank- und Netzwerkprüfung](./hosted-20261107/results.json).

### Aktuelle Screenshots

| Ansicht | Bilder |
| --- | --- |
| Laptop 1366×768 | [Vollständige Seite](./hosted-20261107/page-1366.png) · [Zeilen](./hosted-20261107/rows-1366.png) · [Suchdialog](./hosted-20261107/dialog-1366.png) |
| Laptop 1280×720 | [Seite](./hosted-20261107/page-1280.png) · [Dialog](./hosted-20261107/dialog-1280.png) |
| Mobil 390×844 | [Seite](./hosted-20261107/page-390.png) · [Zeilen](./hosted-20261107/rows-390.png) · [Dialog](./hosted-20261107/dialog-390.png) |
| Zustände | [Fokus letzte Zeile](./hosted-20261107/last-row-390.png) · [Schreibschutz](./hosted-20261107/locked-1366.png) · [echte Bildvorschau](./hosted-20261107/image-preview-1366.png) |
| Sauberer Abnahmefall | [Laptop](./hosted-20261107/review-1366.png) · [Mobil](./hosted-20261107/review-rows-390.png) |

### Sechs Schritte für die fachliche Abnahme

1. Den direkten Abnahme-Link mit dem synthetischen Admin/Manager öffnen; Event und Runde prüfen.
2. Bei Kugel 2 „Zahl beibehalten“ umschalten: vorbereitete Alternative bleibt, „Gedruckt“ zeigt die Wirkung.
3. Bereich 15–26 und Sammelaktionen prüfen; danach 1–90 und erhaltene ausgeblendete Zeilen ansehen.
4. Lupe öffnen, „Fragevorlage“ durchsuchen und Medientyp filtern; Escape schließt zuerst Auswahl, dann Dialog.
5. Musikquelle wählen, Variante und Kartenantwort unabhängig ändern; übernehmen, speichern und vollständig neu laden.
6. Unspeicherte Änderung abbrechen und den Wechsel verwerfen; für CAS zwei Fenster vor dem ersten Save öffnen, dann im zweiten speichern.

**Kein Merge und kein Production-Deployment. Keine produktiven Daten, Rechte oder Sessions geändert.**

---

## Vor der Branch-Freigabe: lokale Vollabnahme (historischer Stand)

7. November 2026. Geprüfter Anwendungscode: **8342344f5f52c1f8644093bfab4cf5e3e3610bfa**, Suchfix **2bf183b8**; Fortsetzung von `80438bad`. Der folgende Dokumentations-/Harness-Lint-Commit verändert keinen Anwendungscode. Abschließender Head und erforderliche CI-Läufe stehen in [PR #160](https://github.com/justphilgud/pubquiz-web/pull/160).

**PR bleibt Draft.** Sowohl die externe Vertrauensliste als auch die exakte Preview-Environment-Branch-Policy enthalten **nicht** `codex/bingo-matching-ux-polish` (erneut lesend geprüft). Die [bestehende Vorgabe](../../architecture/media-upload-environments.md#explizite-branch-vertrauensprüfung-freigegebener-rollout) verlangt eine separate menschliche Vertrauensprüfung. Keine Schutzregel geändert, kein fremder Branch/Alias genutzt und kein Hostingversuch mit Preview-Secrets gestartet. Kleinster nächster Schritt: exakte Branch-Freigabe, danach geprüfte isolierte Bindung, normale Preview-Guards/Head-CI, Deployment mit READY/Alias/Runtime-SHA und tatsächliche gehostete Browserabnahme. Lokale Prüfungen ersetzen diesen offenen Teil nicht.

### Fertige Umsetzung

- Bestehende Phil-Gud-Ansicht, Icon-Lupe, Modal/Input/Select/Button, Quiz-Quellenpolicies, Dirty-Guard und CAS wiederverwendet. Keine parallele Neuentwicklung.
- Bedeutung von „Zahl beibehalten“, erhaltene Alternativen, ausgeblendete Auswahl und schreibgeschützte Runden erklärt. Vollständiger ausgewählter Vorlagenname, Variante und wirksamer Drucktext lesbar. Fokus und letzte Zeile bleiben über der Speicherleiste. Nur Matching-CSS geändert.
- **Reproduzierter Fehler:** Medientyp und Leserechte wurden erst nach der 20er-Seitengrenze gefiltert. Bei 210 Bildern vor 50 Audioquellen erschien die erste Audioseite leer. Derselbe isolierte Bestand liefert jetzt **20/20/10**.
- Alle Filter vor SQL-Pagination; ursprüngliche Vorlage vor technischer Basis, gleiche Namen mit getrennten Codes. Vorlagen hinter Quelle 200 vorhanden. Trefferlisten liefern nur Kennung/Titel/Vorlagenname; Optionen nur Rechte-/Vorlagenmetadaten ohne Frageninhalte, Antworten, Medienpfade oder Assets. Abschließende Objektpolicy bleibt.
- Suche nach 250 ms Eingaberuhe, Filterwechsel zur ersten Seite ohne alte Treffer; serialisierte/coaleszierte Anfragen ignorieren verspätete Antworten. Getrennte Lade-/Fehler-/Leerzustände mit Wiederholen. Quelle, Revision, Antworten und tatsächliche Datei werden unmittelbar vor Übernahme frisch geprüft; Fehler/Entzug verändern den Entwurf nicht still. Kein Quellenpolling.

### Tatsächliche Prüfungen

| Prüfung | Ergebnis und Einordnung |
| --- | --- |
| Vollständige Next-Seite | PASS im **lokalen Production-Build**, eigener Loopback-Datenbank, echter AppHeader, echte Server Actions und frische Passwortanmeldungen; kein Hosted-/Production-Nachweis |
| Viewports | 1366×768,1280×720,390×844; Seite/Zeilen/Dialog ohne horizontalen Überlauf; native Tab-/Escape-Bedienung, Fokus über Speicherleiste |
| Persistenz | Tatsächlich gespeichert, neue unveränderliche Fassung geladen, kompletter Dokument-Reload und erneutes Öffnen |
| Abbruch/CAS | Nativen Browserdialog automatisch abgebrochen: Seite/Eingabe erhalten; zwei echte Fenster derselben Revision: zweiter Save abgewiesen, Entwurf erhalten |
| Zeilen | 15–26/Sammelaktionen, versteckte Zuordnung erhalten, alle 90 Einträge, 76–90-Hinweis, erhaltene inaktive Alternative, Drucktextkopplung, Dubletten und Fehlerzusammenfassung |
| Medien | Original/Rückwärts jeweils Interpret/Titel/Kombination sowie eigener Kartentext tatsächlich übernommen, gespeichert und neu geladen |
| Rollen | Frische separate Browserkontexte: Admin/Manager positiv; Editor/reine Verwaltung/unzugeordnet negativ. Fremde Reihe, Quiz-Produkt- und Quellenentzug zusätzlich mit echtem PostgreSQL geprüft |
| Bestand | Eigener Fall mit vorhandenen Karten: Erklärung und effektiver Fieldset-Schreibschutz; keine neue Karte/Druckfassung durch den Editor |
| Fehler/Rennen | Echte Komponenten mit **simulierten** Serverantworten: Metadaten-/Suchfehler und Wiederholen, schnelle Wechsel, verspätete Quelle, Schließen/Öffnen, Doppelübernahme, frischer Entzug/geänderte Revision |
| Netzwerk | Je 10 s vor Öffnen, im ruhenden Dialog und nach Schließen: **0 weitere Quellen-POSTs**. 45 Server Actions im Funktionsablauf, 48,125 s zwischen erstem/letztem protokollierten Bingo-Request; keine Transferraten-/Kostenhochrechnung |
| Regression | Vorbereitung **36**, Bingo **37**, relevante Quiz-/Quellenrechte-/Medien-/Navigationsverträge **39** PASS; sechs gezielte Request-/Policy-/Komponenten-/Harness-Tests PASS |
| PostgreSQL | Vollständige bestehende isolierte Abnahme PASS, erweitert um Pagination/200er-Metadaten, tatsächliche SQL-Projektion und frischen Produkt-/Quellenentzug. Alle bisherigen Karten-, Medien-, CAS-, Laufzeit-, Polling-, Katalog-/Integritätsprüfungen erhalten |
| Checks | Typecheck und strikter Lint PASS; `npm run build -- --webpack` PASS. Dokumentierter Bundler, da extern verlinktes node_modules lokales Turbopack verhindert |

Die vorhandene PostgreSQL-Suite erzeugt eigene **wegwerfbare lokale** Datenbanken und führt dort ihre bestehenden Schema-/Snapshot-/Restore-Regressionen aus. Keine bestehende Abnahmedatenbank zurückgesetzt, kein Production-Backup/-Restore. Alte lokale Fälle erhalten, neue synthetische Fälle ergänzt. Keine neuen Neon-Ressourcen, Dependencies, Migrationen oder Schemaänderungen.

Der Entwicklungsserver aktualisierte beim CAS-Test auch das zweite Fenster; der eigentliche Nachweis erfolgte deshalb ohne HMR im optimierten lokalen Build. Keine Änderung am bestehenden Speichervertrag nötig. Bestehende Warnungen außerhalb des Deltas: PDF.js-Worker benannter Export und pg-Hinweis zu parallelem client.query im vorhandenen Adapter. Keine beiläufige Reparatur oder Testabschwächung. Quizoberfläche, Live-/Polling-Code und Druckrenderer unverändert.

[Ergebnisse und bereinigtes Netzwerkprotokoll](./full-page-20261107/results.json). Physische Mobilgeräte, Bildschirmtastatur, Beamer und hörbare Audiowiedergabe nicht als geprüft behauptet. Keine menschliche Abnahme aus automatisierten Tests abgeleitet. Gehostete Rollen-/Browserabnahme ausdrücklich offen.

### Screenshots der vollständigen Anwendung

Neue Bilder: lokaler optimierter Next-Build des genannten Anwendungscodes, echte Anmeldung/AppHeader, synthetische Daten. Kontrollierter Vergleich mit identischem Titel und denselben ursprünglichen 90 Einträgen in einem weiteren eigenen ungestarteten Objekt; technische Medien-Asset-IDs bleiben spielgebunden. Vorherbilder: Entwicklungsserver `80438bad` mit Dev-Indikator. Keine rekonstruierte HTML-Ansicht.

| Ansicht | Nachher | Vorher `80438bad` |
| --- | --- | --- |
| 1366×768 | [Seite](./full-page-20261107/page-1366.png) · [Zeilen](./full-page-20261107/rows-1366.png) | [Seite](./full-page-20261107/before-page-1366.png) |
| 1280×720 | [Seite](./full-page-20261107/page-1280.png) · [Zeilen](./full-page-20261107/rows-1280.png) | [Seite](./full-page-20261107/before-page-1280.png) |
| 390×844 | [Seite](./full-page-20261107/page-390.png) · [Zeilen](./full-page-20261107/rows-390.png) | [Seite](./full-page-20261107/before-page-390.png) |
| Suchdialog | [1366](./full-page-20261107/dialog-1366.png) · [1280](./full-page-20261107/dialog-1280.png) · [390](./full-page-20261107/dialog-390.png) | [Alter Dialog](./full-page-20261107/before-dialog-1366.png) |
| Zustände | [Letzte Zeile mit Tastaturfokus mobil](./full-page-20261107/last-row-390.png) · [Gesperrte Runde](./full-page-20261107/locked-1366.png) | – |

[Ungestarteter Abnahmefall: Laptop](./full-page-20261107/review-1366.png) · [vorbereitete Alternative mobil](./full-page-20261107/review-390.png). Dieser Fall wurde zweimal vollständig geöffnet/neu geladen und dabei nicht verändert.

### Lokaler Abnahmefall und sechs Schritte

[Ungestartete eigene Abnahme](http://127.0.0.1:3058/bingo/ef47865e-543b-417c-af50-930c91f710d7/matching?round=7c619599-1177-4d04-9165-d6fe0359b899). Nur am laufenden eigenen lokalen Server erreichbar; **keine gehostete Preview**. Bestehender synthetischer Zugang bleibt in der ignorierten privaten lokalen Datei. Keine Passwörter im Bericht/PR.

1. Als synthetischer Admin/Manager öffnen; Event/Runde, „Präsentation“ und „Bingokarte“ auf Laptop/Mobil prüfen.
2. „Zahl beibehalten“ bei vorbereiteter Alternative umschalten; Inhalt bleibt, „Gedruckt“ zeigt die Wirkung.
3. Bereich 15–26 auswählen, Sammelaktion prüfen; 1–90 wieder einblenden und erhaltene Zeilen ansehen.
4. Lupe öffnen; „Fragevorlage“ durchsuchen, Audio/Bild kombinieren; Escape schließt zuerst Auswahl, dann Dialog.
5. Musikquelle wählen; Original/Rückwärts und Kartenantwort unabhängig ändern, übernehmen, speichern, neu laden.
6. Entwurf ändern und „Abbrechen“ verwerfen; für CAS zwei Fenster vor dem ersten Save öffnen, dann im zweiten speichern.

### Geänderte Dateigruppen

- Ansicht: `MatchingEditor.tsx`, `MatchingEditor.module.css`, `MatchingTemplateSelect.tsx`; bestehende Seite erhalten.
- Suche: `SourcePicker.tsx`, `sourceRequests.ts`, `source.server.ts`, `sourceQuery.ts`; vorhandene Actions/Policies erhalten.
- Tests: Query-/Options-/Request-/Picker-Tests, bestehende PostgreSQL-Abnahme samt bisherigen Assertions, Browserharness/Parser und Testregistrierung.
- Dokumentation: [bingo-matching.md](../../architecture/bingo-matching.md), dieser Bericht und versionierte Screenshots. Vorversion unten erhalten.

**Kein Merge, kein Production-Deployment und keine produktiven Daten-/Rechte-/Sessionänderungen.**

---

# Historischer Stand 80438bad: Komponentenprüfung

Basis: PR #158, `6915ec447bde62a8b7d2a63efb53633c8edb44fd`.
Separater Arbeitsstand; keine Änderung der freigegebenen Release-Branch.

## Ergebnis

- Einstellungen, Bereichsauswahl und Tabellenzeilen sind getrennt gegliedert.
- Die vorhandene Icon-Lupe ist 44 × 44 px groß und bündig in die Medienauswahl integriert.
- Aktive individuelle Zuordnungen sind gelb markiert; Pink kennzeichnet Auswahlaktionen.
- Auf kleinen Bildschirmen stehen die Felder einer Kugel untereinander.
- Speicherstatus, Fehler und Konflikte stehen in der sichtbaren unteren Aktionsleiste.
- „Fragevorlage“ ist eine durchsuchbare Einzelauswahl mit tatsächlichen Vorlagennamen.
  Der frühere Stand hatte dort ein Freitextfeld, keine befüllte Dropdownbox.

## Ansichten

Diese Bilder zeigen die tatsächlichen React-Komponenten mit den bestehenden globalen
Styles, der Phil-Gud-Schrift und dem neuen lokalen CSS. Die Oberfläche ist für die
Prüfung mit synthetischen Beispieldaten und simulierten Serveraktionen gebündelt.
Der globale AppHeader ist in dieser isolierten Komponentenprüfung nicht montiert.
Die Bilder sind keine gehostete Preview oder Production-Aufnahmen.

| Ansicht | Bild |
| --- | --- |
| Desktop 1366 × 768 | [Editor](./editor-1366.png) |
| Desktop 1280 × 720 | [Editor](./editor-1280.png) |
| Mobil 390 × 844 | [Einstellungen](./editor-390.png) · [Zuordnungen](./rows-mobile.png) |
| Zuordnungen im Desktop-Scrollzustand | [Tabelle](./rows-desktop.png) |
| Vorlagensuche | [Dialog](./template-picker.png) |

## Prüfungen

- Typecheck und strikter ESLint der geänderten TypeScript-Dateien.
- Production-Build erfolgreich mit synthetischen CI-Prozessvariablen und lokalem
  Datenbankziel; keine echte Datenbank verbunden.
- `test:bingo-preparation`: 31 Tests einschließlich neuer Vorlagen- und Browserregression.
- `test:bingo`: 37 Tests.
- Lokaler Chromium-Komponentenablauf: alle drei Größen ohne horizontalen Überlauf,
  sichtbare Speicheraktion, Suchauswahl per Tastatur, exakter Vorlagencode an Suche,
  Escape schließt zuerst die Liste, Fokus kehrt zur Lupe zurück.
- Interpret/Titel unabhängig, Dubletten sperren Speichern, Textkopplung,
  verworfenes Abbrechen erhält Entwurf, simulierte Konfliktantwort erhält Eingaben,
  Speichern übergibt weiterhin 90 Einträge, Bereich 15–26, Sammelaktionen,
  Hinweis für 76–90 und gesperrte Runde geprüft. [Ergebnis](./local-results.json).
- Neue Serverregression verwendet simulierte Persistenz mit echter Quellenrechte-Policy:
  mehr als 200 Quellen, Vorlagen-Deduplizierung, Quellvorlagen-Priorität, Rechteentzug,
  verweigerter Spielzugriff, minimale Feldprojektion und exakter Codefilter.

Gezielte Tests sind reproduzierbar mit:

```sh
node --import tsx --test app/bingo/matching/sourceOptions.test.ts
CHROME_BIN=/path/to/chromium node --import tsx --test app/bingo/matching/MatchingTemplateSelect.browser.test.ts
```

## Dateigruppen und Architektur

- `app/bingo/[gameId]/matching/page.tsx`, `MatchingEditor.tsx`,
  `MatchingEditor.module.css`: Header, Gruppierung, mobile Zeilen und Speicherleiste.
- `SourcePicker.tsx`, `MatchingTemplateSelect.tsx`: lokale durchsuchbare Vorlagenauswahl.
- `actions.ts`, `source.server.ts`, `templateOptions.ts`: einmaliger, frisch autorisierter
  Metadatenabruf beim Dialogöffnen; Suche nach stabilem Code. Keine Mediendaten im
  Optionsabruf und kein zusätzlicher Pollingpfad.
- Zwei neue Regressionstests, Einbindung in `test:bingo-preparation`, aktualisierter
  [Fachvertrag](../../architecture/bingo-matching.md).

Bestehende gemeinsame UI-Komponenten werden benutzt, nicht geändert. Quiz, Liveplayer,
Druckrenderer, Datenmodell und Migrationen sind unverändert. Keine neue Projektabhängigkeit.

## Noch erforderliche gehostete Abnahme

1. Mit berechtigtem Konto Matching öffnen; Desktop und Mobilansicht vergleichen.
2. Lupe öffnen, tatsächliche Vorlagen auswählen und Treffer prüfen; globale und
   reihenspezifische Quellen sowie Konto ohne Quizzugriff gegenprüfen.
3. Original/Rückwärts und Interpret/Titel unabhängig zuweisen, speichern und neu laden.
4. Eine ungespeicherte Änderung abbrechen und den Abbruch verwerfen; anschließend
   einen echten Zwei-Fenster-Konflikt prüfen.

Keine echte Datenbank-, Hosting-, Upload-, Audio- oder Druckabnahme dieses Deltas.
Kein Production-Zugriff, Merge, Deployment, Session-Reset oder Änderung gespeicherter Karten.
