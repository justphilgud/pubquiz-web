# Gemeinsame Preview: Quiz-Ampeln und Vorlesedauer

Basis: main `e456764a` nach PR #171 und #172. AP5 bleibt unverändert und wird
nicht erneut implementiert. Keine neue Abhängigkeit, Migration oder Änderung
von Spielbetrieb, Antworten oder Bewertung. **Kein Production-Backup und kein
Production-Deployment in diesem Auftrag.** Ein gemeinsamer Release folgt erst
nach gemeinsamer Preview-Abnahme und gesonderter Autorisierung.

## Architektur und Umfang

- `readingDuration.ts` schätzt ausschließlich aus aktuellem Übersetzungstext und
  Geschwindigkeit. Der gemeinsame Editor zeigt die Dauer bei Neuanlage und
  Bearbeiten. Original, Übersetzung, Generatoren und Speichern bleiben unverändert.
- `quizBalance.ts` berechnet die verbindlichen Gruppen und Grenzen, blockweise und
  ohne vorherige Rundung. Die Registry-Zuordnung ist exhaustiv. Der Serverleser
  verwendet nur bereits autorisierte Quiz-IDs und Stammdaten, keine Spielergebnisse.
- `QuizBalanceSummary` zeigt einen kompakten Einstieg in Quizliste und Vorbereitung;
  der vorhandene Modal übernimmt Fokus, Escape und Scrollgrenzen. Detailansicht:
  Gruppenring, Textwerte, Sachkategorien, Regeln und Empfehlungen je Block.
- Die aktive Inhaltssuche nutzt die bestehende Mehrfach-Combobox und wiederholte
  Template-URL-Parameter. Empfehlungen öffnen echte neue Tabs; sie kombinieren
  benötigte Kategorie- und Templatefilter und ordnen nichts automatisch zu.
- Notwendige Suchkorrekturen: Standard filtert tatsächlich Standard, ohne zusätzliche
  MC-/Wahr-Falsch-Treffer. MC und 8-Bit sind nun selbst filterbar, bleiben im Editor
  aber wie zuvor nicht eigenständig auswählbar. Die Empfehlungen erzwingen keinen
  Eventreihenfilter, der globale Fragen ausschließen würde.

Die [verbindliche Tabelle](../architecture/quiz-balance.md#verbindliche-regeln)
führt alle Gruppen einschließlich Schätzfrage und Umfragen ohne Ampel auf.
Der Auftraggeber hat die disjunkte Zählung der Standard-/MC-/Wahr-Falsch-Gruppen
bestätigt. Nicht jedes einzelne Template muss vorkommen; Präsenzregeln gelten je
Gruppe. Leere Blöcke bleiben mangels Nenner neutral. Sachkategorien ohne Fragen
erscheinen nicht als Ampelzeile. Kategorien können sich überlappen.

## Isolierte Testdaten

Vorhandene synthetische Review-Datenbank `lovd_november_review_20261119`, bestehender
eingeschränkter Runtime-Benutzer, synthetischer Admin. Neue Fixtures wurden getrennt
angelegt, ohne die bisherigen AP1–5-Testdaten oder Production zu überschreiben:

| Testquiz | Zweck |
|---|---|
| #2, Verteilung und Vorlesedauer | Zwei Blöcke mit jeweils 20 Fragen; Audio 3/20 = 15 % grün und 2/20 = 10 % gelb; zusätzliche Drei-Audio-Regel grün. Alle Präsenzgruppen in Block 1, einige bewusst fehlend in Block 2. |
| #3, Drei Audio fehlen | Zwei Blöcke mit je zwei Audio-Fragen; gemeinsame Zusatzregel rot. |
| #4, Leere Blöcke | Neutrale Leerzustände ohne Division durch null. |

Gespeicherte Übersetzungsfrage #33: 150 Wörter, 1×, Original separat erhalten.
Suchpool mit Kategorie Film: normale Musik #82, rückwärts #83, 8-Bit #84,
Übersetzung #85 sowie Standard #86, MC #87 und Wahr/Falsch #88 zur Abgrenzung.
Eine anfangs unvollständige eigene Ordering-Fixture wurde vor der Detailprüfung
mit gültigen kanonischen Antworten und Teilnehmerreihenfolge ergänzt. Dafür wurde
keine Anwendungsregel geändert.

## Bisherige Prüfungen

- TypeScript und ESLint der geänderten Quellen erfolgreich.
- 88 gezielte Vertragsregressionen zunächst erfolgreich, einschließlich aller
  Ampelgrenzen, Blocknenner, Registry-/Aliasabdeckung, Vorlesedauer und Suche.
  Zusätzlicher Test schützt geschlossene Empfehlungen gegen offene Standardfragen.
- Echter Browserregressionstest: Texteingabe, Geschwindigkeit, Original-/Textschutz,
  Ampeldialog, Fokusrückgabe, Kombinationslink und Mehrfachauswahl erfolgreich.
- Lokaler vollständiger Next-Production-Build: Liste und Vorbereitung mit kompakten
  Ampeln, Blockdetails und getrennten Kategorien geladen. Echte Neuanlage und
  Bearbeitung zeigen 150 Wörter → 1:00, 75 Wörter → 0:30; 150 Wörter bei 2× → 0:30.
  Weder Original noch Übersetzung automatisch geändert, keine Speicherung ausgelöst.
- Die echte Suche deckte die zuvor ausgeblendeten MC-/8-Bit-Filter und den unnötigen
  Reihenfilter auf. Beide Ursachen sind im gemeinsamen Implementierungsstand korrigiert;
  die abschließende positive Trefferprüfung erfolgt auf dessen neuem Build/Preview.

Gesamttests, abschließender Build, gehostete Treffer-/Tab-/Größenprüfungen sowie
Preview- und PR-Link werden vor Übergabe ergänzt. Die Vorlesedauer bleibt eine
Schätzung mit offen benannter 150-Wörter/Minute-Annahme, keine gemessene Audiodauer.
