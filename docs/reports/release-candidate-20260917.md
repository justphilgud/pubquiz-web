# Production Release Candidate — Arbeitsstand 17.09.2026

## Entscheidung

**Production Release Candidate noch nicht freigabefähig.**

Der Auftrag verlangt zuerst die vollständige Buchungs-/Kontaktfolien-Abnahme. In den
lokalen und am 17.09. aktualisierten Remote-Branches war dieses Paket nicht vorhanden;
es gab keinen entsprechenden Preview-Abnahmenachweis. Daher zunächst Implementierung
dieser Voraussetzung, noch keine Integration nach main und kein Productiondeployment.

## Isolierter Arbeitsstand

- Worktree `.worktrees/release-candidate`, Branch `codex/production-release-candidate`.
- Basis `8126093`: abgenommener Monitoring-Branch, einschließlich LOVD-/Sponsorstand.
- Neues Outro-Paket: `26d591c244508638da87598f44ca3e522d512361`.
- [CI 35181958330](https://github.com/justphilgud/pubquiz-web/actions/runs/35181958330): completed/success.
- Neue Preview: https://pubquiz-eg2klbhsa-just-phil-gud.vercel.app
- Deployment-ID `dpl_AjxrUFBP1HA52brCNrcmmNUsuhru`, kein Productiontarget.
- Providerprüfung: READY, exakt SHA 26d591c; Production-Baseline unverändert.
- Der stark veränderte Root-Worktree wurde nicht verwendet, zurückgesetzt oder bereinigt.
- `origin/main` wurde ausschließlich gelesen; kein Merge, Cherry-pick oder Force-Push.

## Outro-Implementierung und Prüfstand

Zusätzliche zunächst deaktivierte Buchungsfolie im bestehenden Outro. Headline,
Subheadline, Beschreibung, CTA, Telefon, E-Mail, Instagram, QR-Ziel und Nutzenhinweise
pro Quiz editierbar. Instagramdefault @ungegoogelt, keine erfundenen Telefonnummern
oder E-Mail-Adressen. Dynamischer QR-Code, leere Felder ausgeblendet. Bestehende
Quizrechte, Ablaufpersistenz und Kopie wiederverwendet; eigener rein darstellender
Renderer, keine Antwort-/Timer-/Deadlinelogik darin.

Kein neues Schemafeld und keine neue Migration: vorhandene JSONB-Ablaufkonfiguration.
Keine SQL-Migration ausgeführt. Die Migrationsanalyse des gesamten späteren RC ist
dadurch ausdrücklich noch nicht erledigt.

| Gate | Ergebnis |
|---|---|
| Gesamte lokale Testsuite | 1.125/1.125 erfolgreich |
| TypeScript | erfolgreich |
| ESLint geänderte TS/TSX-Dateien | erfolgreich, keine Warnungen |
| Prisma Validate | erfolgreich mit CI-Dummy-DB-URL |
| Production-Build | erfolgreich mit CI-Dummywerten |
| GitHub-CI | erfolgreich, exakt Implementierungs-SHA |
| QR-Konfiguration / unterschiedliche QR-Ausgabe | automatisiert geprüft |
| Vollständige Outro-Browserabnahme und QR-Scan | noch offen |

**Anmeldung erledigt:** Die RC-Quizverwaltung ist regulär angemeldet. Keine
Sessionübertragung, Authumgehung oder Rollenänderung.

### Fortgesetzte Outro-Browserabnahme

Eigene Preview-Testquizze 45 (`Codex RC Outro-Abnahme 2026-09-17`) und dessen über
den echten Kopierdialog angelegte Kopie 46; keine Bestandsquizze geändert.

- Defaults einschließlich @ungegoogelt, zunächst ausgeschaltet: bestätigt.
- Aktivieren und regulärer Präsentationssprung: bestätigt, BOOKING_CONTACT ist
  NON_QUESTION; vorhandener Abschluss und Kalender bleiben in der Sequenz.
- Headline, Subheadline, Beschreibung, CTA, Kontakte, Instagram, QR-Ziel und
  Nutzenhinweise geändert, gespeichert, Editor und Präsentation neu geladen:
  gespeicherte Werte werden ausgegeben.
- Kopie übernimmt individuelle Buchungsinhalte und Aktivierung. Ausblenden entfernt
  die Folie aus der Produktsequenz (12 statt 13 sichtbare Elemente); Inhalte bleiben.
- Alle neun Felder ausdrücklich geleert, gespeichert und neu geladen: keine
  Rückfüllung der Defaults; Ausgabe ohne Kontaktangaben, CTA oder QR-Code.
- Echter Smartphone-QR-Scan durch Betreiber bestätigt: Instagram-Ziel korrekt.
- Full-HD-Defaultdarstellung geprüft; Screenshot unter `screenshots/rc-outro/`.
- **Fehler in 1280×720:** Instagram und QR-Ziel werden unten abgeschnitten. DOM-
  Messung: Folienende y=606, Kontaktende y=627, URL-Ende y=624. Kein Datenverlust,
  sondern Layout-Clipping. Deshalb keine abgeschlossene Outro-Abnahme behauptet.
- Zweiter kleiner Befund: Quizübersicht nennt fälschlich zwei feste Outrofolien.

Korrektur `918e128e380efd016f606b03a9750d720e224eb7`: nur Buchungs-CSS kompaktere
Abstände/Headline und höhenbegrenzter QR-Bereich; Quizeditor verwendet zentrale
OUTRO_SLIDES statt veralteter lokaler Zweierliste. Keine Persistenz-, Timer- oder
Deadlinelogik geändert. Vollständige Tests 1.125/1.125, Typecheck und ESLint der
geänderten TSX-Datei erfolgreich. Erneute Preview-Layoutabnahme noch erforderlich.

Korrektur-CI [35192172447](https://github.com/justphilgud/pubquiz-web/actions/runs/35192172447)
completed/success. Korrektur-Preview READY: https://pubquiz-4omkjy9er-just-phil-gud.vercel.app ,
Deployment `dpl_GX9uk8dW1ucSU81kppg6eVAqQWZt`, exakt SHA `918e128e380efd016f606b03a9750d720e224eb7`,
target null (Preview), Nonprod-Medienstore `store_VzfNwjccgkzhc9bi`.

**Aktuelles echtes manuelles Gate:** Der dauerhafte RC-Branchalias
https://pubquiz-web-git-codex-production-release-c-0f3a48-just-phil-gud.vercel.app/quiz
zeigt die reguläre Quizverwaltungsanmeldung. Betreiber um Anmeldung dort gebeten.
Dieser Alias bleibt bei weiteren Deployments des RC-Branches gleich. Keine Cookies
übertragen, keine Authentifizierung umgangen. Die alte angemeldete Deployment-URL
enthält weiterhin den alten Code und darf nicht als Nachweis für die Korrektur dienen.
Gemäß Voraussetzung des Auftrags hier stoppen; nach Anmeldung zuerst 720p/Full-HD-
Nachprüfung, erst danach gemeinsame Releaseintegration und vollständige RC-Abnahme.

Hinweis zur Teststeuerung: Leere `fill`-Aufrufe und Datumssegmente wurden durch
sichtbar geprüfte native Tastatureingaben ersetzt. Kontaktwerte wurden zusätzlich
über Screenshot und tatsächliche Präsentationsausgabe bestätigt; eine leere
DOM-Abbildung allein wurde nicht als Speicherversagen gewertet.

[Living Specification mit Dateiverantwortlichkeiten und Invarianten](../architecture/booking-outro.md).

## Harte Grenzen und verbleibende Arbeit

Production, main, Credentials, Schutzregeln und Operationssystem unverändert.
Keine neuen Providerfeatures, keine Backup-/Restoreausführung und keine Migration.
Preview-Deploymenthelfer prüft Nonprod-Scope und Medienstore vor Erstellung;
Production-Baseline `dpl_3Ufmv6QmvYkp712cPjVPXBDJtsN3` bleibt Referenz.

Zuerst korrigierte Outro-Preview regulär anmelden und Layoutkorrektur mit Defaults
und Kontaktdaten bei 1920×1080 und 1280×720 erneut vollständig prüfen.
Danach erst vollständige Änderungen-/Migrationsinventur, fachliche Branchintegration,
gemeinsame RC-Preview, AP9.1/AP9.2/Pixel/Sponsor/Monitoring-/Rollen-/Lastregression und
zusammenhängender Ablauf. Die Einzelabnahmen der Vorgänger ersetzen dies nicht.

Finaler Migrations-, Backup- und Rollbackplan bleibt bis zur exakten RC-/Production-
Bestandsaufnahme offen. Späteres erforderliches aktuelles Productionbackup erst nach
vollständiger RC-Abnahme; ein fehlgeschlagenes Pflichtbackup verhindert Deployment.
Kein Productionrestore als normaler Rollback. Kein Productiondeployment ohne separate
ausdrückliche finale Freigabe.
