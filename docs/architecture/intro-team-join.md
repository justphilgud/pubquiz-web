# Living Specification: Intro, QR und Teambeitritt (AP6)

Verbindlich: [Lifecycle](quiz-lifecycle.md), [Presentation Rendering](presentation-rendering.md),
[Submission-Live-State](submission-live-state.md), [Antwortinteraktion](answer-interaction.md).

## Ablauf und bisheriger Vertrag

Das Quiz verwendet `resolveQuizFlow` und `buildPraesentationSlides`. Legacy-Intros
werden in dieselben Flow-Elemente projiziert; gespeicherte und zusätzliche Stories
verwenden denselben Builder. Bisher stand QR mit Order 50 vor Regeln (60).
Nun ordnet der zentrale Vergleich QR hinter alle anderen BEFORE_QUIZ-Inhalte
desselben Intro-Ankers, unabhängig von gespeicherten Orderwerten. Kein Inhalt wird
entfernt, keine Migration benötigt. Danach folgt der reguläre erste Fragenblock.
Die Konfigurationsoberfläche erklärt den festen QR-Abschluss und manuellen Übergang.

INTRO-INV-01/02/03: QR zuletzt im Intro, danach regulärer Block; QR bleibt stehen,
bis die Moderation navigiert. Eine Verweildauer ist kein automatischer Übergang.
QR-DOM, QR-Wert und bestehender Beitrittslink werden durch Animation nicht ersetzt.

## Beitritt und Live-State

`startGlobalTeamQuizSession` bleibt unverändert. Globale Team-ID und Profil bleiben
in `teams`, die konkrete Teilnahme in `quiz_team_sessions`. Upsert auf Quiz/Team
verwendet bei Wiederanmeldung dieselbe Session-ID. PREPARATION und RUNNING erlauben
Beitritt gemäß AP1; STOPPED sperrt ihn. Anzeigen, Beitritt und Begrüßung starten
niemals das Quiz. AP6 schreibt keine Teilnahme, Session oder Animationsevents.

Der vorhandene `getQuizLiveSnapshotData` liest bei `includeTeamJoinState` dieselbe
Team-Query wie zuvor, jetzt ohne die bisherige Begrenzung auf zwölf Sessions.
Die kompakte Übersicht bleibt auf zwölf Einträge begrenzt. `joinObservation`
enthält alle Teilnahme-IDs, Namen und aufgelösten Profile mit Lifecycle/Revision.
So werden auch Team 13 und große Beitrittswellen erkannt. Das erhöht die QR-Payload
linear mit der Teamzahl, erzeugt aber weder weitere SQL-Aufrufe noch einen neuen
Transport. Intern verwendete IDs werden nicht angezeigt; keine Zugangsdaten im
Join-View-Model. TeamIdentityVisual und mapTeamProfile verwenden unverändert das
vorhandene Foto/Avatar-System einschließlich deterministischem Legacy-Fallback.

## Lokale Begrüßung und Queue

`TeamJoinWelcome` lebt nur im sichtbaren QR-Renderer von Player/Moderation.
`teamJoinQueue` enthält reine, separat testbare Projektion. Der erste empfangene
Snapshot bildet eine stille Baseline. Neue stabile Teilnahme-ID nach dieser
Baseline bedeutet einen neuen Join. Gleiche Liste, neue Objektidentität, Profil-
oder Namensänderung, Teamreload und Reconnect spielen nichts erneut ab.
Präsentationsreload und Rückkehr zum QR bilden eine neue Baseline; außerhalb QR
beitretende Teams werden beim nächsten QR-Besuch nicht nachträglich begrüßt.

JOIN-INV-01–07: Neue Teilnahme genau einmal, keine Wiederholung bestehender IDs,
keine überschriebenen Joins, vorhandener Avatar, keine Writes und kein Quizstart.

Zentrale Dauer `TEAM_JOIN_DISPLAY_MS = 4000`: sanftes Ein-/Ausblenden, insgesamt
vier Sekunden je Anzeige. Drei schnelle Teams werden einzeln in Eingangsreihenfolge
gezeigt. Ab `TEAM_JOIN_BURST_THRESHOLD = 4` wartenden Teams fasst die nächste Anzeige
den vollständigen Rückstau zusammen. Die laufende Anzeige wird nicht ersetzt.
Eine Welle von 40 Joins benötigt damit höchstens eine laufende Anzeige plus eine
Sammelanzeige, statt minutenlang nacheinander zu laufen. Neue Joins während eines
Batches werden für die nächste Anzeige gesammelt. Batch zeigt Anzahl sowie bis zu
sechs Namen/Avatare und die Restanzahl; alle Teilnahme-IDs gelten als verarbeitet.

## Reset, STOPPED und Cleanup

JOIN-INV-08/09: Resetrevision verwirft aktive Anzeige, Queue und Baseline. Nach der
neuen Baseline werden neue Teilnahmen wieder erkannt. Veraltete Revisionen und
Timerantworten werden ignoriert. STOPPED beendet die Queue, auch ein verspäteter
RUNNING-Snapshot derselben Revision kann sie nicht reaktivieren. Verlassen des
QR und Unmount räumen den einzigen Anzeigetimer auf. Neue Revision remountet die
Anzeige; die serverseitige AP1-Löschung bleibt unverändert.

## Darstellung und Last

Vier Sekunden mit Namen und proportionalem Avatar, bestehende Theme-Tokens und
AP5-Rollen `--pres-title`, `--pres-body`, `--pres-info`. Standard, LOVD, Corporate
und Storybook benutzen dieselbe Komponente. Reduced Motion zeigt die Begrüßung
ohne Bewegung mit gleicher Dauer. QR bleibt im DOM; die Begrüßung belegt primär
den rechten Informationsbereich und ist keine Interaktionssperre.

Der QR-Bereich verwendet die verbleibende Slidehöhe als Größenbegrenzung. Der
Code bleibt quadratisch und vollständig sichtbar, auch wenn die Teamübersicht
ihre zwölf Einträge erreicht. Nur die Informationsspalte darf bei Platzmangel
scrollen. Die Begrüßung beginnt rechts von der QR-Spalte. Diese Geometrie ist
für alle vier Themes bei 1280 × 720, 1920 × 1080 und 2560 × 1440 abgenommen.

JOIN-INV-10: Kein neuer Poller, Server-Action oder Request pro Begrüßung/Frame.
Bestehender Player-/Moderationstakt bleibt unverändert. Primitive Beobachtungssignatur
und aktiver Batch-Key verhindern Effekt-/Timerneustarts bei identischen Snapshots.
Ein sich füllender Rückstau verlängert die laufende Anzeige nicht. B10a-Regressions-
tests bleiben aktiv. B10b bleibt ausdrücklich ein separater Optimierungs-Backlog.

## Moderationsnotiz und Prüfungen

CR07 betrifft die automatisch dargestellte Auflösungsstrategie END_OF_BLOCK
(„Gesammelt am Ende des Blocks“). Nur diese Anzeige entfällt. Andere Strategien,
individuelle Moderationsnotizen sowie Medien-/Pixel-/Countdownhinweise bleiben.
MOD-INV-01: Blockfolge Q → COUNTDOWN → S und Finalisierung/Bewertung unverändert.

Tests: teamJoinQueue.test.ts (einschließlich realem Komponentenrumpf mit kontrollierten
Hooks/Timern), quizFlow.test.ts, buildPraesentationSlides.test.ts und unveränderte
AP1–AP5-/B10a-Regressionen. Die interne Präsentationsreferenz enthält QR mit lokalen
synthetischen Einzel-/Dreier-/Burstbeitritten für alle Designwelten; keine DB-Schreib-
oder Pollingfunktion. Reale Animation und Requestzahlen werden zusätzlich auf einem
eigenen Preview-Testquiz geprüft; ein Screenshot ersetzt diese Abnahme nicht.

Abnahme: [AP6-Bericht mit Messungen und Screenshots](../reports/ap6-intro-team-join.md).
