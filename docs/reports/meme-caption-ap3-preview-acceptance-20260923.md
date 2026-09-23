# AP3 Meme-Präsentation und Voting – Preview-Abnahme 2026-09-23

## Ergebnis

AP3 erweitert den abgeschlossenen AP2-Review um eine persistente, anonyme Meme-Präsentation und ein serverseitig abgesichertes Team-Voting. Der Moderator präsentiert die freigegebenen Kandidaten einzeln, wechselt anschließend durch paginierte Übersichten, öffnet das Voting ausdrücklich und schließt es in einen stabilen Endzustand. Gewinnerermittlung, Gleichstand und Punkte bleiben AP4 vorbehalten.

- Feature-Branch: `codex/meme-presentation-voting-ap3`
- getesteter Feature-Commit: `ac9b5c7d17b3d6ad3e9d31ebb47129f4a4e84496`
- getesteter Preview-Branch-Commit: `6a4b64fe3cf88ddb0721aedbb6f7a554a0b40439`
- stabile Preview: `https://pubquiz-web-git-preview-content-and-quiz-flow-just-phil-gud.vercel.app`
- unveränderliche Preview: `https://pubquiz-7sk6zuor3-just-phil-gud.vercel.app`
- finales Deployment: `dpl_ELemhpfSyGSvsKmgxDm51KrXXGqw`
- Preview-CI: `35907896459`
- Preview-Deploy: `35908198919`
- Feature-CI: `35907861105`
- Production und `main`: unverändert

## Wiederverwendete Architektur

- AP2 bleibt alleinige Kandidatenquelle. AP3 liest ausschließlich `APPROVED`-Kandidaten eines abgeschlossenen AP2-Reviews in der dort gespeicherten Positionsreihenfolge.
- Der bestehende `ModerationClient` und sein Live-Snapshot tragen Moderatorsteuerung, Polling, Rollenprüfung und Synchronisierung.
- Teilnehmer werden über die vorhandene Quiz-Team-Session identifiziert. Eine neue Teilnehmerdefinition wurde nicht eingeführt.
- Der vorhandene `MemeRenderer` rendert Einzelansicht, Übersicht und Teamwahl. Es gibt keine zweite Meme-Renderinglogik und keine erzeugten Screenshots.
- Der bestehende Revisions- und Konfliktvertrag wurde auf Präsentationszustand und Votes übertragen. Aktionen prüfen den erwarteten Revisionsstand und laden bei Konflikten den aktuellen Serverzustand.
- AP1-Submissions und AP2-Kandidaten werden weder kopiert noch mutiert.

## Kandidaten, Nummerierung und Präsentation

`readApprovedMemeCandidatesForAp3` liefert nur freigegebene Kandidaten eines abgeschlossenen AP2-Reviews. Die sichtbare Bezeichnung entsteht aus der unveränderten AP2-Position. Ein Kandidat an AP2-Position 3 bleibt daher `Meme 3`, auch wenn Position 2 ausgeschlossen wurde. Sichtbare Nummer und interne Kandidaten-ID bleiben getrennt.

Beim ersten Start wird eine Präsentation mit dem Zustand `PRESENTING`, der aktiven AP2-Position und einer Revision angelegt. Der Moderator schaltet manuell zum nächsten freigegebenen Kandidaten. Nach dem letzten Kandidaten folgt `OVERVIEW`. Die Übersicht zeigt höchstens vier Memes pro Seite; weitere Kandidaten werden ohne fachliche Begrenzung auf zusätzliche Seiten verteilt. Erst von der letzten Übersichtsseite kann der Moderator das Voting öffnen.

Einzel- und Übersichtsdarstellung enthalten Meme und Nummer, aber keine Teamidentität, technischen Referenzen, Stimmen oder Rangfolge. Reload rekonstruiert Zustand, aktive Position und Übersichtsseite vom Server.

## Voting, Persistenz und Konfliktschutz

- `VOTING_OPEN` und `VOTING_CLOSED` sind serverseitige Zustände. Ein Team kann weder vor dem Öffnen noch nach dem Schließen abstimmen.
- Pro Präsentation und Team-Session existiert höchstens ein Vote. Eine eindeutige Datenbankbedingung schützt diese Regel zusätzlich.
- Während das Voting offen ist, ersetzt eine neue gültige Auswahl den vorhandenen Vote und erhöht dessen Revision; es entsteht kein zweiter Vote.
- Der Server sperrt bei einer Vote-Aktion die Präsentation und verwendet zusätzlich ein transaktionales Advisory Lock pro Präsentation und Team. Nahezu gleichzeitige Geräte können dadurch keinen Doppelvote erzeugen.
- Ein erwarteter Vote- oder Präsentationsrevisionsstand macht konkurrierende Änderungen sichtbar. Der abgewiesene Client erhält den aktuellen Zustand und konvergiert anschließend durch den Live-Snapshot.
- Der Besitzer eines Kandidaten wird ausschließlich serverseitig verglichen. Das eigene Meme bleibt in der UI sichtbar, ist aber deaktiviert. Ein direkter Selbstwahlversuch endet mit `SELF_VOTE`.
- Teams ohne eigenen freigegebenen Kandidaten dürfen alle Kandidaten wählen.
- Der Moderator sieht nur `abgestimmt / stimmberechtigt`. Kandidatenstimmen, Prozentwerte und Ranking werden während AP3 weder an Moderator, Team noch Präsentation ausgeliefert.

## AP4-Vertrag

Der geschlossene AP3-Lesestand enthält die freigegebenen Kandidaten in stabiler AP2-Reihenfolge, ihre interne Teamzuordnung, alle final gültigen Votes mit abstimmendem Team und gewähltem Kandidaten sowie den eindeutigen Status `VOTING_CLOSED`. AP4 muss weder Kandidaten neu sortieren noch Votes deduplizieren. Gewinner, Gleichstand, Punkte, Teamauflösung und Ergebnisfolie sind bewusst nicht implementiert.

## Datenmodell und Migration

Die additive Preview-Migration `20260923210000_add_meme_presentation_voting` ergänzt:

- `meme_presentations` für AP2-Auswahl, Zustand, aktive AP2-Position, Übersichtsseite, Revision und Auditdaten,
- `meme_votes` für Präsentation, Team-Session, Kandidat, Revision und Zeitstempel,
- das Enum `MemePresentationState` mit `PRESENTING`, `OVERVIEW`, `VOTING_OPEN` und `VOTING_CLOSED`.

Eindeutige Bedingungen sichern eine Präsentation je AP2-Auswahl und einen Vote je Präsentation und Team. Die Migration lief ausschließlich auf Preview; Production wurde nicht migriert.

## Automatisierte Prüfung

- fokussierte AP1-/AP2-/AP3-Regression: 32/32 erfolgreich,
- vollständige Testmatrix: 561 Unit-/Integrationstests erfolgreich,
- Präsentations-Lesbarkeit: 14/14 erfolgreich,
- Kunstwerk-Browserregression: 1/1 erfolgreich,
- AP3-Chrome-Layouttest: 1/1 erfolgreich,
- nachgelagerte Architektur-/Sicherheitsprüfungen: 181/181 erfolgreich,
- TypeScript: erfolgreich,
- ESLint der geänderten TypeScript-/JavaScript-Dateien: erfolgreich,
- vollständiger Next-Production-Build: erfolgreich,
- Feature-CI `35907861105`: erfolgreich,
- Preview-CI `35907896459`: erfolgreich,
- Preview-Migration, Deployment und HTTP-Smoke `35908198919`: erfolgreich.

Die automatisierten AP3-Fälle prüfen ausschließlich freigegebene Kandidaten, unveränderte AP2-Reihenfolge und Nummern, erforderliche Präsentationsphase, Zustandsübergänge, Pagination für 1/2/4/8/11 Kandidaten, genau einen Vote, Ersetzen eines Votes, `SELF_VOTE`, Team ohne eigenes Meme, `VOTING_CLOSED`, Reload-Persistenz, konkurrierende Teamgeräte, Revisionskonflikte, mehrere Moderatorclients, Kandidatensperre und den AP4-Lesevertrag. AP1- und AP2-Tests bleiben vollständig grün.

## Repräsentative Preview-Daten

- Quiz `#65`: fünf freigegebene Kandidaten, zwei Übersichtsseiten, mehrere stimmberechtigte Teams, Team mit eigenem Meme und zusätzlich angelegtes Team ohne eigenes Meme.
- Quiz `#64`: genau ein freigegebener Kandidat und einziges Eigentümerteam.
- Quiz `#59`: AP2-Positionen 1 und 3 freigegeben, dazwischen ausgeschlossener Kandidat; elf stimmberechtigte Teams und zwei Moderatorclients.

## Preview-Flows A bis M

### A – Einzelpräsentation

Bestanden. Quiz `#65` startete nach abgeschlossenem AP2-Review bei `Meme 1` und ließ sich manuell bis `Meme 5` durchschalten. Die Präsentation zeigte ausschließlich Nummer, Bild und Meme-Texte. Teamname, Avatar und technische Referenzen waren nicht sichtbar.

### B – Reload während Präsentation

Bestanden. Ein echter Reload bei `Meme 2` stellte genau diesen Kandidaten wieder her. Reihenfolge und Nummerierung blieben unverändert.

### C – Übersicht

Bestanden. Fünf Kandidaten erschienen in AP2-Reihenfolge auf zwei Seiten: 1–4 und 5. Die realen Browseransichten waren bei 1280×720 und großer Desktopauflösung vollständig lesbar. Die automatisierte Chrome-Matrix deckt zusätzlich 1, 2, 4, 8 und 11 Kandidaten ab.

### D – Votingstart

Bestanden. Vor dem Start meldete das Teamgerät, dass das Voting noch nicht geöffnet ist. Erst nach Einzelpräsentation und letzter Übersichtsseite konnte der Moderator öffnen; Team- und Präsentationsansicht synchronisierten anschließend auf `VOTING_OPEN`.

### E – Selbstwahl

Bestanden. Beim Eigentümerteam blieb das eigene `Meme 4` sichtbar und nativ deaktiviert, während alle vier fremden Kandidaten auswählbar waren. Der Browser ließ auf dem deaktivierten Element erwartungsgemäß keinen Request entstehen. Die obligatorische Serverabwehr wurde deshalb zusätzlich direkt in der Service-/Policy-Regression mit manipuliertem Kandidaten als `SELF_VOTE` nachgewiesen; die Teamzuordnung wird nicht an den Client ausgeliefert.

### F – normaler Vote

Bestanden. Ein Vote für `Meme 1` wurde gespeichert, nach echtem Reload wieder angezeigt und anschließend auf `Meme 2` geändert. Der Moderatorfortschritt blieb bei einer abgegebenen Stimme; es entstand kein zweiter Vote.

### G – Team ohne eigenes Meme

Bestanden. Das Preview-Team `AP3 Team ohne Meme 2026-09-23` konnte alle fünf Kandidaten auswählen. Der Vote für `Meme 4` blieb nach Reload erhalten; der Moderatorfortschritt stieg neutral auf `2 von 6`.

### H – zwei Geräte desselben Teams

Bestanden. Zwei Tabs desselben Teams sendeten nahezu gleichzeitig unterschiedliche Votes. Ein Client erhielt die sichtbare Revisionskonfliktmeldung, der finale Vote war eindeutig `Meme 3`, beide Clients konvergierten und der Moderator zählte weiterhin nur ein abstimmendes Team.

### I – Moderatorfortschritt

Bestanden. Der Moderator sah ausschließlich die neutrale Anzahl abgegebener Stimmen. Weder Moderator, Präsentation noch Teams erhielten Kandidatenstände, Prozentwerte oder Ranking.

### J – Voting schließen

Bestanden. Nach dem globalen Schließen wechselten beide Moderatoransichten, Präsentation und Teamgeräte auf den geschlossenen Zustand. Auswahlfelder waren deaktiviert, der finale Vote blieb sichtbar und Reload änderte den Zustand nicht. Ein bereits vom Browser geschlossener Client verhindert nativ einen weiteren Request; die verspätete serverseitige Mutation ist ergänzend als `VOTING_CLOSED`-Regression abgedeckt.

### K – mehrere Moderatoren

Bestanden. Zwei Moderatorclients sahen denselben Zustand. Bei nahezu gleichzeitigem Öffnen gewann genau eine Transition; der zweite Client erhielt die sichtbare Konfliktmeldung und lud den aktuellen globalen Zustand. Der spätere Votingschluss konvergierte in beiden Clients und auf der Präsentation.

### L – ein Kandidat

Bestanden. Quiz `#64` zeigte genau einen Kandidaten und eine Übersicht `1/1`. Das einzige Eigentümerteam konnte den Kandidaten nicht wählen. Der Moderatorfortschritt blieb korrekt bei `0 von 0`; es gab keine künstliche Selbststimme und keinen Fehler. Der geschlossene Zustand stellte den sauberen AP4-Übergang bereit.

### M – AP1/AP2-Regression

Bestanden. AP1-Submission, Draft-/Reload-Logik und Deadline-Vertrag sowie AP2-Auswahl, Review, stabile Positionen und unveränderte Originalsubmission bleiben durch die fokussierte und vollständige Testmatrix abgedeckt. Quiz `#59` bestätigte im Browser, dass freigegebene AP2-Positionen 1 und 3 in AP3 weiterhin `Meme 1` und `Meme 3` heißen und nicht neu nummeriert werden.

## Laufzeitfehler und Korrektur

Der erste Preview-Vote legte einen Prisma-7-Laufzeitfehler offen: PostgreSQL liefert für `pg_advisory_xact_lock` den Typ `void`, den der eingesetzte Treiber nicht deserialisieren kann. Die betroffene Transaktion brach vollständig ab; es wurde kein Vote gespeichert.

Die kleinstmögliche Korrektur castet ausschließlich den Rückgabewert des bestehenden Locks zu `text`. Sperrsemantik und Sicherheitsvertrag bleiben unverändert. Eine Architekturregression schützt den Cast. Nach dem Fix waren vollständige Tests, Feature-CI, Preview-CI, Redeploy und sämtliche oben beschriebenen Vote-Flows grün; die finalen Vercel-Logs enthalten keinen erneuten Prisma-/Vote-Fehler.

## Geänderte Bereiche

- Prisma-Schema, additive Migration und generierter Client für Präsentationen und Votes,
- AP3-Domainregeln, Serverzugriff, Actions und Snapshot-Integration,
- Moderatorsteuerung, Teilnehmer-Voting und Präsentationsplayer,
- gemeinsamer `MemePresentationStage` und Einbindung in den Präsentationsrenderer,
- Unit-, Architektur-, Komponenten- und echte Chrome-Layouttests,
- Architektur- und Moderatorendokumentation.

## Bekannte Restpunkte

AP4 bleibt zuständig für Gewinnerauflösung, Gleichstand, Punktevergabe, Teamnamen-Auflösung, Ergebnisfolie, Prozentwerte und Ranking. Während AP3 werden diese Daten bewusst nicht berechnet oder angezeigt.

Der Browser kann auf nativ deaktivierten Selbstwahl- und Geschlossen-Schaltflächen keinen manipulierten Request auslösen. Die serverseitigen Ablehnungen wurden daher über direkte automatisierte Service-/Policy-Aufrufe belegt. Dies ist keine Produktlücke; die Live-UI und die unabhängig getestete Servergrenze greifen beide.

## Abschluss

Alle AP3-Funktionen sind implementiert und auf der geschützten Preview abgenommen. Stimmen sind persistent, konfliktgeschützt und nach dem Schließen stabil für AP4 verfügbar. Es werden während AP3 keine Zwischenstände oder Teamidentitäten offengelegt. `main` und Production wurden nicht verändert; die Datenbankmigration lief ausschließlich auf Preview.
