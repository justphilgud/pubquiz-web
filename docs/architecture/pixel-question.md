# Pixel-Frage – Living Specification (AP3)

Basis: AP2 und kompakter AP1-Nachtrag, Commit 6038b8c. Verbindlich zusammen mit
[Lifecycle](quiz-lifecycle.md), [Submission](submission-live-state.md) und
[Answer-Interaction](answer-interaction.md).

## Rekonstruierter IST-Vertrag

Pixel nutzt TEXT, `team_antworten`, versionierte `team_answer_submissions` und
`quiz_interaction_runs`. Der Konfigurationssnapshot enthält Stufendauern;
`opened_at` bestimmt die Stufe. Interne Stufen 1/2/3 entsprechen sichtbaren
Bildstufen 3/2/1. Bildgenerator und gespeicherte Bildslots bleiben unverändert.
Bestandsdefault: 15 Sekunden je Stufe, editierbar von 1 bis 120 Sekunden.
Die letzte Challenge-Stufe bleibt bislang bis zum Schließen offen.

Ein Team mit nichtleerem Draft kann in den ersten beiden internen Stufen stoppen.
Das Run-Lock serialisiert konkurrierende Stops. Der erste Stop erzeugt eine finale
Submission, friert das Bild ein, sperrt den Stopper und gibt anderen Teams noch
20 Sekunden. Normalpunkte: 3/2/1; exklusiv richtiger Stop: 6/4; falscher Stop: −1.
Offene manuelle Bewertungen verhindern eine vorzeitige exklusive Allokation.
Bewertung ist an den Run der wirksamen Submission gebunden, nicht an einen
beliebigen neueren Run. Navigation verwendet gemäß AP1 vorhandene Runs wieder.

Bestehende Regressionen: `pixelLiveInteraction.test.ts` schützt Zeitgrenzen,
Stopper-Schreibschutz, Punkte-Matrix, Pending-Bewertung, Run-Bindung und Close;
`pixelAnswerUiArchitecture.test.ts` schützt die Aktionsposition nach dem Eingabefeld;
`pixelTemplateConfig.test.ts` schützt Konfigurationsnormalisierung.

## Befunde und Erweiterungsentscheidung

Vor dem Stop existiert keine für alle Oberflächen transportierte Stufen-Deadline.
Ein terminaler Run kann beim Lesen seine Stufe weiterhin aus der aktuellen Zeit
ableiten. Anzeigen verwenden außerdem interne statt sichtbarer Stufennummern.
Diese unmittelbar AP3 betreffenden Fehler werden korrigiert.

Challenge behält bestehende konfigurierte Dauern, Stopdauer und Punkte. Stufenwertung
verwendet genau 20/20/20 Sekunden und 3/2/1 Punkte. Fehlender Modus bedeutet Challenge.
V1 zeigt vor jeder Pixel-Frage eine Erklärung, die noch keinen Run öffnet.

Stufen-Snapshots werden als Zusatzmetadaten des bestehenden Drafts persistiert;
der Run merkt abgeschlossene Grenzen. Unter demselben Run-Lock werden fällige
Grenzen vor jedem Antwortschreiben nachgezogen. Dadurch kann eine später gespeicherte
Antwort niemals rückwirkend in eine frühere Stufe gelangen. Es gibt keine Writes
pro Sekunde und keine neue Countdown-Polling-Schleife.

Verglichen wird mit `hasAnswerContentChanged`: NFKC, getrimmte und zusammengefasste
Leerzeichen, deutsche Kleinschreibung. Leeren an einer Grenze entfernt die relevante
Stufe; spätere neue Eingabe erhält die spätere Stufe. Änderungen und Zurückändern
innerhalb einer Stufe werden ausschließlich anhand des Grenzstands verglichen.

## Finaler Ablauf und Verantwortung

`pixel-explanation:<Zuweisung>` ist ein NON_QUESTION-Slide. Er öffnet keine
Interaktion. Erst `question:<Zuweisung>:question` öffnet den gemeinsamen Run.
Modusauswahl liegt im vorhandenen Pixel-Konfigurationsfeld; neue Auswahl speichert
Challenge explizit, historische fehlende Werte bleiben Challenge. Die Bildstärken
und die generierten Slots bleiben unverändert.

Stufenwertung: Erklärung → 3 (20 s) → 2 (20 s) → 1 (20 s) → CLOSED → REVEALED.
Challenge verwendet die gespeicherten Dauern; die bisher unbegrenzt offene letzte
Stufe endet nun bewusst nach ihrer bereits konfigurierten Dauer. Das behebt den
Widerspruch zwischen vorhandener Dauer und tatsächlich offen bleibender Antwortphase.
Bestandsfallback 15/15/15 und individuell konfigurierte Dauern werden nicht migriert.
Die Forderung nach 20 Sekunden wird im neuen Modus strikt umgesetzt; bestehende
Challenge-Konfiguration hat zur Bestandskompatibilität Vorrang.

Ein Stop friert die Challenge-Stufe ein. Seine eigene bestehende 20-Sekunden-Deadline
ersetzt die normalen Stufengrenzen. Stopper bleibt gesperrt. Ohne Stop endet auch
Challenge nach der letzten konfigurierten Stufe. Finale Challenge-Punkte bleiben
unverändert einschließlich Pending-/Bonus-/Negativregel.

## Persistenz und Stufengrenzen

Additive Migration: `team_antworten.pixel_stage_history` (nullable JSON),
`quiz_interaction_runs.pixel_completed_stages` (Integer, Default 0). Keine neue
Antworttabelle. History enthält maximal drei Einträge `{stage, text, at}` und
`relevantStage`. Frühere Grenzen eines erst später antwortenden Teams sind leer.
Teams ohne jeglichen Draft haben implizit ausschließlich leere Grenzstände.

`settlePixelStages` läuft unter dem bestehenden Run-Lock. Vor späteren Draft-Writes
werden alle fälligen Grenzen verarbeitet. Bei ausgelassenen Polls werden Grenzen
nachgezogen: seit der Grenze gab es entweder keine Änderung, oder ein vorheriger
Schreibzugriff hat die Grenze bereits gesichert. Die Run-Grenznummer verhindert
wiederholte Arbeit; vorhandene Snapshots sind unveränderlich. Es entstehen dabei
keine normalen Submissions und keine Erhöhung der Draft-Revision.

Im Stufenmodus sichert der Button den normalen Draft. Der Server lehnt vorzeitige
explizite Submissions für diesen Modus ab; beim Close wird genau der aktuelle
nichtleere Stand über `autoFinalizeDrafts` finalisiert. Das verhindert, dass nach
Leeren einer Antwort eine frühere explizite Submission weiterhin zählt. Ein Team
zählt gemäß AP2 maximal einmal; Grenzmetadaten fließen nicht in den Zähler ein.
Nicht gespeicherte lokale Eingaben zählen nicht rückwirkend. Der bestehende
Autosave und der explizite Speichern-Button geben dafür Rückmeldung.

## Bewertung und Lifecycle

Korrektheit bleibt in der zentralen manuellen Pixelbewertung. Der vorhandene
rungebundene Allokator verwendet für STAGED die persistierte relevante Stufe:
CORRECT erhält 3/2/1, alle anderen Status zunächst 0. Andere Teams beeinflussen
diese Allokation nicht. Ein manueller normaler Punktewert überschreibt die feste
Stufenregel nicht; die manuelle Richtig/Falsch-Entscheidung bleibt maßgeblich.
Eine früh richtige, später falsch geänderte Antwort erhält 0. Ergebnisansichten
und Teamgesamtpunkte lesen weiterhin die zentral gespeicherte Bewertung.

Vorzeitiges Close/Stop sichert den aktuellen Stand zum Schließzeitpunkt als
abgebrochene letzte aktive Stufe und finalisiert über denselben Close. Danach
entstehen keine weiteren Grenzen oder Schreibzugriffe. `closed_at` friert die
sichtbare Stufe ein. Navigation löscht keine History. AP1-Reset löscht Sessions,
Drafts und Runs einschließlich dieser Zusatzmetadaten über bestehende Cascades.
PREPARATION-Tests starten das Quiz nicht implizit.

## Timer, Oberflächen und Performance

Startquelle ist `opened_at`, Grenzen sind kumulierte konfigurierte Dauern. Der
vorhandene Live-Snapshot transportiert `serverNow`, Modus, sichtbare Stufenbasis
und `stageDeadlineAt`. Terminale Runs haben keine aktive Anzeige-Deadline.
Präsentation, Moderation und Teamformular verwenden einen Serverzeit-Offset und
lokale Sekundenticks, niemals einen bei Mount gestarteten 20-Sekunden-Timer.
Reload lädt dieselbe Run-ID, History und Deadline. Polling bleibt unverändert.
Nur eine tatsächlich fällige Grenze erzeugt die Transaktion und Metadaten-Writes;
ein visueller Tick erzeugt weder Requests noch Writes. Ohne verbundene Browser
wird der persistierte Grenzabschluss beim nächsten Lesen/Schreiben nachgezogen;
die absolute fachliche Frist läuft unabhängig davon ab.

Alle Team-Histories einer fälligen Grenze werden in einem parametrisierten
Batch-UPDATE geschrieben. Die Zahl der Datenbank-Roundtrips je Grenze wächst
dadurch nicht mit der Teamzahl; Datenmenge und reine Berechnung bleiben linear.

Moderation zeigt Modus, Bildstufe 3/2/1, Zeit, Challenge-Status und weiterhin AP2-
Fortschritt. Die kompakte Lifecycle-Leiste bleibt unverändert. Präsentation zeigt
eine große Zeitangabe am Bildrand. Teamformular behält die Antwort, zeigt dieselbe
Zeit und verwendet semantische Primäraktion-Tokens einschließlich Focus/Active/
Disabled. Regeltexte liegen in `templates/pixelRules.ts` und nicht im Scoring.

## Invarianten und Regressionen

PIX-INV-01/02: Legacy=Challenge, genau ein Modus (`pixelLiveInteraction.test.ts`).
PIX-INV-03–06/09/17: Grenz-Snapshots erhalten unveränderte Texte, ordnen Änderungen
später zu und entfernen bei Leerstand die Stufe (AP3 A–K inklusive JSON-Rehydrate).
PIX-INV-07/08: Ein Draft/Team, Grenzmetadaten ohne Submission (AP2-Progress-Tests
und zentraler Finalisierungsweg). PIX-INV-10/15: absolute Timergrenzen, Reload bei
7 verbleibenden Sekunden (AP3 L). PIX-INV-11/12: AP1 Stop-/Reset-Sperren und Cascades
bleiben maßgeblich (`quizLifecycleRegression.test.ts`). PIX-INV-13/16/18:
rungebundene richtige Antworten 3/2/1, falsche und verschlimmbesserte Antworten 0.
PIX-INV-14: vorhandene Challenge-Punktematrix unverändert; Stufenwertung hat keinen
Stop und keine teamübergreifende Bonusabhängigkeit.

`buildPraesentationSlides.test.ts` prüft Erklärung vor Frage mit eigenem Key und
unveränderter Fragenzahl. `PresentationSlideRenderer.test.ts` rendert beide Erklärungen
und Countdowns vor/nach Challenge. Vorhandene Pixel-Tests bleiben erhalten; der
Editor-Test ergänzt lediglich den neu explizit gespeicherten Challenge-Modus.
Unit-/Renderer-Tests ersetzen keine echte Browser-/DB-Abnahme. Deren Ergebnisse
werden gesondert im AP3-Abschlussbericht dokumentiert.
