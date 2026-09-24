# AP4 Meme-Ergebnis, Punkte und Auflösung – Preview-Abnahme 2026-09-23

## Ergebnis

AP4 schließt den Meme-Lifecycle fachlich ab. Ein geschlossenes AP3-Voting wird
serverseitig genau einmal finalisiert, in der bestehenden zentralen Quizbewertung
verbucht und in der regulären direkten oder späteren Auflösungsphase angezeigt.
Gleichstände erzeugen mehrere Gewinner; null gültige Stimmen erzeugen weder einen
künstlichen Gewinner noch einen Punkt.

- Feature-Branch: `codex/meme-results-scoring-ap4`
- getesteter Feature-Commit: `96af2532526e80762fac31c79fdb78d296a74c1d`
- getesteter Preview-Branch-Commit: `995370081e0bb43ae19ea43947f93307f694702e`
- stabile Preview: `https://pubquiz-web-git-preview-content-and-quiz-flow-just-phil-gud.vercel.app`
- unveränderliche Preview: `https://pubquiz-j3siqppew-just-phil-gud.vercel.app`
- finales Deployment: `dpl_7XgmsC48ZoGBC2N7Qvjd21wuyBdF`
- Feature-CI: `35914982627`
- Preview-CI: `35914998585`
- Preview-Deploy: `35915438152`
- `main` zum Abschluss: `24fc2845969cd22b792638c2aa63f4f5bc86709c`
- Production und `main`: unverändert

## Wiederverwendete Ergebnis- und Bewertungsinfrastruktur

- AP4 liest ausschließlich den persistenten Zustand `VOTING_CLOSED` aus AP3.
  Freigegebene Kandidaten, interne Teamreferenzen und finale Votes bleiben die
  vorhandenen AP2-/AP3-Datensätze; AP4 mutiert sie nicht.
- Die bestehende Präsentationssequenz und ihre Auflösungsstrategie bestimmen
  weiterhin, ob das Ergebnis direkt nach der Frage oder gesammelt im
  Auflösungsblock sichtbar wird.
- `team_antworten` bleibt die einzige Quelle für Quizpunkte und den normalen
  Punktestand. Gewinner erhalten dort absolut `1`, Nichtgewinner absolut `0`.
- Die vorhandenen Rollen-, Quiz-Lock-, Transaktions-, Revision-, Snapshot- und
  Resetmechanismen werden weiterverwendet. Eine zweite Meme-Scoreboard-Engine
  wurde nicht eingeführt.

## Ergebnislogik und Persistenz

Die Finalisierung sperrt Quiz und Meme-Präsentation transaktional, prüft
`VOTING_CLOSED`, zählt den pro Team deduplizierten finalen AP3-Vote je Kandidat
und schreibt einen kompakten Aggregat-Snapshot. Der höchste **positive**
Stimmenwert bestimmt die Gewinner. Bei Gleichstand auf Platz 1 sind alle
punktgleichen Kandidaten Gewinner und jedes zugehörige Team erhält genau einen
Quizpunkt.

Bei null gültigen Stimmen bleiben alle Kandidaten Nichtgewinner und alle Punkte
bei null. Das gilt ebenso bei genau einem Kandidaten, wenn durch die
Selbstwahlsperre keine gültige Stimme möglich ist.

`result_finalized_at`, eine eindeutige Ergebniszeile je Präsentation und Kandidat
sowie absolute zentrale Bewertungswerte machen die Operation idempotent. Ein
zweiter Moderator, Reload oder erneuter Finalisierungsrequest liefert den
vorhandenen Snapshot. Automatische Neubewertung und normale manuelle
Punkteänderungen überspringen beziehungsweise sperren ein finalisiertes
Meme-Ergebnis.

## Sichtbarkeit und Ergebnisfolie

Moderation darf den finalen Snapshot sofort lesen. Teilnehmer und Leinwand
erhalten Teamname, Teamprofil, Stimmen, Prozentwert und Gewinnerstatus erst in
der regulären `SOLUTION`-Phase. Zuvor bleiben Einzelpräsentation, Übersicht,
Voting und geschlossener Zustand anonym.

Der gemeinsame `MemeResultStage` zeigt Kandidatennummer, Meme, Team, Stimmen,
Prozentwert und Gewinnerkennzeichnung. Bis zu vier Kandidaten erscheinen pro
Seite; weitere Kandidaten nutzen den vorhandenen persistenten Reveal-Zähler.
Kandidatenreihenfolge und AP2-Nummern bleiben unverändert.

## Datenmodell und Preview-Migration

Die additive Migration `20260923230000_add_meme_results` ergänzt
Finalisierungsmetadaten an `meme_presentations` und die Tabelle
`meme_result_entries` mit Eindeutigkeits-, Fremdschlüssel- und Werte-Constraints.
Sie kopiert keine Votes und ändert keine AP1-/AP2-/AP3-Nutzdaten.

Der geschützte Preview-Deploy `35915438152` validierte die Preview-Identität,
fand 49 Migrationen und bestätigte vor und nach `prisma migrate deploy`:
`Database schema is up to date`. Production wurde nicht migriert.

## Automatisierte Prüfung

- vollständige Testmatrix: 561 Unit-/Integrationstests erfolgreich;
- Präsentations-Lesbarkeit: 14/14 erfolgreich;
- Kunstwerk-Browserregression: 1/1 erfolgreich;
- AP3-Chrome-Layoutregression: 1/1 erfolgreich;
- AP4-Chrome-Layoutregression: 1/1 erfolgreich;
- nachgelagerte Architektur-/Sicherheitsprüfungen: 181/181 erfolgreich;
- insgesamt 759 automatisierte Prüfungen erfolgreich;
- TypeScript: erfolgreich;
- Prisma-Generierung und Schema-Validierung: erfolgreich;
- ESLint der geänderten JavaScript-/TypeScript-Dateien: erfolgreich;
- vollständiger Next-Production-Build: erfolgreich;
- Feature-CI `35914982627`: erfolgreich;
- Preview-CI `35914998585`: erfolgreich;
- Preview-Migration, Deployment und HTTP-Smoke `35915438152`: erfolgreich.

Die Ergebnisregression deckt korrekte Zählung, eindeutigen Gewinner, Gleichstand,
je einen Punkt für mehrere Gewinner, null Votes, einen Kandidaten ohne gültige
Stimme, verspätete/ersetzte Votes, Anonymität vor AP4, Idempotenz, Reload,
konkurrierende Moderatoren, direkte und spätere Auflösung, zentrale Bewertung,
unveränderliche AP1-/AP2-/AP3-Daten sowie Navigations- und
Neuberechnungssperren ab.

## Manuelle Preview-Flows A bis K

### A – eindeutiger Gewinner

Bestanden mit Quiz `#61` und ergänzend im direkten Flow `#60`. Nach jeweils
einer gültigen Stimme zeigte das Ergebnis genau einen Gewinner, Teamname,
Stimmenzahl, 100 Prozent und `+1 Punkt`. Die zentrale Auswertung enthielt genau
einen automatischen und vergebenen Punkt; alle übrigen Meme-Antworten blieben
bei null.

### B – Gleichstand

Bestanden mit Quiz `#65`. Zwei finale Stimmen lagen auf `Meme 3` und `Meme 4`.
Beide wurden ohne Tie-Breaker oder Zufall als gemeinsame Gewinner gezeigt; die
Teams `AP2 Fünf Team 2` und `AP2 Fünf Team 5` erhielten jeweils genau einen
zentralen Punkt.

### C – keine Votes

Bestanden mit Quiz `#59`. Der finale Zustand zeigte `Keine gültigen Stimmen`,
vergab keinen Gewinner und keinen Punkt und blieb ohne Fehlerzustand.

### D – ein Kandidat

Bestanden mit Quiz `#64`. Das einzige Eigentümerteam konnte nicht selbst wählen.
Nach Finalisierung zeigte die Auflösung den einzelnen Kandidaten mit null Stimmen
und den Hinweis `Ohne abgegebene Stimme wird kein Punkt vergeben.` Es entstand
kein künstlicher Vote oder Punkt.

### E – direkte Auflösung

Bestanden mit Quiz `#60`. Die Quizstrategie wurde über die vorhandene
Quizverwaltung auf `Direkt nach jeder Frage` gesetzt und anschließend erneut
gelesen. Einzelpräsentation, anonyme Übersicht, Selbstwahlsperre, Vote,
Votingschluss und Finalisierung liefen über die normale UI. Der nächste reguläre
Schritt wechselte unmittelbar von Frage 11 auf die Ergebnisauflösung 12. Team 2
erhielt exakt einen zentralen Punkt.

### F – spätere Auflösung

Bestanden mit den Quizzen `#61`, `#64` und `#65`. Die Punkte wurden beim
Finalisieren gespeichert, während Teamidentitäten und Ergebnis vor der
`SOLUTION`-Phase verborgen blieben. Erst der reguläre spätere Auflösungsblock
zeigte den persistenten Snapshot.

### G – Reload nach Ergebnis

Bestanden mit `#65` und `#61`. Echte Reloads von Moderation und Teilnehmeransicht
zeigten identische Gewinner, Stimmen und Seiten. Die zentrale Bewertung blieb
bei genau einem Punkt je Gewinner; es entstand kein weiterer Punkt.

### H – zwei Moderatoren

Bestanden mit Quiz `#61`. Zwei Moderationstabs lösten die Finalisierung nahezu
gleichzeitig aus. Beide Requests endeten kontrolliert, der zweite Client lud den
bereits finalisierten Stand, beide Ansichten konvergierten und es existierte nur
eine Bewertung mit einem Punkt.

### I – Scoreboard / zentrale Auswertung

Bestanden. `#60` und `#61` zeigten je einen Gewinner mit `Automatisch: 1`,
`Vergeben: 1`, `CORRECT`; Nichtgewinner blieben `0 / WRONG`. Beim Gleichstand in
`#65` erhielten exakt beide Gewinner je einen Punkt. Nullstimmenfälle änderten
keinen Punkt.

### J – viele Kandidaten und Präsentationsqualität

Die reale Preview-Abnahme nutzte Quiz `#65` mit fünf Kandidaten auf zwei Seiten.
Seite 1 zeigte vier Kandidaten samt beiden Gewinnern, Seite 2 den fünften; Nummern,
Teams, Stimmen und Gewinnerstatus blieben stabil. Bei 1280×720 waren alle Inhalte
nach dem unten beschriebenen Fix sichtbar. Beide Gewinner-Badges lagen
geometrisch vollständig innerhalb ihrer Karten, mit rund 11 Pixel Abstand zur
Unterkante.

Die exakten 8- und 11-Kandidatenfälle wurden ohne zusätzlichen Preview-Datenimport
im echten Chromium-Layouttest geprüft. Der Test verwendet denselben Renderer und
den echten 108-Pixel-Präsentationsheader, paginiert auf zwei beziehungsweise drei
Seiten und prüft 1280×720 sowie 1920×1080 einschließlich Gewinner-Bounds. Damit
bleibt die Preview auf den vorgesehenen kleinen repräsentativen Testdaten.

### K – Regression AP1 bis AP3

Bestanden. Die vollständige Testmatrix deckt AP1-Submission, Draft/Reload und
Deadline, AP2-Auswahl, Review, stabile Positionen und Persistenz sowie AP3-
Einzelpräsentation, paginierte Übersicht, Selbstwahlblock, Voteänderung,
Votingschluss, Reload und Konflikte ab. In den realen AP4-Browserflüssen blieben
die AP2-Kandidatenreihenfolge und Nummern stabil; der AP3-Vote konnte vor Schluss
geändert werden, war danach gesperrt und wurde ohne Zwischenstand offengelegt.

## Gefundener Fehler und Korrektur

Die erste reale 1280×720-Abnahme zeigte, dass die gelbe Gewinnerkennzeichnung auf
der unteren Kartenreihe am Kartenrand abgeschnitten war. Die kleinstmögliche
Korrektur verdichtet ausschließlich Abstände, Avatar, Typografie und Badge im
`MemeResultStage` bei 1280×720; ab `1600px` bleiben die größeren Werte erhalten.
Ein Chrome-Regressionstest reserviert denselben Präsentationsheader wie der
Produktionsrenderer und misst die Gewinner-Bounds. Nach Commit `96af253...`,
vollständiger Regression, CI und Redeploy war der Fehler auf der realen Preview
behoben.

## Geänderte Bereiche

- additive Prisma-Migration, Schema und generierter Client für persistente
  Ergebnis-Snapshots;
- AP4-Domainregeln, Servertransaktion, Action und Snapshot-Integration;
- bestehende Moderations-, Teilnehmer-, Präsentations- und Bewertungswege;
- gemeinsamer `MemeResultStage` sowie Einbindung in den Präsentationsrenderer;
- Unit-, Architektur-, Komponenten- und echte Chromium-Layouttests;
- Architektur-, Antwortinteraktions- und Moderationsdokumentation.

## Bekannte Restpunkte

- Die Preview enthält bewusst höchstens fünf reale Meme-Kandidaten. Die expliziten
  8- und 11-Kandidatenfälle sind reproduzierbar im echten Chromium-Layouttest
  statt durch weitere Preview-Testdaten belegt.
- Moderationsseiten protokollieren beim initialen Hydratisieren den bereits
  bekannten allgemeinen React-Fehler `#418`. Derselbe Fehler wurde im unveränderten
  Nicht-Meme-Quiz `#50` reproduziert; Teilnehmer- und Präsentationsansicht blieben
  fehlerfrei und alle Moderationsfunktionen arbeiteten korrekt. Der Befund ist
  damit kein AP4-Regressionssignal und wurde nicht außerhalb des Auftrags behoben.
- Die deutsche Kopfzeile verwendet bei einer Stimme noch die bestehende Form
  `1 Stimmen`. Das ist eine nicht blockierende Textkorrektur außerhalb der
  Ergebnis-, Punkte- und Sicherheitslogik.

## Abschluss

AP4 ist implementiert und auf der geschützten Preview fachlich abgenommen.
Ergebnisberechnung, Gewinner-/Gleichstandsregel, zentrale Punkte, direkte und
spätere Auflösung, Anonymität, Reload, mehrere Moderatoren und Sonderfälle sind
stabil. Das vollständige Meme-Format AP1 bis AP4 ist technisch für einen
separaten Production-Rollout bereit. Production und `main` wurden nicht
verändert; die additive Migration lief ausschließlich auf Preview.
