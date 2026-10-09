# LOVD-Nachtauftrag 2026-10-10 – fortlaufender Nachweis

## Umfang und Schutzgrenzen

Ausgangs-main ab9bfb1f95af0e70a5ed797d6d5cdfb656869441; eigener Branch
codex/lovd-night-release. Keine erneuten Importe, Importanalysen oder Änderungen
an den 65 importierten Production-Fragen. Keine Production-Aktion bislang.
Kein neues Vollbackup. Vorhandene Backup-/Restore-Nachweise bleiben Referenz;
zulässige Änderungen sind additive Template-Stammdaten und nullable JSONB-Spalte,
keine Bestandsfragenänderung. Ein alter Anwendungscode ignoriert die neue Spalte.

## Bestätigte Ursachen und Umsetzung

AP1: Frage wählte erstes Audio, dadurch bei bestimmter Reihenfolge das Original.
Explizite Phasen-/Slotauswahl; keine Bestandsmedien umgeordnet.
AP2: Normale Musikvorlage fehlte; neue musik-Definition verwendet vorhandene
Medien-/Antwort-/Bewertungsmechanismen ohne Rückwärtsgenerator.
AP3: Kein Countdown am Intro-Player; Restzeit aus realen Metadaten/Position.
AP4: SKIPPED-Leerrunde wurde vom Server als unfinalisiertes Voting blockiert;
enger terminaler Skip und Schutz vor alten Moderations-Pollantworten.
AP5: Bestehendes Overlay hatte keine persistierte Teilnehmerantwort oder
Rangentscheidung. Ergänzung in bestehendem Quizstatus, signierte Sitzungen,
Quiz-Lock, keine Änderungen regulärer Punkte. JSONB-Reihenfolgefehler im Test
gefunden und durch kanonischen Team-/Punktvergleich behoben.
AP6: Vorhandene OpenAI-Implementierung aus PR #71 gezielt übernommen. Zusätzlicher
Schutz gegen alte Vorschläge und statische Template-Fragetexte.

## Lokale Ergebnisse

Vollständiges npm test: 1.570 bestanden, eine erwartete PostgreSQL-Integration
im Standardlauf ohne DB-Variable übersprungen; separat mit echter isolierter
PostgreSQL-Datenbank erfolgreich. 37 zusätzliche LOVD/KI-Tests enthalten.
Zusätzlicher echter Chrome-Audioplayer-Test bestanden, 125-/12-Sekunden-WAV:
Metadaten, keine automatische Wiedergabe, Play/Pause, Seek, Stop, Wechsel, Ende,
verspätete Play-Promise, fehlende Datei und Unmount.
Audio-Reverse-Prozessortest mit deterministischem Signal bestanden.
Typecheck und gezielter ESLint bestanden; endgültige CI wird separat erfasst.
Lokale Test-DB lovd_night_ci, localhost:55448, ausschließlich neu angelegte
Fixture-Daten, UUID-Markierung; Fixture-Quiz/Teams/Fragen im Test entfernt.
Lokaler Next-Build durch Windows-App-Control für natives SWC blockiert;
kein Sicherheitsmechanismus geändert. Linux-CI prüft den Releasebuild.
Windows-CRLF einer unveränderten existierenden Testplan-Datei wurde allein im
Arbeitsbaum normalisiert; keine Änderung dieses Plans wird committet.

## Offene Abnahme und Blocker

Preview mit exaktem geprüften SHA und authentifizierte Spielabläufe noch offen.
Bestehende Preview-Branchliste wird nicht erweitert; freigegebener
codex/editorial-safe-import dient bei unverändertem Remote als Fast-forward-
Abnahmebranch. Keine unabhängigen Änderungen aus preview/content-and-quiz-flow.
Vercel-Umgebungsmetadaten zeigten bislang weder OPENAI_API_KEY noch
OPENAI_QUESTION_REWRITE_ENABLED in Preview/Production. Auch die bekannte lokale
Development-Konfiguration enthält keine OPENAI-Variablennamen. Kein Secret wurde
entschlüsselt oder ausgegeben. Ohne vorhandenen Zugang kein echter Providerbeleg;
Mocks gelten ausdrücklich nicht als vollständige AP6-Abnahme.
Der Gesamt-Release bleibt bis vollständiger Preview-Abnahme gesperrt.

## Nachtrag: Browser-Interaktion und CI

CI 37997821229 und 37997825962 für 507ef5e6e1cfcffa5405de6561b56297d924527b
grün einschließlich Linux-Releasebuild und PostgreSQL. Changed-file-Lint:
48 Dateien, null neue Befunde. Nachfolgender gezielter Fix sichert auch die
Stichentscheid-Pollingantworten gegen veraltete Mutationsstände ab; derselbe
getestete Revisionsschutz wird in der Moderation verwendet.
Der echte lokale Chrome-Test bedient zusätzlich die KI-UI mit ausdrücklich
simuliertem Endpoint: keine automatische Anfrage, Vorschlag getrennt, geänderter
Ausgangstext sperrt Übernahme, Verwerfen erhält Text, Übernehmen ändert nur Text,
Provider-Timeout erhält Draft. Dies ist kein echter OpenAI-Provider-Nachweis.
38 LOVD-Unit-Tests plus echter Browser-Test bestanden. Erneute CI für finalen Fix.
Production-READY/Projekt/Commit und beide Aliasbindungen am 10.10.2026 kontrolliert:
541b913c7a27e4a88ed0a339598dcae5904ea7aa, dpl_2BKPFmFFV4r1ZUCKLmnfLYZPE9Sp,
pubquiz-web.vercel.app und pubquiz-web-just-phil-gud.vercel.app unverändert.

## Preview-Buildbefund

Preview-Run 37999636585 auf c1537a170fe2c35f2fd92a67553159cbf56e0315:
Guard, Datenbankidentität, Migration und Status erfolgreich; Vercel-Build scheiterte
mit TypeScript: stichentscheid_json fehlt im eingecheckten Client. CI regeneriert
den Client vor Typecheck, Vercels vorhandenes npm run build bisher nicht.
Gezielte Korrektur im selben PR: npm-prebuild generiert Prisma ohne Datenbankzugriff.
Keine Projektkonfiguration, Credentials, Daten oder historischen Migrationen geändert.
Der kommende identische Preview-Versuch hat keine ausstehenden neuen Migrationen.
