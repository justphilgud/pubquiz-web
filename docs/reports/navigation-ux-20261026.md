# Navigation PR #131: UX-Analyse und Entscheidungsentwurf

Stand: 26.10.2026. **Analyse, keine erneute Implementierung. Fachliche Abnahme steht aus.** Analysierter Anwendungshead: `62481160f43c3f8bbaf40329795523bff39df3e7`; Main-Grundlage `669700e9d1668ce74345dfcc259d8aff37b2c644`. [PR #131](https://github.com/justphilgud/pubquiz-web/pull/131).

## Empfehlung

**Format zuerst, Eventreihe innerhalb der Aufgabe.** Ein fester Hauptpunkt **Quiz** führt zu **Inhalte**, **Quizveranstaltungen**, **Teambestand** und – nur für Admin – **Präsentationstemplates**. **Bingo** und **PowerPoint-Karaoke** stehen für tatsächlich Berechtigte auf derselben Hauptebene, derzeit ausdrücklich nicht spielbar. **Eventreihen** hat einen festen gemeinsamen Einstieg; **Administration** einen festen globalen Einstieg für Admin. Ein Reihenwechsel ändert Filter und Daten, nicht die Hauptnavigation. Die bisherige Vorgabe „Eventreihe → Eventart → Arbeitsbereich“ wird bewusst ersetzt, das Rechtemodell bleibt unverändert.

[Entwurfsgalerie: fünf Aufgaben, jeweils Laptop und Mobil](navigation-ux-20261026/entwuerfe/index.html). HTML lokal öffnen; GitHub zeigt deren Quelltext. SVGs sind in der Galerie einzeln verlinkt und ohne Server darstellbar: [Quiz-Inhalte Laptop](navigation-ux-20261026/entwuerfe/01-inhalte-laptop.svg), [mobil](navigation-ux-20261026/entwuerfe/01-inhalte-mobil.svg).

## Methode und Grenzen

- Code, Prisma-Modell, serverseitige Policies/Actions und Routen gelesen. Die Matrix beschreibt belegte Funktionen, keine neuen Rechte.
- Isolierte gehostete Preview im Browser als vorhandener synthetischer Admin tatsächlich durchlaufen: Reihen-Quizverwaltung A → Quiz A → „Zur Übersicht“; globale Inhalte → Reihe A; Inhalte A → Bingo → Reihe B; Reiheneinstellungen B; globaler Teambestand → Teamprofil; Templates → Benutzerverwaltung; mobile Inhalte und Reihensuche mit **110 tatsächlichen Treffern**.
- Keine Werte gespeichert, Produkte/Rechte verändert oder Quizze gestartet/zurückgesetzt. Keine Productiondaten betrachtet. „Bestandsquiz“ bezeichnet das bereits vorhandene synthetische Quiz A.
- Desktopbeobachtung bei angefordertem Viewport 1366 × 768, mobil 390 × 844. Mobile Dokumentbreite 375 px einschließlich Scrollbar, kein horizontaler Überlauf. Die Entwürfe verwenden explizit 1366 × 768 bzw. 390 × 844 Zeichenflächen.
- Sechs Rollen wurden im vorherigen technischen Abnahmebericht tatsächlich geprüft. **In dieser UX-Runde nicht erneut sechs Konten angemeldet.** Rollenwege unten sind eine eigene heuristische Prüfung anhand der Policies und statischen Entwürfe; keine Nutzertests, Bedienzeitmessung oder Behauptung einer funktionalen neuen Oberfläche.
- Kalender, Import, Qualitätswerkzeuge und Live-Spezialansichten anhand des Codes eingeordnet, hier nicht erneut ausgeführt.
- Designmanifest §§3.3, 3.6, 3.10, 15: Hierarchie, verlässliche Wiederholung, Weglassen und Orientierung. Keine neue Designwelt oder Theme-Schicht vorgeschlagen.

## 1. Bestand und Zuordnung

A = Admin; M = Eventmanager der passenden freigeschalteten Quiz-Reihe; E = Reiheneditor; GE = globaler Quiz-Editor; V = separates Recht „Eventreihe verwalten“. Produkt- und Objektprüfungen gelten zusätzlich. Eine globale Sammlung gewährt keine globalen Bearbeitungsrechte.

| Funktion | Heutiger Einstieg | Zweck / tatsächlicher Bestand | Grenze / Format | Erforderliche Rechte und Codebeleg | Vorgeschlagener Platz |
|---|---|---|---|---|---|
| Start / Arbeitslisten | `/`, Schnellzugriffe | Entwürfe, Prüfungen, nächste Quizze, Qualität, Adminübersicht | Rolleabhängig, überwiegend Quiz | Actor-/Dashboardregeln in `app/page.tsx` | Logo → Start |
| Fragenbibliothek | `/content`, `/fragen`, Workspace `content/questions` | Suchen, bearbeiten, freigeben, klonen, archivieren, zuordnen | GLOBAL oder eine/mehrere Reihen; Quiz | `questionScopePolicy`: `canViewScopedQuestion`, `canEditScopedQuestion`, `canCloneScopedQuestion`. A; M/E erlaubte Reihen; GE eigene globale Entwürfe nach Status; freigegebene globale Fragen lesbar | Quiz → Inhalte, Typ Fragen |
| Story-Elemente | `/story-elemente`, `/content/story-elements/:id`, Workspace `stories` | Bild, Galerie, Text, Anekdote, Zitat, Portrait, Kapitelintro, Mediensequenz, Audio, Video, freie Mitteilung | GLOBAL, EVENT_SERIES oder QUIZ; heute Quiz | `storyElementPolicy`: View/Edit/Scope. Globale Anlage/Bearbeitung nur A; E eigene erlaubte Reihenentwürfe, M Reihen/Quiz | Quiz → Inhalte, Typ Story-Elemente |
| Eigenständige Umfragen | `/content/polls`, Workspace `polls` | Umfragen als Inhalt, Quizzuordnung, Live-Moderation | Global/Reihe/Quiz; heute Quiz | `app/umfragen/livePollRepository.server.ts`: bestehende Scope-/Objektregeln, keine Gleichsetzung mit globalen Fragenrechten | Quiz → Inhalte, Typ Umfragen |
| Inhalt erstellen | `/content/new`, jeweilige `new`-/Editorrouten, Workspace `new-*` | Frage, Story und Umfrage mit unterschiedlichen Formularen | Zulässiger Scope | `QuestionCreationPage`, `StoryCreationPage`, `PollCreationPage`; serverseitige Scopeprüfung | Aktion auf Inhalte-Seite |
| Prüfwarteschlangen / Aktualität | `/fragen?status=…`, Contentfilter | Entwürfe, Freigaben, Quellen/Prüffristen | Quiz, Objekt-/Rollenbereich | `searchFragen`, Scopepolicy; Review berechtigte M/A | Quiz → Inhalte, Arbeitsansichten/Filter |
| Fragenvorlagen | Editor-Templatewahl, `/admin/fragenvorlagen` | Fragetypen, dynamische inhaltliche Vorlagen, Vorschläge freigeben | Quiz, globaler Vorlagenkatalog | `loadDynamicQuestionTemplates`; Adminverwaltung `requireAdmin` | Nutzung im Editor; Administration → Quiz-Redaktion |
| Dateiimport / Transferexport | `/fragen/import`, bestehende Actions | Massenupload, Validierung, Transfer | Quiz, Scopegrenzen | `pruefeFragenImport`, `importFragenAusDatei`, `exportFragenFuerTransfer` in `app/fragen/actions.ts`: Admin | Administration → Quiz-Redaktion → Import & Export |
| Externe Fragen | `/admin/question-import` | OpenTDB-Pilot, prüfen/übernehmen/ablehnen | Globaler Quiz-Redaktionsprozess | Page/Actions `requireAdmin` | Administration → Quiz-Redaktion |
| Quizliste / Archiv / Schnellquiz | `/quiz`, Workspace `events` | Öffnen, regulär/Schnellquiz anlegen, kopieren, archivieren | Jedes Quiz gehört einer Reihe; heute Quiz | A/M; `requireQuizAccess`, `getQuizListe`; GE/E sind keine Quizmanager | Quiz → Quizveranstaltungen, Bestandsliste zuerst |
| Quizinhalt / Ablauf / Einstellungen | `/quiz/:id`, `/ablauf`, `/slides/*`, `/show/*`, `/quiz?editQuizId=…` | Blöcke, Fragen/Stories/Umfragen, Reihenfolge; Intro, Regeln, Preise, Start, Outro, Medien | Konkretes Quiz und tatsächliche Reihe | A/M; `requireQuizViewer/Editor`, Objektzuordnungen, Archivschutz | Quiz → Quizveranstaltungen → Quizdetails |
| Moderation / Präsentation / Antwortformular | `/quiz/:id/{moderation,praesentation,antworten}` | Live-Durchführung, Raumansicht, Teamteilnahme | Quiz, eigenständige Arbeitsoberflächen | Moderation A/M CONTROL_LIVE; Formular eigener öffentlicher Teilnahmevertrag; `quizProductActions`, `teamSession.server` | Aktionen am Quiz; Livefenster unverändert |
| Auswertung / Meme-Archiv / interne Testansicht / Diagnose | `/quiz/:id/{auswertung,meme-archiv,test,diagnose}` | Antworten/Punkte, Archiv, technische Prüfung | Quiz | Jeweilige Objekt-/API-Guards, keine Rechte allein aus Linkexistenz ableiten | Am Quiz Auswertung bzw. weitere Werkzeuge |
| Teamidentität | `/admin/teams`, `/:id`, Workspace `teams` | Wiederverwendbarer Name, Zugangswort, Avatar/Foto, Uploadsperre, Historie, Lifecycle | Globaler Datensatz, aktuell Quiz-Verwendung; kein direkter Reihenbesitz | A oder M über erlaubte Quizteilnahme; `teamManagementPolicy`, `teamManagement.server`; Archiv/Löschen nur A | Quiz → Teambestand |
| Teamteilnahme / Antworten / Punkte | Formular, Moderation, Auswertung | Teilnahme einer globalen Identität an einem Quiz | `quiz_team_sessions`, `quiz_teams`; Reihe indirekt über Quiz | Teilnahmevertrag; A/M serverseitig; `startGlobalTeamQuizSession` | Am Quiz „Teams & Teilnahme“ als Einstieg in vorhandene Teilnahmeübersicht |
| Präsentationstemplates | `/templates`, `/:id`, `/new` | System-/eigene Designs, Tokens/Layout, Renderingvertrag, Revision/Archiv/Vorschau; auch Moderation/Antwortformular | Global verwalteter **Quiz**-Darstellungsvertrag, kein gemeinsames Format-Theme | Pages/Actions `requireAdmin`; Repository/Lifecycle | Quiz → Präsentationstemplates (A) |
| Reihenstammdaten | `/admin/eventreihen`, `/:id`, Workspace `settings` | Name, Öffentlichkeit, Beschreibung, Reservierungslink-Vererbung, Status | Gemeinsame Reihe; Termine derzeit Quiz | VIEW erlaubte Reihe; EDIT A/V; Erstellen/Archiv nur A. `eventSeriesAccessPolicy`, Reihenactions | Eventreihen → Liste → Details |
| Reihenlogo | Reihendetail, `EventSeriesLogoEditor` | Logo mit bestehendem Uploadvertrag | Gemeinsame Reihe | A/V, Archivschutz; kein Produktrecht daraus | Eventreihen → Stammdaten & Logo |
| Reihen-Template-Standards | Reihenformular, Quiz-Vorbelegung/Override | Präsentations-/Antworttemplate-Vorgabe | Reihe gespeichert, semantisch Quiz | Bestehende Edit-/Zuweisungsregeln; V wird nicht Template-Admin | Reihendetails → Quiz-Vorgaben |
| Produktfreischaltung | „Freigeschaltete Eventarten“ im Reihendetail | Aktivieren/deaktivieren mit Schutz laufender Quizze | Gemeinsame Reihe, Produktentscheidung | `EventTypeProducts`, Productactions: A; V reicht nicht | Eventreihen → Eventarten, nur A bedienbar |
| Benutzer / Rechte | `/admin/users` | Globalrolle, Reihenrolle, unabhängiges Verwaltungsrecht | Globale Adminaufgabe | `canManageUsers`, Benutzeractions: A | Administration → Benutzer & Rechte |
| Kategorien | `/admin/kategorien` | Quizkatalog / Vorschläge | Quiz | `requireAdmin` | Administration → Quiz-Redaktion |
| Live-Textersetzungen | `/admin/live-text-replacements` | Bestehende Ersetzungsregeln öffentlicher Texte | Global gepflegt, Quiz/Live | Page `requireAdmin`; fehlt im neuen Adminmenü | Administration → Quiz-Redaktion |
| Monitoring / Styleguide / Template-QA | `/admin/monitoring`, `/admin/styleguide`, `/templates/{presentation-quality,storybook-experience}` | Betrieb, UI-/Darstellungsprüfung | Betrieb bzw. Quiz-Designwerkzeug | Monitoring `requireAdmin`; Styleguide-Page ohne gleichartige explizite Prüfung, Route authentifiziert. Hier keine neue Sicherheitsbewertung behauptet | Administration → Betrieb & Werkzeuge |
| Konto / Hilfe | Benutzermenü; `/settings`, `/profil/passwort`, `/hilfe` | Persönliche Einstellungen, Passwort, Hilfe | Gemeinsam | Eigenes angemeldetes Konto, jeweilige Actions | Feste Kontoposition |
| Kalender / Fragen einreichen | `/kalender`, Abo/Download, `/frage-einreichen` | Öffentliche Angebote | Kalender aktuell Quiztermine | `proxy.ts` Public Paths und eigene Route-/Actionregeln | Öffentliche Einstiege erhalten |
| Bingo / Karaoke | Workspace `bingo/karaoke` | Nur „Noch nicht verfügbar“ | Reihenprodukt + Rolle, kein Spiel | `getWorkspaceChoices`, `hasEventTypeAccess`; Karaoke M/A | Feste Formatposition für Berechtigte, keine Spielaktionen |

### Belege

Pfade relativ zum Repository, Funktionen als stabile Suchanker am oben genannten Head:

- [Navigator](../../app/workspaces/WorkspaceNavigation.tsx): `match/current/currentType/target`, `crossSeries`; [Policy](../../app/workspaces/workspacePolicy.ts): `getWorkspaceChoices`, `workspaceSwitchHref`; [Objektkontext](../../app/workspaces/workspace.server.ts): `loadLegacyWorkspaceContext`.
- [Workspace-Router](../../app/workspaces/[seriesId]/[eventType]/[[...area]]/page.tsx), [Adminmenü](../../app/workspaces/GlobalAdministrationNavigation.tsx).
- [Quizdetail](../../app/quiz/[quizId]/page.tsx): Rücklink `/quiz`; [Quizverwaltung](../../app/quiz/QuizManagementPage.tsx): Reihenfilter; [Quizaccess](../../app/quiz/quizAccess.server.ts).
- [Schema](../../prisma/schema.prisma): `teams`, `quiz_team_sessions`, `quiz_teams`, `eventreihen`, `presentation_templates`; [Teamzugriff](../../app/teams/teamManagement.server.ts): `teamScopeWhere/loadTeamManagementPage/loadTeamDetail`; [Teamrechte](../../app/teams/teamManagementPolicy.ts); [Teamstart](../../app/teams/teamSession.server.ts).
- [Fragenscope](../../app/fragen/editor/questionScopePolicy.ts), [Storyrechte](../../app/story-elemente/storyElementPolicy.ts), [Umfragerechte](../../app/umfragen/livePollRepository.server.ts), [Inhaltsmodell](../../app/components/content/contentLibrary.ts).
- [Reihenrechte](../../app/eventreihen/eventSeriesAccessPolicy.ts), [Reihenactions](../../app/eventreihen/actions.ts), [Rollenpolicy](../../app/roles/roleAssignmentPolicy.ts).
- [Templateübersicht](../../app/templates/page.tsx), [Templateactions](../../app/rendering/presentationTemplates/actions.ts), [Reihendetail](../../app/admin/eventreihen/[eventSeriesId]/page.tsx).

## 2. Reproduzierte UX-Befunde nach Priorität

Priorität bezeichnet Bedienprobleme, keine neuen Sicherheitslücken. Alle folgenden Wege wurden in derselben Adminsitzung ohne Rechteänderung beobachtet.

| Prio | Konkreter Weg / Befund | Auswirkung | Nachweis |
|---|---|---|---|
| Hoch | Reihe A → Quiz A → **Zur Übersicht** führt nach `/quiz`. Kopf wechselt von drei Eventarten plus Arbeitsbereichen zu „Eventreihe auswählen / Reihenübergreifend / Administration“ | Rückweg verliert den Reihenbereich. Erneute Orientierung nötig, obwohl kein Kontextwechsel beabsichtigt war | [Bestandsquiz](navigation-ux-20261026/beobachtungen/02-bestandsquiz.jpg), [danach](navigation-ux-20261026/beobachtungen/03-quiz-rueckweg-global.jpg) |
| Hoch | In `/content` → Reihe A auswählen landet Admin bei `/workspaces/117/quiz/events` | Ein Filter-/Kontextwechsel wird zum Aufgabenwechsel. Globaler Sammlung fehlt `area`; Managerfallback ist `events` | [Globale Inhalte](navigation-ux-20261026/beobachtungen/04-content-global.jpg); Ziel und Überschrift Quizveranstaltungen im Browser bestätigt |
| Hoch | Inhalte A → Bingo: **Inhalte / Quizveranstaltungen / Teams** verschwinden, gemeinsame Links rücken nach links. Bingo A → Reihe B (nur Quiz): Bingo/Karaoke verschwinden, Quizveranstaltungen öffnet | Produktverfügbarkeit muss geprüft werden; sie sollte aber nicht den Zugang zum gesamten Formatbereich entfernen. Menütopologie ändert sich beim Reihenwechsel | [Inhalte A](navigation-ux-20261026/beobachtungen/05-content-reihe.jpg), [Bingo](navigation-ux-20261026/beobachtungen/06-bingo.jpg), [Reihe B](navigation-ux-20261026/beobachtungen/07-reihe-b-quiz.jpg) |
| Hoch | Auf globaler Bibliothek, Teamprofil, Benutzerseite und Templates kein dauerhafter Hauptpunkt **Quiz** | Man muss die Datenorganisation kennen, bevor die tägliche Aufgabe erreichbar erscheint. Cross-Series-Quizliste existiert, aber ohne gleichwertigen festen Einstieg | Screens 03/04/09/10/11; `current && …` im Navigator |
| Mittel | Reihen-Quizseite enthält Kopf-Reihe, Pflichtfeld Eventreihe und Listenfilter „Alle Eventreihen“ trotz festem Reihenbereich | Drei ähnliche Kontrollen mit unterschiedlicher Wirkung; „Alle“ suggeriert einen Umfang, den die begrenzte Seite nicht liefert. Keine Datenleckage behauptet | [Anlegen](navigation-ux-20261026/beobachtungen/01-reihen-quizverwaltung.jpg); AX-Auswahl und serverseitiger Filter |
| Mittel | Inhalte A ergänzt Alle Inhalte/Fragen/Story-Elemente/Umfragen; daneben Filter „Inhaltstyp“; Überschrift bleibt **Content** | Format, Arbeitsbereich, Inhaltstyp und Suchfilter konkurrieren. Inhaltslinks und Arbeitsbereichslinks haben keinen eigenen `aria-current`-/Aktivstil | Screenshot 05; Workspace-Router/Navigator |
| Mittel | Reihenbereich nennt **Teams**, Adminmenü **Globale Teams**; Profil verliert Reihenkontext, Rückweg geht global | Suggeriert Reihenbesitz. Passwort/Profil gilt tatsächlich überall; Identitätsbearbeitung und Teilnahme sind verschiedene Aufgaben | [Teambestand](navigation-ux-20261026/beobachtungen/09-globale-teams.jpg); Teamprofil gelesen, Schema ohne Reihen-FK |
| Mittel | Reiheneinstellungen zeigt Quiz-Präsentationsdefault, Zugriff und Quizliste neben Logo/Produkten | Gemeinsames Branding und Quizgestaltung stehen nebeneinander; „Einstellungen“ ist fachlich kein reiner gemeinsamer Bereich | [Reihendetail](navigation-ux-20261026/beobachtungen/08-reiheneinstellungen.jpg) |
| Mittel | Mobil beansprucht Kopf mit Logo/Konto, Reihe, Formaten und Arbeitsbereichen rund 300 px; danach Inhaltsunterauswahl | Kein Überlauf, aber viele gleichgewichtige Ebenen vor der Aufgabe. Suchfunktion selbst funktioniert mit 110 Treffern; das Problem ist Hierarchie | [Mobil](navigation-ux-20261026/beobachtungen/12-mobil-content.jpg), [Suchliste](navigation-ux-20261026/beobachtungen/13-mobil-reihensuche.jpg) |
| Niedrig | Administration im Kopf und teilweise Benutzermenü/Dashboard; Spezialfunktionen fehlen in neuem Menü. „Templates“ bezeichnet Fragetyp, Präsentationsdesign und Reihenstandard | Verteilte Zugänge und unklare Begriffe; nicht jede Querverlinkung ist falsch, aber ein klarer Hauptweg fehlt | [Templates](navigation-ux-20261026/beobachtungen/10-praesentationstemplates.jpg); Codeinventar |

Der Eindruck „andere Anwendung“ ist eine **heuristische Wirkungseinschätzung**, keine gemessene Nutzeräußerung: Inhalt und Verwaltungsnavigation ändern gleichzeitig ihre Struktur. Die eigenständige Liveoberfläche ist dagegen sachlich begründet und soll unverändert bleiben.

## 3. Empfohlene Informationsarchitektur

```text
Logo / Start   Quiz ▾   Bingo   PowerPoint-Karaoke   Eventreihen   Administration   Konto
               Inhalte
               Quizveranstaltungen       (A/M)
               Teambestand               (A/M)
               Präsentationstemplates    (A)

Inhalte:             Typ + Suche + Fachfilter + Eventreihe als Datenfilter
Quizveranstaltungen: Bestandsliste + Suche/Status + Reihenfilter + Quiz anlegen
Quizdetails:         Quiz / Quizveranstaltungen / Quizname; Reihe als Objektmetadatum
Eventreihen:         Liste → Stammdaten & Logo / Eventarten / Quiz-Vorgaben
Administration:      Benutzer & Rechte / Quiz-Redaktion / Betrieb & Werkzeuge
Konto:               persönliche Einstellungen / Passwort / Hilfe / Abmelden
```

Die Quiz-Unterauswahl ist **eine** kompakte lokale Leiste oder ein Dropdown desselben Katalogs, nicht beides gleichzeitig dauerhaft. Die Entwürfe zeigen lokal die Leiste, mobil „Quizbereich“ mit denselben Zielen. Keine neue Hauptkategorie Content neben Quiz.

### Stabile Elemente und berechtigte Unterschiede

- Hauptpunkte pro Sitzung aus dem **gesamten aktuell berechtigten Katalog**, nicht aus der gerade ausgewählten Reihe. Ein Filterwechsel ändert weder Reihenfolge noch Sichtbarkeit der Hauptpunkte. Tatsächlich entzogene Rechte/Produkte dürfen den Katalog nach serverseitiger Prüfung ändern.
- Quiz bleibt auf Eventreihen-/Adminseiten erreichbar, sofern Quizrechte bestehen. Reine V-Konten sehen Eventreihen + Konto, keine erfundene Quizberechtigung. Keine unberechtigten Hauptpunkte als Produktwerbung.
- Arbeitsbereich markieren, auch beim geöffneten Objekt. Vollständiger Reihenname in Objektmetadaten mit Umbruch. Kein Objekt der vorherigen Reihe in den nächsten Kontext übernehmen.
- „Alle erlaubten Reihen“ ist ein Sammelfilter, **keine globale Eventreihe**. Globale Inhalte separat als Global kennzeichnen. Filter ändern keine Scope-/Bearbeitungsrechte.
- In Objektbearbeitung zeigt die Reihe tatsächlichen Besitz/Scope, keinen impliziten Verschiebungsmechanismus. Fragen mit mehreren Reihen entsprechend beschriften. Ein Navigationswechsel schreibt keine Zuordnung.
- Konto und Hauptmenü behalten feste Anker; mobil dieselben Ziele in einem benannten Menü, nicht mehrere unbeschriftete Textstreifen.

### Wo die Eventreihe ausgewählt wird

**Sammlungen:** Kein Zwang vor der Aufgabe. Zunächst alle erlaubten Datensätze, danach lokaler suchbarer Reihenfilter neben Suche/Status. Für 100+ Einträge genügt Suche in vorhandener erlaubter Optionsliste mit begrenztem Scrollbereich; keine neue Serverpagination. „Alle erlaubten Reihen“ setzt den Filter zurück. Gespeicherte Präferenz darf Direktlinks nie überschreiben.

**Anlegen:** Vor dem tatsächlichen Speichern eines Quiz muss die Reihe eindeutig sein. Bei eindeutigem Filter sichtbar vorbelegen, sonst im Formular wählen. Listenfilter und Objektzuordnung klar verschieden beschriften. Inhaltsformulare behalten ihre bestehende zulässige Global-/Reihen-/Quizscopewahl. Kein neuer globaler Storyzugriff für GE.

**Reiheneinstellungen:** Liste → konkrete Reihe, keine Formatpflicht. M/E dürfen nach heutigen VIEW-Regeln erlaubte Reihen lesen; Editieren nur A/V. Reine Verwaltung ohne Produkt ist vollwertig.

**Formatwechsel:** Hauptpunkt bleibt, wenn mindestens eine passende freigeschaltete und berechtigte Reihe existiert. Wenn der bisherige Reihenfilter dort nicht passt: keine automatische Rückleitung ins Quiz. „Diese Reihe bietet hier keinen Zugriff“ mit Auswahl zulässiger Reihen, Formatbereich erhalten. Admin kann Produkte in Eventreihen verwalten; Navigation aktiviert nichts.

**Entzug/Deaktivierung/ungültige ID:** Server weist Direktlink sicher ab, bietet Rückweg zur erlaubten Liste. Kein stiller Fallback auf andere Reihe oder frühere Daten. Ungespeicherte Formulare schützen; technische Detailprüfung gehört in spätere Umsetzung.

### Teams: Istmodell und Entscheidung

`teams` ist eine globale Identität mit eindeutigem normalisiertem Namen, Zugangswort, Avatar/Foto und Archivstatus. **Keine direkte `eventreihe_id`.** `quiz_team_sessions` verbindet Identität, Quiz, Anzeigename und Spielerzahl; Antworten/Stimmen hängen daran. `quiz_teams` enthält Quizzuordnung/Ergebnisse. Eine Reihenliste im Teamprofil wird aus Teilnahmen abgeleitet, nicht aus exklusivem Reihenbesitz.

Daher **kein allgemeiner Hauptpunkt Teams**. Unter Quiz bleibt **Teambestand** dauerhaft für A/M: Passwortsupport, globale Profile, Historie und Archiv sind reale Aufgaben auch außerhalb eines ausgewählten Quiz. M sieht Teams mit Teilnahme in seinen erlaubten Reihen und nur bestehende Funktionen; A auch unbenutzte Teams/globalen Lifecycle. Ein Reihenfilter begrenzt die Suche, nicht die globale Wirkung einer Profil-/Passwortänderung. Diese Wirkung muss im Profil weiter ausdrücklich stehen.

Am konkreten Quiz **„Teams & Teilnahme“ als Einstieg in die vorhandene Teilnahme-/Moderationsübersicht**. Das ist ein Entwurf, kein bereits vorhandener fertiger Quiz-Teamprofilmanager. Der vorhandene `TeamStatusPanel` zeigt Zähler, keinen vollständigen Teamprofilmanager. Moderation/Auswertung liefern bereits Teilnahmeinformationen. Bei Umsetzung den passenden bestehenden Einstieg wiederverwenden; eine vollständige direkt verlinkte Teilnehmerliste ist nötigenfalls als gezielte zusätzliche Leseansicht separat zu spezifizieren, nicht als schon vorhanden zu behaupten. Keine neue Teamzuordnungs-/Bewertungslogik. Zum globalen Profil mit sicherem Rückweg zum Ausgangsquiz. Lifecycle bleibt Admin-only.

Bingo könnte dieselbe Identität später nutzen; daraus folgen heute keine neuen gemeinsamen Rechte oder Teilnahmebeziehungen. Bei Karaoke ist schon das Teamkonzept offen. Deshalb ausdrücklich keine formatübergreifende Teamzentrale.

### Administration und Gestaltung

**Eventreihen** ist gemeinsame Reihenverwaltung; **Administration** globale Benutzer-/Redaktions-/Betriebsverwaltung. Feste Einstiege, verschiedene Rechte. Produktfreischaltung liegt in der Reihe, Benutzerzuordnung beim Benutzer; Querverweis statt doppelter Rechtepflege.

Logo ist ein belegter gemeinsamer Baustein. Präsentationstemplates sind bestehende Quiz-Rendering-/Variantenverträge; ihr Reihenstandard gehört in **Quiz-Vorgaben**, die globale Templatebearbeitung unter Quiz. Ein Templatefeld ist noch kein gemeinsames Branding für Bingo/Karaoke. Später braucht es einen ausdrücklich spezifizierten gemeinsamen Brandingvertrag für mehrere Renderer. Jetzt keine Konvertierung, neue Theme-Schicht oder erfundenen Formateinstellungen.

### Höchstens eine Alternative

**Feste Seitenleiste mit denselben Hauptpunkten**, Quizziele eingerückt, Reihenfilter weiter im Seiteninhalt. Vorteil: Ziele ständig sichtbar, wenig Dropdownlernen. Nachteil: kostet Laptopbreite, mobil wieder Drawer, größerer Eingriff in bestehende Layouts. **Empfohlen bleibt kompakter Kopf + eine Bereichsauswahl**, um Header und volle Inhaltsbreite besser wiederzuverwenden. Nur die bestehende Reihenhierarchie kleiner zu zeichnen würde die beobachteten Aufgabenwechsel nicht lösen.

## 4. Visuelle Entwürfe und heuristische Aufgabenprüfung

[Galerie](navigation-ux-20261026/entwuerfe/index.html): fünf vergleichbare Rahmensysteme, jeweils Laptop/Mobil. Mit „ENTWURF“ gekennzeichnete statische Navigation ohne Backendaktionen. Zusätzlich zeigen ein Rollenvergleich und ein geöffnetes mobiles Hauptmenü die berechtigten Unterschiede. `beobachtungen` enthält dagegen tatsächliche Ist-Screenshots. Keine Verwechslung von erprobtem Produkt und vorgeschlagenem Design.

1. **Quiz-Inhalte:** Frage/Story/Umfrage als Inhaltstyp, kein weiteres Hauptmenü; Reihenfilter bei der Aufgabe. Suchliste mit 110 synthetischen Einträgen gesondert visualisiert.
2. **Quizveranstaltungen/Bestandsquiz:** Liste zuerst, Anlegen als Aktion; Detailinset zeigt tatsächliche Reihe und Teilnahme-Einstieg.
3. **Eventreihen:** Stammdaten/Logo; Produkte und Quiz-Vorgaben getrennt, Quiz im Hauptmenü weiter erreichbar.
4. **Administration:** Benutzer & Rechte, Quiz-Redaktion, Betrieb; kein Reihenfilter über globaler Benutzerliste.
5. **Bingo:** gleicher Rahmen, „Noch nicht verfügbar“, keine Spielaktionen.

### Eigene heuristische Prüfung, keine Nutzertests

| Aufgabe | A | M (passende Reihe/Quiz) | E (passende Reihe) | GE | Nur V | Ohne Rechte |
|---|---|---|---|---|---|---|
| Frage bearbeiten | Quiz → Inhalte → Frage | gleicher Weg, M-Objektregeln | gleicher Weg; eigene erlaubte Entwürfe/Rückgaben, keine fremden Originale | eigene globale Entwürfe nach Statusregeln | nicht anbieten | nicht anbieten |
| Story finden | Quiz → Inhalte → Typ Story | gleicher Weg, erlaubte Stories | gleicher Weg, lesbare Stories; Edit separat prüfen | globale Stories lesbar gemäß Istpolicy, keine globale Bearbeitung suggerieren | nicht anbieten | nicht anbieten |
| Quiz öffnen | Quiz → Quizveranstaltungen → Quiz | gleicher Weg, erlaubte Quizze | keine Quizverwaltung | keine Quizverwaltung | keine Quizverwaltung | keine Quizverwaltung |
| Zugehörige Teams | Quiz → Quizveranstaltungen → Quiz → Teams & Teilnahme; Profil bei Bedarf | gleicher Weg, globaler Lifecycle gesperrt | nicht anbieten | nicht anbieten | nicht anbieten | nicht anbieten |
| Branding ändern | Eventreihen → Reihe → Logo | nur mit zusätzlichem V | nur mit zusätzlichem V | nur mit zusätzlichem V | Eventreihen → eigene Reihe → Logo | nicht anbieten |
| Benutzerrechte | Administration → Benutzer & Rechte → Benutzer | nicht anbieten | nicht anbieten | nicht anbieten | nicht anbieten | nicht anbieten |

M/E können je Reihe unterschiedliche Rollen haben: Aktionen und Filterwerte ändern sich entsprechend, der Standort der Hauptpunkte bleibt. M ohne Bingo-/Karaoke-Freigaben sieht diese Punkte nicht. E mit Bingo und Karaoke sieht Bingo (Platzhalter), keine Karaoke-Editorfunktion. Admin behält Formatüberblick; deaktivierte Produkte werden nicht automatisch freigeschaltet. V ohne Spielrolle sieht ausschließlich den gemeinsamen Reihenweg und Konto. Keine Rechte bedeutet Konto/Hilfe und klare Leerseite, kein Arbeitsmenü.

Heuristisches Ergebnis: Frage und Story liegen am gleichen erwartbaren Ort. Bestandsquiz und neues Quiz konkurrieren nicht um die erste Bildschirmhöhe. Teilnahmen liegen am Quiz, Identität im Teambestand. Branding und Benutzerrechte haben je einen festen Anfang. Ob die Begriffe und Unterauswahl ohne Erklärung verstanden werden, ist **erst anschließend mit echten Anwendern zu prüfen**. Keine gemessenen Klick-/Zeitvorteile behauptet.

## 5. Separat beauftragbarer Umsetzungsplan

**Keine Umsetzung durch diesen Analyseauftrag autorisiert.** Erst nach fachlicher Entscheidung, ohne Migration/Rechteänderung:

1. Stabile Hauptpunktmenge aus vorhandenen Policies über alle erlaubten Reihen bilden. GE und reine V-Konten separat abdecken. Bestehende Komponenten behalten Autorisierung/Datenzugriffe; neue Shell verantwortet nur Hierarchie, Ziele und Aktivmarker.
2. Formateinstiege auf bestehende übergreifende Sammlungen führen, Reihenfilter URL-gebunden. Workspace-/Objektdirektlinks kompatibel erhalten. Herkunft/Rückweg validieren: keine externen Return-URLs oder fremden Objekt-IDs. Keine gespeicherte Auswahl gegen Direktlinks.
3. Inhalte auf eine Bereichsebene plus bestehenden Inhaltstypfilter reduzieren, deutsche Begriffe. CRUD-/Freigabe-/Kopier-/Scopeverträge bleiben.
4. Quizveranstaltungen mit Bestandsliste zuerst, expliziter Anlegeaktion, Schnellquiz weiterhin erreichbar. Teilnahme-Einstieg in vorhandene UI; Teambestand/Profil global erklären und M-Grenzen erhalten. Rückkehr aus Teamprofil zum Ausgangsquiz.
5. Eventreihen und Administration fest einordnen; vorhandene Stammdaten/Logo, Admin-Produkte und Quizdefaults nur fachlich gruppieren. Präsentations- und Fragenvorlagen nicht zusammenlegen.
6. Browserabnahme mit sechs getrennten Testrollen und 100+ isolierten Reihen; Aufgaben ohne Erklärung mindestens mit Moderation und Redaktion prüfen. Noch keine Nutzertests terminiert/durchgeführt.
7. Regressionen: stabile Hauptpunkte, Kontextwechsel, Alt-/Objektlinks, Rückweg, manipulierte Queries, Entzug/Produktwechsel, Dirty-Guards, Tastatur/Escape/Fokus und Mobilmenü. Typecheck, geändertes ESLint, Build, CI; Liveoberflächen unverändert smoke-testen. Danach neue Preview zur fachlichen Abnahme, kein automatischer Release.

### Fachliche Entscheidungen und Risiken

| Offen / Risiko | Begründete Empfehlung |
|---|---|
| Formatnavigation über alle erlaubten Reihen stabil? | **Ja.** Gesamtkatalog statt aktuelle Reihe; sonst wiederholt sich das Verschwinden. Server prüft konkrete Zielberechtigung weiter. |
| Name der Veranstaltungsliste | **Quizveranstaltungen**, Untertitel „Bestehende und geplante Quizze“. Kein allgemeines „Veranstaltungen“ für noch nicht existierende gemischte Events. |
| Noch nicht verfügbare Formate | Für Berechtigte mit mindestens einer passenden Freischaltung sichtbar; Admin globaler Überblick. Ausdrücklicher Platzhalter, keine Aktivierung durch Navigation. |
| Teams als Hauptpunkt? | **Nein. Teambestand unter Quiz, Teilnahme am Quiz.** Spätere gemeinsame Nutzung erst fachlich klären. |
| Alle erlaubten Reihen oder Pflichtauswahl? | Sammlung zunächst erlaubter Gesamtbestand; konkrete Zuordnung erst beim Anlegen/Objekt. Kein heimlicher Scopewechsel. |
| Templates unter Quiz oder Administration? | **Quiz, Admin-only**, Badge „Global verwaltet“. Administration für Benutzer/Redaktionskataloge/Betrieb. Allenfalls Querverweis statt zweiter Verwaltung. |
| Globale Teamwirkung | Rückweg behalten, Profilwirkung deutlich global. Reihenfilter darf Passwort-/Fotoänderung nicht als lokal erscheinen lassen. |
| Alt-Routen und Dirty-Guards | Erhalten, Shell/Links gezielt ändern. Größtes technisches Risiko sind widersprüchliche URL-/Filterzustände und Datenverlust beim Wechsel, nicht die Menüzeichnung. |
| Nicht einheitliche Guards einzelner Werkzeuge | Navigation ist keine Sicherheitsgrenze. Bei Umsetzung auffällige Page-/Actionregeln separat verifizieren, kein stiller Rechteumbau im UX-Paket. |
| Gemeinsames Branding / gemischte Events | Eigener späterer Vertrag; vorhandenes Logo weiterverwenden. Keine künftigen Rechte/Datenstrukturen aus Mockups ableiten. |

## 6. Änderungen und Prüfstatus dieses Analysepakets

Ausschließlich dieser Bericht, statische SVG-/HTML-Entwürfe und synthetische Beobachtungsscreenshots unter `docs/reports/navigation-ux-20261026/`. Keine Anwendung, Migration, Abhängigkeit, Einstellung, Benutzerberechtigung oder Quizsession verändert. Gehostete Anwendungs-Preview bleibt `62481160`.

Asset-/Quelllinks und SVG/XML werden geprüft, Entwürfe im Browser gerendert und Anwendungsdiffs auf Unverändertheit kontrolliert. Typecheck/ESLint/Build werden für reine Dokumentation/SVG nicht unnötig wiederholt. Die erfolgreiche technische Prüfung des analysierten Heads bleibt erhalten, ersetzt aber **keine fachliche UX-Abnahme**.

PR #131 bleibt offen, nicht gemergt und fachlich nicht abgenommen. Kein Production-Deployment. Der ältere technische Abnahmebericht bleibt historisch erhalten; dieser Bericht ergänzt die UX-Bewertung, ohne Beobachtungen rückwirkend umzudeuten. Historischer PRIVATE_READBACK_FAILED-Befund und echter Wochenlauf sind separate Betriebspunkte.
