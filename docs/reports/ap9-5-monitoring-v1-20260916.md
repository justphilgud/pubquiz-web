# AP9.5 Monitoring V1 — Implementierungs- und Abnahmestand

## Stand

Eigener Branch `codex/ap95-monitoring-v1`, Basis `bc8625b` (LOVD-Previewstand).
Implementierung: `b3bd44103881ba586da739e0f5e6b12cffa00914`.
Keine Integration nach main. Outro, Sponsor, Quiz-/Antwort-/Bewertungs-/Deadline-
und Operationscode sind gegenüber der Basis unverändert.

Preview: https://pubquiz-et7a5ggly-just-phil-gud.vercel.app/admin/monitoring

Deployment `dpl_3N664j3PEL5VUWerZRzkz9CJGZGo`, READY, exakt obiger Commit,
Target nicht Production. Bestehende Nonprod-Bindings vor Erstellung geprüft;
Medienstore `store_VzfNwjccgkzhc9bi`. Production-Deployment vor und nach Erstellung
unverändert `dpl_3Ufmv6QmvYkp712cPjVPXBDJtsN3`. Keine Environment-/Alias-/Credentialänderung.

## Implementierung

- Bestehende globale Adminrolle, Navigation im Benutzermenü. Editor/Eventmanager ausgeschlossen.
- Anwendung, DB, Live-Quiz, Antworten, Backup, Deployment plus Monitorfrische und lokale Historie.
- Getrennter API-/Collector-/Policy-/UI-Vertrag, reine Regeln für späteren Alarm-Ausbau.
- DB technisch read-only; vorhandener Pool und Indizes, begrenzte aktuelle Quiz-/Runprojektion.
- Keine Telemetrieänderung in fachlichen Saveaufrufen. Fehlende Save-/Clientsignale explizit unbekannt.
- Keine Provider-API oder neue Secrets im laufenden Dashboard, keine Notifications.
- Backup nur datierter kuratierter AP9.4-Nachweis; keine behauptete aktuelle Operationsüberwachung.
- Preview-only, admin-only Szenarien healthy/warning/error/no-quiz, auffällige Simulationskennzeichnung.

Signalquellen, konkrete Regeln/Schwellen, Lastbudget und Persistenz:
[Living Specification](../architecture/monitoring.md).
Bedienweg: [Adminhilfe](../admin-guide/monitoring.md).

## Prüfungen

| Prüfung | Ergebnis |
|---|---|
| Globale Adminrolle zugelassen | Automatisierter Endpointtest erfolgreich |
| Editor, Eventmanager, ungültige Adminzuweisung abgewiesen | Automatisierte Endpointtests erfolgreich, Collector nicht aufgerufen |
| Unangemeldet Seite und API auf echter Preview | Bestehender Proxy führt zum Login; keine Diagnose offengelegt |
| DB gesund / langsam / Fehler, unveränderter Livezustand | Regeltests erfolgreich |
| Kein / aktives Quiz, fehlende Livequelle | Regeltests erfolgreich |
| Saveerfolg/-fehler | Prüfung der Aussagegrenze: persistierter Draft beweist keine Erfolgsquote, Monitorfehler keinen Saveverlust; keine echte Save-Injektion |
| Backupnachweis vorhanden / fehlend | Erfolgreich; historischer Beleg bleibt qualifiziert gelb |
| Grün/Gelb/Rot und Alterung | Erfolgreich; Messlücken verhindern irreführendes Gesamtgrün |
| Secrets / Fehlerunterdrückung | Feste Fehlercodes, SHA-Whitelist, keine Exception-/Credentialweitergabe |
| Cache / konkurrierende Reads / Recovery | Erfolgreich |
| Vollständige npm-test-Suite | 1.120/1.120, davon 13 neue Monitoringtests |
| TypeScript | Erfolgreich |
| ESLint geänderter TS/TSX-Dateien | Erfolgreich, 0 Warnungen |
| Lokaler Production-Build | Erfolgreich mit CI-Dummy-Konfiguration; bestehende Fonts benötigten Netzwerkzugriff |
| GitHub-CI | [35144812742](https://github.com/justphilgud/pubquiz-web/actions/runs/35144812742), completed/success |
| Vercel-Preview-Build | READY |

Keine Production-Lastmessung durchgeführt. Das implementierte Budget beträgt 2–3
SELECTs je tatsächlicher Erhebung plus Auth-/Rollenprüfung und Transaktionssteuerung;
30-s-Browserintervall und 30-s-Cache je Serverinstanz. Das sind **Budget-/Architekturwerte**,
keine behaupteten gemessenen Request-/CPU-/Providerkosten. Cache kann mehrere Polls
bedienen; tatsächliches Erhebungsalter bleibt sichtbar. Keine global verteilte Cachegarantie.

## Noch offene Browserabnahme

Die eigene Preview zeigt korrekt die reguläre Anmeldung. Eine bestehende globale
Admin-Anmeldung wurde angefordert. Keine Rollen-/Authänderung vorgenommen.
Bis sie vorliegt, bleiben Desktop-/Schmalansicht, die vier UI-Szenarien, Screenshots
und tatsächliche DB-/Request-/Payloadmesswerte ausdrücklich **noch nicht abgenommen**.

## V2

Schwellen an der Generalprobe kalibrieren; zentrale Save-/Retry-/Fehlertelemetrie mit
getrennten Transport- und fachlichen Ergebnissen; Clientempfang/Acks; aktueller geprüfter
Backupstatus; unabhängiger Außencheck; persistierte Historie; danach gesondert freigegebene
E-Mail-/Provideralarmierung. Nichts davon vorab aktiviert. Keine Backupautomatisierung
oder Retention verändert.
