# Gudi-Bingo – Prüfbericht V1

## Umfang und Architektur

75 eigenständige, editierbare SVG-Szenen mit dokumentierten Storyboards. Die sechs Referenzen sind 3, 9, 24, 42, 66 und 75. Figurenkontur und Gesicht leiten sich aus den unveränderten Originaldateien ab; dies ist eine manuelle Vektorableitung, kein behaupteter ursprünglicher Vektormaster. Keine zusätzlichen Gliedmaßen.

Die bestehende Präsentation behält Layout, Logos, eingefrorenes Design, vollständiges Board und Spielzustand. Nur die aktuelle Zahl erhält eine begrenzte visuelle Ebene. Der Beobachtungsvertrag erkennt neue bestätigte Anhänge; Öffnen, doppelte Nachrichten, Korrektur und Wiederverbindung etablieren einen ruhigen Stand. Keine Spielaktionen, Datenbank, Audio, Migration oder Abhängigkeit. Galerie und Mitschnitt verwenden denselben BingoBoard.

## Tatsächliche lokale Prüfungen

- `test:gudi`: sechs erfolgreiche Tests; alle 75 Zuordnungen, Starts und ruhigen Abschlüsse. 1.890 Geometriefälle, Phil Gud und LOVD, 1280×600, 1366×768, 1920×1080 und 2560×1440.
- Originaldateien per SHA-256 unverändert; eigenständige Scores und formtreue Fluginterpolation geprüft.
- Schneller Wechsel, Größenwechsel, Pause, identische Nachricht, Korrektur, Offline/Wiederverbindung und erneutes Öffnen ohne historisches Abspielen. Fehlender und tatsächlich verzögerter Codechunk: ruhige Zahl. Reduzierte Bewegung: ruhige Zahl.
- Nach 75 Szenen kein Zuwachs relevanter Timer/Listener, höchstens ein RAF während einer Szene, keine Audio-/Videoelemente im Renderer.
- Unveränderte bestehende Board-Browserprüfung: 30 Fälle erfolgreich. Keine bisherigen Geometrie-, Mindestschrift- oder Vollständigkeitsprüfungen abgesenkt.
- Typecheck, strenges ESLint der geänderten Dateien und Next-Build erfolgreich; endgültiger Head wird zusätzlich von CI geprüft.
- Bestehender Haupt-Testlauf erfolgreich. Der lokale vollständige `npm test`-Befehl war insgesamt **nicht** fehlerfrei: unveränderte Windows-Chrome-Profilbereinigung meldete EPERM; verbleibende Tests seriell erfolgreich. Ein unveränderter Content-Such-Browsertest scheiterte einmal an einer fehlenden asynchronen Schaltfläche und bestand unverändert im isolierten Wiederholungslauf. Keine dieser Prüfungen wurde abgeschwächt. Linux-Head-CI ist separat maßgeblich.

## Gestaltung und Sichtprüfung

Alle 75 Szenen wurden anhand zeitlich verteilter Phasen auf Identität, Ablauf, Kontakte, eindeutige Zahl, Überschneidung und Abschluss durchgesehen. Daraus folgten konkrete Korrekturen an Kugelvordergrund, Fahrzeug-/Fahrerkontakt, Vorhang, Tischgeschirr, Wartungswerkzeug, Zugdach, Torpfosten und Besenrampe. Durchgehende Flugkurven vermeiden Stopps an jedem Zwischenpunkt.

Native Echtzeitmitschnitte verwenden den tatsächlichen Browser-Compositor, normale Geschwindigkeit und sichtbare Zahlenzuordnung; keine aus Standbildern vorgetäuschte Bewegung. Fünf Rollen und sechs Einzelreferenzen sowie ein LOVD-Referenzlauf dienen der gestalterischen Abnahme. Automatisierte Aufnahme und Phasenprüfung ersetzen keine menschliche Bewertung von Humor und Animationsqualität. Kein physischer Beamer-/Gerätetest; keine vollständige menschliche Echtzeitabnahme behauptet.

## Berechtigungen und Hosting

Branch: `codex/gudi-bingo-animations`, Basis `f0a5b0643312b33a4387ad09872e358d8dab8ccd`. Repositoryzugriff und lokale Ausführung sind vorhanden. Die vorgeschriebene separate menschliche Vertrauensfreigabe genau dieses neuen Preview-Branches liegt noch nicht vor. Er ist weder in `TRUSTED_PREVIEW_BRANCHES` noch in der exakten Preview-Environment-Policy aufgenommen. Diese Regeln wurden nicht verändert und kein Hosting gestartet.

Nach dieser Freigabe fehlen noch: exakt diesen Branch aufnehmen, eigene isolierte synthetische Datenbank identifizieren/konfigurieren, grüne Head-CI und bestehende Guards nutzen, regulär deployen, READY/Alias/Runtime-SHA und authentifizierte Galerie gehostet prüfen. Keine Nutzung der gemeinsamen Entwicklungsdatenbank oder fremder Medienpräfixe. Lokal verfügbare Galerie und Belege sind ausdrücklich keine gehostete Abnahme.

## Abnahme in sechs Schritten

1. Galerie öffnen; Phil Gud und eine Zahl auswählen.
2. Wiederholen und Vorherige/Nächste prüfen; vollständiges Board und ruhige Endzahl bleiben sichtbar.
3. Referenzen 3, 9, 24, 42, 66, 75 bei kleiner Laptopfläche ansehen.
4. Gesamtdurchlauf starten, stoppen und LOVD wählen.
5. Reduzierte Bewegung einschalten: nur ruhige bestätigte Zahl.
6. Ereignisprüfung öffnen: doppelte Nachricht, erneut öffnen, Wiederverbindung und Korrektur dürfen keine historische Szene starten.

Kein Merge, kein Production-Deployment, keine produktiven Daten-, Rechte- oder Sessionänderungen.
