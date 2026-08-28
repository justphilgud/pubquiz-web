# Antwortformulare und Live-Interaction-Architektur

Stand: 17. August 2026

Dieses Dokument beschreibt die produktive Architektur der Team-Antwortformulare. Es ist die verbindliche technische Leitplanke für Änderungen an Antworttypen, Live-Interaktionen, Drafts, Submissions, Polls, Pixelbild und deren Auswertung. Es beschreibt den vorhandenen Stand; es ist kein Zielbild für ein paralleles System.

## Kurzfassung

Eine Quizfrage erhält nicht ihren eigenen Speicher- oder Submission-Workflow. Stattdessen wird aus ihrem Templatevertrag ein `ResolvedQuizAnswerInteraction` abgeleitet. Derselbe Contract steuert Darstellung, Payload-Validierung, Draft-Persistierung und Submission-Snapshot.

```text
Frage + Quiz-Zuweisung + Templatevertrag
                  |
                  v
      ResolvedQuizAnswerInteraction
                  |
        +---------+---------+
        |                   |
        v                   v
GenericAnswerRenderer   Interaction Run
        |                   |
        +---------> Draft --+--> Submission --> Bewertung
```

Die zentralen Identitäten sind:

- `quiz_fragen_id`: konkrete Zuweisung einer Frage zu einem Quiz;
- `quiz_team_session_id`: teilnehmendes Team in diesem Quiz;
- `team_id`: globale Teamidentität, auf die jede Quiz-Session stabil verweist;
- `interaction_run_id`: konkrete Öffnung einer Interaktion;
- `team_antwort_id`: aktuell persistierter Draft eines Teams für eine Quizfrage;
- `team_answer_submission_id`: unveränderlicher finaler Snapshot einer Draft-Revision.

## Verantwortlichkeiten und zentrale Dateien

| Verantwortung | Zentrale Datei |
| --- | --- |
| Templatevertrag und erlaubte Interaktionen | `app/rendering/templates/templateContract.ts` |
| Produktive Fragetemplates | `app/fragen/editor/templates/questionTemplates.ts` |
| Auflösung des effektiven Antwortformulars | `app/quiz/answerInteraction.ts` |
| Generische Eingabeelemente | `app/quiz/[quizId]/antworten/GenericAnswerRenderer.tsx` |
| Teilnehmer-Orchestrierung, Hydrierung und Autosave | `app/quiz/[quizId]/antworten/QuizAntwortClient.tsx` |
| Payload-Validierung und Rückwandlung in Drafts | `app/quiz/interaction/interactionPayload.ts` |
| Run-, Draft-, Submission- und Close-Lebenszyklus | `app/quiz/interaction/interaction.server.ts` |
| Zustandsautomat und serverseitige Schreibbarkeit | `app/quiz/interaction/interactionStateMachine.ts` |
| Resubmission- und Auto-Finalisierungsregeln | `app/quiz/interaction/interactionSubmissionPolicy.ts` |
| Teilnehmer-Live-Endpunkt | `app/api/quiz/team-live-snapshot/route.ts` |
| Auswahl sichtbarer und beschreibbarer Fragen | `app/quiz/quizAnswerLiveState.ts` |
| Blockfreigabe und Live-Revision | `app/quiz/quizBlockLiveState.ts` |
| Auswahl des für die Bewertung wirksamen Snapshots | `app/quiz/evaluation/effectiveSubmission.ts` |
| Basisbewertung | `app/quiz/evaluation/evaluateBaseAnswer.ts` |
| Pixel-Lifecycle und Punkteallokation | `app/quiz/interaction/pixelLiveInteraction.ts` |
| Poll-Aggregation | `app/quiz/interaction/pollInteraction.ts` |
| Persistenzmodell | `prisma/schema.prisma` |

Die öffentlichen Server-Action-Wrapper in `app/quiz/actions.ts` lösen zuerst die signierte Team-Sitzung auf und übergeben nur die interne `quiz_team_session_id` an den Interaction-Service.

## Interaction-Contract

`resolveQuizAnswerInteraction` verbindet den Templatevertrag mit den konkreten Daten der Quizfrage. Die Auflösung berücksichtigt:

- Template-ID und Kompatibilitätsauflösung;
- ursprünglichen und effektiven Antwortmodus;
- den quizspezifischen Override „freie Antwort erlauben“;
- Antwortoptionen in der für das Quiz gespeicherten Reihenfolge;
- strukturierte Antwortfelder;
- Template-Daten, etwa Einheit und Zahlenformat einer Schätzfrage oder Items einer Reihenfolge.

Das Ergebnis enthält ausschließlich ausführbare UI-Informationen. Ein Renderer muss weder Template-IDs interpretieren noch eigene Bewertungsregeln kennen.

Wichtige Fallbacks:

- Ein geschlossener Standard mit mehreren Optionen wird `SINGLE_CHOICE`.
- Ein geschlossener Fragetyp mit aktivem Freitext-Override wird `TEXT`, sofern der Vertrag dies erlaubt.
- Vorhandene strukturierte Antwortfelder werden `STRUCTURED_TEXT`.
- Fehlen einem historischen strukturierten Template die Felder, fällt es kontrolliert auf `TEXT` zurück.
- Ein nicht auflösbarer Vertrag ergibt `NO_ANSWER`; ein bekannter, aber noch nicht gerenderter Typ wird mit `supported: false` markiert.

Der bei Öffnung des Runs aufgelöste Contract wird in `quiz_interaction_runs.config_snapshot` gespeichert. Laufende Interaktionen bleiben damit an ihre konkrete Konfiguration gebunden.

## Run-Zustände

Produktive Interaktionen verwenden genau diesen Zustandsautomaten:

```text
LOCKED -> OPEN -> COUNTDOWN -> CLOSED -> REVEALED
            |         |
            +---------+------> CLOSED
```

`COUNTDOWN -> OPEN` ist für ein bewusstes Zurücknehmen des Countdowns zulässig. Idempotente Übergänge auf denselben Zustand sind erlaubt; alle anderen Übergänge werden abgewiesen.

Die Präsentationsnavigation erzeugt und synchronisiert den aktuellen Run. Die Blockfreigabe entscheidet, welche Fragen sichtbar und beschreibbar sind. Normale Interaktionen bleiben nach ihrer ersten Freigabe bis zum Schließen des Fragenblocks offen. Pixel-Runs folgen ihrer besonderen Stop- und Countdown-Semantik.

Schreibbarkeit wird immer serverseitig geprüft:

- Zustand `OPEN`, oder
- Zustand `COUNTDOWN` mit einer in Serverzeit noch nicht abgelaufenen `deadline_at`;
- passende Quiz-, Block-, Fragen-, Run- und Team-Identitäten;
- freigegebener, nicht geschlossener Block;
- bei Pixel zusätzlich die Stopper-Regeln.

Die deaktivierte Darstellung im Browser ist nur UX. Sie ersetzt keine dieser Prüfungen.

## Persistierte Artefakte

### Run: `quiz_interaction_runs`

Ein Run beschreibt eine konkrete Öffnung der Interaktion. Er enthält Zustand, Zeitpunkte, Revision und einen Konfigurations-Snapshot. Pro Quiz existiert höchstens ein `is_current = true`-Run. Historische Runs bleiben für nachvollziehbare Submissions erhalten.

### Draft: `team_antworten`

Pro `quiz_fragen_id × quiz_team_session_id` existiert höchstens ein aktueller Draft. Seine Inhalte liegen weiterhin in den etablierten Feldern und Relationen:

- `antwort_text` für Text, Zahl und serialisierte Reihenfolge;
- `antwort_id` beziehungsweise `team_antwort_auswahlen` für Auswahltypen;
- `team_antwortfelder` für strukturierte Antworten;
- `interaction_run_id`, `draft_revision` und `draft_updated_at` für den Live-Lebenszyklus.

Drafts sind veränderbar. Sie sind nicht automatisch die für die Auswertung maßgebliche Antwort.

### Submission: `team_answer_submissions`

Eine Submission ist ein unveränderlicher JSON-Snapshot einer bestimmten Draft-Revision. Wiederholtes Absenden derselben Revision ist idempotent. Wird der Draft während eines offenen Runs geändert und erneut abgesendet, entsteht eine höhere `submission_version`; ein bestehender Snapshot wird nicht überschrieben.

Die Statuswerte sind:

- `SUBMITTED`: vom Team ausdrücklich abgesendet;
- `AUTO_FINALIZED`: beim Schließen aus einem inhaltlich gefüllten Draft erzeugt.

## Vollständiger Datenfluss

### 1. Laden und Contract-Auflösung

`app/quiz/[quizId]/antworten/page.tsx` lädt Antwortstatus und Theme. Der Server löst für jede sichtbare Zuweisung den effektiven Contract auf. `GenericAnswerRenderer` erhält ausschließlich diesen Contract und den aktuellen Draft.

### 2. Team-Sitzung

Die Teilnehmeransicht speichert die signierte Sitzung unter `quiz-session-[quizId]` im `localStorage`. Nach einem Reload wird sie wiederhergestellt und serverseitig über Quiz und Session-ID validiert. Ein Browser-Token ist nie Ersatz für die serverseitige Zuordnungsprüfung.

Die Session referenziert zusätzlich die globale `teams.team_id`. Der Anzeigename in der Session ist ein historischer Snapshot; Join, eventreihenbezogene Teilnahme und spätere teamübergreifende Statistiken verwenden die globale Identität. Antworten bleiben weiterhin über Session, Quiz und `quiz.eventreihe_id` eindeutig in ihrem Veranstaltungskontext.

### 3. Live-State und Hydrierung

Der Client ruft `POST /api/quiz/team-live-snapshot` mit `cache: no-store` auf. Leichte Snapshots liefern Run-, Block- und teamspezifischen Zustand. Nur bei geänderter Live-Revision, gewechselter Frage oder neu zu hydrierender Sitzung wird der vollständige Antwortstatus ergänzt beziehungsweise separat angefordert.

Beim Hydrieren werden gespeicherte Draft-Inhalte, Draft-Revision, Submission-Status und die Revision der letzten Submission rekonstruiert. Ein Run-Wechsel entfernt lokalen Zustand der betroffenen Frage. Neuere Server-Drafts überschreiben keine noch nicht gespeicherte lokale Bearbeitung.

### 4. Bearbeiten und Autosave

Eine lokale Änderung erhöht eine rein clientseitige Edit-Version. Nach 1.200 ms Ruhe speichert der Client alle veränderten, sichtbaren und weiterhin beschreibbaren Fragen.

Der Server:

1. sperrt den Run transaktional;
2. prüft Deadline, Freigabe und alle Objektzuordnungen;
3. validiert den Draft gegen den aufgelösten Contract;
4. sperrt den bestehenden Team-Draft;
5. vergleicht `expectedDraftRevision` mit `draft_revision`;
6. schreibt Inhalt und Relationen atomar und erhöht die Revision.

Bei einer `REVISION_CONFLICT`-Antwort lädt der Client den aktuellen Serverstand und fordert eine bewusste erneute Prüfung. Inhaltlich identische Wiederholungen sind idempotent.

### 5. Explizite Submission und Resubmission

Vor dem Absenden speichert der Client den aktuellen Draft erneut. `submitTeamAnswer` validiert den gespeicherten Draft gegen den Run-Snapshot und verlangt Inhalt. Anschließend wird innerhalb derselben Transaktion ein Submission-Snapshot erstellt und – außer bei Polls – die bestehende Bewertung angestoßen.

Normale produktive Antworttypen dürfen während des offenen Runs erneut bearbeitet und abgesendet werden. Eine geänderte Draft-Revision erzeugt eine neue Submission-Version. Die Auswertung verwendet nur die höchste Version des zum Draft gehörenden Runs, nicht die Summe historischer Versionen.

### 6. Schließen und Auto-Finalisierung

Beim Schließen eines Runs beziehungsweise Blocks werden inhaltlich gefüllte Drafts ohne Snapshot derselben Revision als `AUTO_FINALIZED` gesichert. Leere Drafts bleiben ohne Submission. Das Schließen bewertet nur Nicht-Polls und verwendet denselben zentralen Bewertungsweg wie eine explizite Submission.

### 7. Auswertung

`resolveEffectiveSubmission` wählt für den an `team_antworten.interaction_run_id` gebundenen Run die höchste Submission-Version. Ein neuerer Draft ohne Submission ersetzt niemals still die letzte finale Antwort. Nur historische Antworten ohne Run dürfen den ausdrücklich isolierten Legacy-Adapter verwenden.

## Produktive Antworttypen

| Typ | UI und Draft | Submission-Payload | Produktive Bewertung und Reload |
| --- | --- | --- | --- |
| `TEXT` | Mehrzeiliges Textfeld; `antwort_text` | `{ text: string }` | Effektiv offene Antworten gehen in die manuelle Prüfung. Reload stellt den Text aus Draft oder finalem Snapshot wieder her. |
| `STRUCTURED_TEXT` | Ein Textfeld je `frage_antwortfelder`; `team_antwortfelder` | `{ fields: Record<fieldId, string> }` | Zentraler Feldvergleich; derzeit 0,5 Basispunkte je korrekt normalisiertem Feld. Reload rekonstruiert die Feld-ID-Zuordnung. |
| `NUMBER` | Numerisches Feld mit Schritt und optionaler Einheit; `antwort_text` | `{ value: string }` | Schätzfragen werden derzeit zur manuellen Prüfung markiert. Die Zeichenform des Werts bleibt im Snapshot erhalten. |
| `SINGLE_CHOICE` | Radiogruppe; `antwort_id`/Auswahlrelation | `{ optionId: number | null }` | Binärer Abgleich gegen die richtige Option. Reload stellt die gewählte ID wieder her. |
| `MULTI_CHOICE` | Checkboxen; `team_antwort_auswahlen` | `{ optionIds: number[] }` | Teilbewertung: aktuell +0,5 je richtiger und −0,5 je falscher Auswahl, mindestens 0; „alles auswählen“ kann nicht volle Punktzahl ergeben. |
| `ORDER` | Sortierbare Liste; JSON in `antwort_text` | `{ itemIds: string[] }` | Nur vollständige Permutationen sind zulässig; aktuell 0,25 Basispunkte je korrekter Position. Reload nutzt die stabilen Item-IDs. |
| `POLL_SINGLE` | Radiogruppe ohne Lösungskennzeichnung | `{ optionId: number | null }` | Draft und Submission wie bei anderen Interaktionen, aber keine Bewertung und keine Punkte. |
| `POLL_MULTI` | Checkboxen ohne Lösungskennzeichnung | `{ optionIds: number[] }` | Draft und Submission wie bei anderen Interaktionen, aber keine Bewertung und keine Punkte. |
| `POLL_SCALE` | Diskrete Skalenwerte | `{ value: number | null }` | Wertebereich und Schritt werden validiert; keine Bewertung und keine Punkte. |
| `NO_ANSWER` | Kein Formular | keine | Keine Draft- oder Submission-Annahme. |

Audio-, Bild-, Wahr/Falsch-, Anagramm- und weitere Fragetemplates sind keine eigenen Persistenz-Engines. Sie lösen auf einen der obigen Interaction-Typen auf. Wahr/Falsch ist beispielsweise `SINGLE_CHOICE`; Audiofragen können `TEXT` oder `STRUCTURED_TEXT` verwenden.

### Reihenfolge-Interaktion

`ORDER` verwendet dieselbe lokale Antwort und dieselbe Autosave-Pipeline wie alle anderen produktiven Interaktionen. Die sortierbare Liste reicht bei jeder Verschiebung ausschließlich die neue Folge stabiler Item-IDs an `GenericAnswerRenderer` zurück; dort wird sie als JSON in `antwort_text` serialisiert. Es gibt keinen zusätzlichen Drag-and-drop-State und keinen eigenen Speicherweg.

Die gemeinsame `SortableTemplateList` stellt drei gleichwertige Bedienwege bereit:

- Pointer-Drag für Maus und Touch; `touch-action: none` ist auf den Griff begrenzt, damit die Seite außerhalb des Griffs mobil scrollbar bleibt;
- Tastatursortierung über den `KeyboardSensor` von dnd-kit;
- explizite, beschriftete Schaltflächen zum Verschieben nach oben oder unten als sichtbarer und screenreadertauglicher Fallback.

Die sichtbare Positionsnummer wird nach jeder Verschiebung aktualisiert. Autosave, Reload, Submission-Snapshot und Bewertung verarbeiten danach unverändert die zentrale `ORDER`-Payload `{ itemIds: string[] }`.

Es gibt derzeit keinen eigenständigen produktiven allgemeinen `SCALE`-Antworttyp. Produktiv ist ausschließlich `POLL_SCALE`. `MATCHING` und `BUZZER` sind im Templatevertrag reserviert, werden vom generischen Antwortformular aber noch nicht produktiv unterstützt. Neue Dokumentation darf diese Typen nicht als implementiert ausgeben.

## Pixelbild als spezialisierter Run, nicht als zweite Engine

Pixelbild verwendet für die eigentliche Antwort den normalen `TEXT`-Contract, denselben Draft und dieselben Submission-Snapshots. Der Run enthält zusätzlich einen `liveInteraction`-Snapshot mit Stufendauern und Punktregeln.

Besonderheiten:

- Nur in Stufe 1 oder 2 kann ein Team mit inhaltlichem Draft stoppen.
- Der Stop serialisiert den Vorgang transaktional über den Run, erzeugt eine finale Submission und setzt eine serverseitige Deadline.
- Das stoppende Team kann danach nicht weiter bearbeiten; andere Teams können bis zur Deadline weiterarbeiten und absenden.
- Die Pixel-Punkte werden zentral rungebunden aus finalen Submissions, Stufe, Stopper und Bewertungsstatus allokiert.
- Ein aufgedecktes Originalbild wird Teilnehmern vor `REVEALED` nicht ausgeliefert.

Diese Sonderregeln erweitern den gemeinsamen Lebenszyklus. Sie rechtfertigen keine zweite Draft- oder Submission-Tabelle.

## Poll-Fragen: verbindliche Sonderregel

Dieser Abschnitt meint ausschließlich Poll-Fragen (`POLL_SINGLE`, `POLL_MULTI`, `POLL_SCALE`) innerhalb einer Quizfrage. Sie verwenden vollständig den bestehenden Interaction-Contract:

- `quiz_interaction_runs` für den Live-Zustand;
- `team_antworten` für revisionsgeschützte Drafts;
- `team_answer_submissions` für explizite oder automatisch finalisierte Antworten;
- denselben Teilnehmer-Live-Endpunkt und denselben generischen Renderer.

Polls besitzen ausdrücklich:

- keine eigene Poll-Antworttabelle;
- keine parallele Interaction-Engine;
- keine Bewertungsdatensätze aus dem normalen Scoring;
- keine Punkte und keine Rankingauswirkung.

`aggregatePollSubmissions` liest finale Payloads und berechnet ausschließlich Ergebnisverteilungen für die Darstellung.

Die eigenständige Content-Art **Umfrage** ist davon bewusst getrennt. Sie besitzt keine `fragen`-Identität, keine Quizlösung, keine Bewertung und keine Punkte. Ihr stabiler Inhalt liegt in `live_polls` mit unveränderlichen `live_poll_revisions`; die jeweils letzte Antwort eines Teams pro Ausführung liegt in `live_poll_responses`. Die Ausführung verwendet weiterhin `quiz_interaction_runs`, die signierte Teamsitzung und die vorhandenen Live-Snapshot-Transporte. Damit entsteht keine zweite allgemeine Interaction-Engine, aber auch keine künstliche Quizfrage nur zur Persistierung eines nicht bewerteten Content-Elements.

Für Freitext bleiben `original_text` und die nach `public_text_replacement_rules` bereinigte öffentliche Fassung getrennt. Das Audience-View-Model enthält weder Teamname noch Profil; nur die Moderation erhält Identität und Originaltext. Auswahlantworten werden bis zum Schließen per Upsert ersetzt. Ein Content-Poll-Run schreibt niemals `team_antworten`, `team_answer_submissions` oder Evaluationen.

## Countdown und Zeitautorität

Der Server ist die Zeitautorität. Ein Run speichert `deadline_at`; der Live-Snapshot veröffentlicht diese als `submissionDeadlineAt` sowie den Aufnahmezeitpunkt als `serverNow`.

- Schreibaktionen prüfen die Deadline erneut mit aktueller Serverzeit und schließen einen abgelaufenen Run nötigenfalls transaktional.
- Die Präsentation berechnet aus `serverNow` einen Offset zur Browserzeit.
- Teilnehmer- und Moderationsanzeigen zählen lokal gegen `submissionDeadlineAt` und klemmen bei 0. Ein negativer sichtbarer Countdown ist nicht zulässig.
- Ein visueller Sekundentick darf keine Datenbankabfrage auslösen. Der vorhandene Live-Snapshot-Abruf synchronisiert Zustandsrevisionen; er ist nicht die Uhr des Countdowns.
- Es darf keine zweite Countdown-Route und kein eigener Polling-Lebenszyklus je Fragetyp entstehen.

Quizfragen behalten ihren bestehenden Live-Takt. Für das neue Content-Element Umfrage gilt ein dokumentierter adaptiver Abruf: 1,2 Sekunden im sichtbaren Tab, 5 Sekunden im Hintergrund und exponentielles Fehler-Backoff bis maximal 15 Sekunden. Übertragen wird nur der vorhandene Live-Snapshot, nicht das vollständige Quiz. Visuelle Animationen laufen rein clientseitig.

## Teamlisten- und Präsentations-Live-State

Moderation, Präsentation und Teilnehmeransicht lesen denselben logischen Run- und Blockzustand aus `getQuizLiveSnapshotData`. Authentifizierte Steuerungsansichten verwenden `/api/quiz/live-snapshot`; Teilnehmer verwenden `/api/quiz/team-live-snapshot` mit aufgelöster Team-Sitzung. Beide sind dünne Transportwege um denselben Service, keine getrennten Zustandsmaschinen.

Teambeitritt und Teamlisten müssen über den vorhandenen Live-State-Weg laufen. Neue Fragetypen dürfen weder eine zweite Teamlisten-Route noch eine parallele clientseitige Zustandsquelle einführen.

## Invarianten / Do not break

1. Keine zweite parallele Antwort-State-, Draft- oder Submission-Architektur.
2. Keine Submission-Engine pro Fragetyp. Spezielle Regeln erweitern den gemeinsamen Run.
3. Renderer stellen den aufgelösten Contract dar; sie entscheiden nicht über Punkte, Freigabe oder Persistenz.
4. Drafts sind veränderbar, Submissions unveränderlich und versioniert.
5. Ein Draft ohne finale Submission darf bei einem rungebundenen Datensatz nicht still in die Auswertung fallen.
6. Autosave muss Compare-and-swap über `draft_revision` respektieren und Konflikte sichtbar machen.
7. Reload muss Team-Sitzung, Run-Bindung, Draft, Revision und Submission-Status korrekt rekonstruieren.
8. Blockfreigabe, aktuelle Run-ID, Zustand und Deadline werden bei jedem Schreibvorgang serverseitig geprüft.
9. Polls erzeugen weder Punkte noch Rankingwirkung.
10. Pixel bleibt an finale Submissions seines konkreten Runs gebunden.
11. Präsentation und Teilnehmeransicht müssen denselben logischen Run- und Blockzustand zeigen.
12. Kein Countdown-Polling und keine Datenbankabfrage pro visuellem Tick.
13. Die zentrale Regression lautet: **anzeigen → beantworten → speichern → Reload → weiterhin korrekt → absenden → auswerten**.

## Einen neuen Antworttyp integrieren

Vor einer Implementierung ist zu prüfen, ob der Typ wirklich eine neue Interaktion oder nur ein neues Fragetemplate mit vorhandenem Contract ist. Für eine echte neue Interaktion müssen mindestens gemeinsam angepasst und getestet werden:

1. `TemplateInteractionType`, kompatible Bewertung und Answer-Form-Definition;
2. Templatevertrag beziehungsweise Overlay;
3. `ResolvedQuizAnswerInteraction` und zentrale Auflösung;
4. `GenericAnswerRenderer`;
5. `validateInteractionPayload` und `interactionPayloadToDraft`;
6. Draft-Persistenzabbildung, falls die vorhandenen Text-, Auswahl- oder Feldrelationen nicht genügen;
7. Submission-Snapshot und `resolveEffectiveSubmission`;
8. zentrale Bewertung oder ausdrückliche `NONE`-Semantik;
9. Reload-, Autosave-, Resubmission-, Block-Close- und Live-State-Tests;
10. die vollständige End-to-End-Regression aus den Invarianten.

Ein neues Datenmodell ist erst gerechtfertigt, wenn der vorhandene Contract und die bestehenden Payload-Formen den Inhalt fachlich nicht ausdrücken können. Eine bequemere UI allein ist kein Grund für eine parallele Persistenz.

## Begründungen, die sich aus Code und Migrationen ableiten lassen

- Runs und Submission-Snapshots wurden additiv neben die historische Draft-Struktur gestellt. Migrationen und Tests sichern ausdrücklich, dass keine Altantworten destruktiv entfernt werden.
- Die eindeutige Kombination aus Run, Team und Draft-Revision macht wiederholte Requests idempotent, während `submission_version` bewusste Resubmissions nachvollziehbar erhält.
- Der Run-Snapshot verhindert, dass eine spätere Templateänderung die Semantik einer bereits geöffneten Interaktion still verändert.
- Die Trennung von Draft und Submission verhindert, dass Autosave allein eine abgegebene Antwort nachträglich überschreibt.
- Polls nutzen denselben Lebenszyklus, weil Freigabe, Reload, Autosave und Finalisierung Interaktionsprobleme sind; ihr Verzicht auf Punkte ist eine Bewertungsregel.

Weitergehende Produktentscheidungen, etwa ob zukünftig jede Interaktion explizit abgesendet werden muss oder ob das 500-ms-Live-Intervall verändert werden soll, sind aus dem aktuellen Code nicht eindeutig begründbar. **Reasoning needs confirmation.**

## Relevante Regressionstests

- `app/quiz/answerInteraction.test.ts`
- `app/quiz/GenericAnswerRenderer.test.ts`
- `app/quiz/interaction/interactionPayload.test.ts`
- `app/quiz/interaction/interactionStateMachine.test.ts`
- `app/quiz/interaction/interactionSubmissionPolicy.test.ts`
- `app/quiz/interaction/interactionArchitecture.test.ts`
- `app/quiz/interaction/pollInteraction.test.ts`
- `app/quiz/interaction/pollLifecycle.test.ts`
- `app/quiz/interaction/pixelLiveInteraction.test.ts`
- `app/quiz/evaluation/effectiveSubmission.test.ts`
- `app/quiz/evaluation/evaluateBaseAnswer.test.ts`
- `app/quiz/quizAnswerLiveState.test.ts`
