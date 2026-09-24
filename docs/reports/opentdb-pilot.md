# OpenTDB-Pilot – Auswertungsrahmen

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

## Kennzahlen

Die Reviewseite `/admin/question-import` berechnet den aktuellen Stand direkt
aus dem Batch. Der Abschlussbericht wird nach dem Preview-Lauf mit diesen Werten
befüllt:

| Kennzahl | Anzahl |
|---|---:|
| Von OpenTDB abgerufen | 100 |
| Automatisch verworfen | offen |
| Übersetzt | offen |
| Faktencheck bestanden | offen |
| Faktencheck fehlgeschlagen | offen |
| Mögliche Dubletten | offen |
| Review erforderlich | offen |
| Automatisch vollständig aufbereitet | offen |
| Manuell freigegeben | offen |
| Manuell abgelehnt | offen |

## Auswertungsfragen

- Welcher Anteil wird nach Prüfung als ungegoogelt-Frage übernommen?
- Welche Ablehnungsgründe treten am häufigsten auf?
- Welche deterministischen Filter liefern belastbare Treffer?
- Wie viel redaktionelle Zeit beansprucht eine akzeptierte Frage?
- Welche Schritte benötigen weiterhin menschliche Prüfung?

## Vorläufige Bewertung

Abruf, Provenienz, Idempotenz, strukturelle Filter, bestehendes
Kategoriemapping, Duplikathinweise und sicherer Review-Übergang sind
automatisierbar. Natürliche Lokalisierung und belastbare Faktenquellen sind ohne
eine im Projekt freigegebene Enrichment-Infrastruktur nicht seriös vollständig
automatisierbar und bleiben deshalb blockierende Reviewkriterien.
