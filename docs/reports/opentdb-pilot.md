# OpenTDB-Pilot – Abschlussbericht

## Technischer Stand

- Provider: OpenTDB
- Pilotgröße: exakt 100 Fragen
- Abruf: 34 `easy`, 33 `medium`, 33 `hard`; ausschließlich `multiple`
- API-Encoding: RFC 3986, anschließend kontrollierte URL-/HTML-Dekodierung
- Externe Referenz: deterministischer SHA-256-Fingerprint, da die klassische
  API-Antwort keine stabile Fragen-ID liefert
- Lizenz: CC BY-SA 4.0 mit Original, Referenz und Bearbeitungshinweis
- Veröffentlichung: ausgeschlossen; freigegebene Importkandidaten gehen als
  `IN_REVIEW` und `freigegeben = false` in den bestehenden Lifecycle
- Umgebung: Preview-only
- Preview-Batch: `#1`
- Preview-Commit: `b15c684b0eba4bc9619dd998d4d61b5f1f34c14e`
- Deploy-Run: `36036398565` (`Deploy Preview #399`)
- Deployment: `dpl_Cn1h1p4zjp57ejDifNQwjiGVnQnf`

## Kennzahlen

Die Reviewseite `/admin/question-import` berechnet den Stand direkt aus Batch
`#1`. Der Lauf wurde am 24. September 2026 in Preview ausgeführt.

| Kennzahl | Anzahl |
|---|---:|
| Von OpenTDB abgerufen | 100 |
| Automatisch verworfen | 0 |
| Übersetzt | 0 |
| Faktencheck bestanden | 0 |
| Faktencheck fehlgeschlagen | 100 |
| Mögliche Dubletten | 0 |
| Review erforderlich | 100 |
| Automatisch vollständig aufbereitet | 0 |
| Manuell freigegeben | 0 |
| Manuell abgelehnt | 0 |

Die Schwierigkeitsverteilung entspricht exakt der Vorgabe: 34 `easy`, 33
`medium`, 33 `hard`. Alle 100 Fragen, Provider-Referenzen und Antwortsätze sind
eindeutig; jede Frage besitzt genau vier nicht leere, unterschiedliche
Antwortoptionen. Der Lauf umfasst 23 OpenTDB-Kategorien.

Die häufigsten Prüfhinweise waren:

- Deutsche Lokalisierung fehlt: 100
- Fachquelle fehlt: 100
- Stark lokaler Kontext: 3
- Sprachabhängige Frage: 2
- Keine bestehende Kategorie zugeordnet: 2
- Frage möglicherweise mehrdeutig: 1

Die Browserprüfung bestätigte Originalfrage, Originalantworten, Provenienz,
Schwierigkeitsgrad, Kategorievorschlag, manuelle Bearbeitungsfelder und die
gesperrte Freigabe. Die Browserkonsole blieb ohne Warnungen oder Fehler.

## Auswertung

- Übernahmequote: 0 %, weil keine Frage ohne deutsche Lokalisierung und
  unabhängige Fachquelle in den regulären Lifecycle wechseln darf.
- Deterministisch belastbar sind Abruf, Dekodierung, Provenienz,
  Schwierigkeitsverteilung, strukturelle Antwortprüfung, Fingerprint-Idempotenz,
  vorhandenes Kategoriemapping und Reviewstatus.
- Die redaktionelle Zeit je akzeptierter Frage ist noch nicht messbar, da
  bewusst keine unvollständige Frage freigegeben wurde.
- Lokalisierung, Faktenquelle, Mehrdeutigkeit und lokaler oder
  sprachabhängiger Kontext bleiben menschliche Prüfaufgaben.

## Abschlussbewertung

Abruf, Provenienz, Idempotenz, strukturelle Filter, bestehendes
Kategoriemapping, Duplikathinweise und sicherer Review-Übergang sind
automatisierbar. Natürliche Lokalisierung und belastbare Faktenquellen sind ohne
eine im Projekt freigegebene Enrichment-Infrastruktur nicht seriös vollständig
automatisierbar und bleiben deshalb blockierende Reviewkriterien.

Der Pilot bestätigt damit die technische Eignung von OpenTDB als Quelle für
einen kuratierten Reviewbestand, nicht für eine automatische Veröffentlichung.
Vor einem Production-Rollout sollte ein freigegebener Übersetzungs- und
Quellenadapter ergänzt und anschließend eine repräsentative manuelle Stichprobe
mit gemessener Annahmequote und Prüfzeit durchgeführt werden.

Production und `main` wurden durch den Pilotlauf nicht verändert.
