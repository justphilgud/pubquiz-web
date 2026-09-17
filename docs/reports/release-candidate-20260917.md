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

**Aktuelles manuelles Gate:** Die neue Preview zeigt im echten Browser die reguläre
Quizverwaltungsanmeldung. Die vorhandene Monitoring-Anmeldung ist an deren anderen
Host gebunden. Betreiber um reguläre Admin-Anmeldung auf der neuen Preview gebeten;
keine Sessionübertragung, Authumgehung oder Rollenänderung. Gemäß Auftrag an diesem
Gate stoppen, bis die Anmeldung bestätigt ist.

[Living Specification mit Dateiverantwortlichkeiten und Invarianten](../architecture/booking-outro.md).

## Harte Grenzen und verbleibende Arbeit

Production, main, Credentials, Schutzregeln und Operationssystem unverändert.
Keine neuen Providerfeatures, keine Backup-/Restoreausführung und keine Migration.
Preview-Deploymenthelfer prüft Nonprod-Scope und Medienstore vor Erstellung;
Production-Baseline `dpl_3Ufmv6QmvYkp712cPjVPXBDJtsN3` bleibt Referenz.

Zuerst Outro-Preview regulär anmelden und vollständig prüfen: Speicherung/Reload/Kopie,
aktiv/inaktiv, Defaults und geänderte/leere Inhalte, QR-Scan, 1920×1080 und 1280×720.
Danach erst vollständige Änderungen-/Migrationsinventur, fachliche Branchintegration,
gemeinsame RC-Preview, AP9.1/AP9.2/Pixel/Sponsor/Monitoring-/Rollen-/Lastregression und
zusammenhängender Ablauf. Die Einzelabnahmen der Vorgänger ersetzen dies nicht.

Finaler Migrations-, Backup- und Rollbackplan bleibt bis zur exakten RC-/Production-
Bestandsaufnahme offen. Späteres erforderliches aktuelles Productionbackup erst nach
vollständiger RC-Abnahme; ein fehlgeschlagenes Pflichtbackup verhindert Deployment.
Kein Productionrestore als normaler Rollback. Kein Productiondeployment ohne separate
ausdrückliche finale Freigabe.
