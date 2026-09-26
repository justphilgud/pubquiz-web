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

## Phase 2 und aktueller Preview-Bestand

Die Phase-2-Aufbereitung wurde am 26. September 2026 mit dem offiziellen
AI-SDK-Transport und `perplexity/sonar` abgeschlossen. Alle 100 bestehenden
Kandidaten aus Batch `#1` wurden verarbeitet; es wurden keine weiteren
OpenTDB-Fragen abgerufen.

| Kennzahl | Anzahl |
|---|---:|
| Automatisch verarbeitet | 100 |
| Erfolgreich lokalisiert | 93 |
| Lokalisierung problematisch | 7 |
| Faktencheck `VERIFIED` | 92 |
| Faktencheck `AMBIGUOUS` | 3 |
| Faktencheck `CONTRADICTED` | 0 |
| Faktencheck `NO_RELIABLE_SOURCE` | 5 |
| `READY_FOR_REVIEW` | 51 |
| `REVIEW_REQUIRED` | 45 |
| `REJECT_RECOMMENDED` | 0 |
| Manuell in den normalen Fragen-Lifecycle übernommen | 3 |
| Manuell abgelehnt | 1 |

Die 100 Zeilen in `external_question_import_items` bleiben Import-/Stagingdaten.
Die expliziten Reviewentscheidungen erzeugten zusätzlich drei reguläre,
unveröffentlichte Preview-Fragen im bestehenden Lifecycle:

- Importkandidat `#2` → Preview-Frage `#122` (Megadeth / Dave Mustaine)
- Importkandidat `#4` → Preview-Frage `#123` (Assassin’s Creed / Spanische Inquisition)
- Importkandidat `#6` → Preview-Frage `#124` (Motorradhersteller / Toyota)

Importkandidat `#3` wurde im Pilot manuell abgelehnt und erzeugte keine Frage.
Die drei regulären Fragen dienen der Pilot- und Reviewabnahme. Alle übrigen
Kandidaten bleiben ausschließlich Stagingdaten. Es erfolgt keine automatische
Freigabe oder Veröffentlichung und keine Preview-Bereinigung.

Weitere vollständige Contentbatches werden nicht zusätzlich in Preview
persistiert. Preview bleibt für kleine repräsentative Piloten und technische
Workflow-Abnahmen. Große neue Contentbatches folgen dem in
`docs/architecture/external-question-import.md` festgelegten, durch read-only
Production-Bestandsprüfung und frisches Backup geschützten Production-Prozess.
