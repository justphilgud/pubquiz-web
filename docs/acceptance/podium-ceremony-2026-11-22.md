# Animierte Siegerehrung

## Umfang

Die bestehende Siegerehrung erhält fünf lokale Szenenphasen. Rangfolge, Teamnamen,
quadratische Teamfotos, Punkte, Gleichstände und die Moderationsnavigation bleiben
an den vorhandenen Snapshot und die bestehenden Klicks gebunden. Es gibt weder
neue Datenbankfelder noch Migrationen oder zusätzliche Abhängigkeiten.

| Moderationsstand | Bühnenablauf |
| --- | --- |
| Folie geöffnet, Zähler 0 | Leere Bühne; fünf Figuren tanzen langsam über die Fläche und wechseln die Seiten. |
| Erster Klick | Figuren bewegen sich zu ihren Ausgangspositionen. Danach bleibt die Bühne kurz ruhig, bevor Platz 3 erscheint. |
| Zweiter Klick | Platz 2 erscheint; mehr Bewegung und ein längerer, dichterer Konfettiregen. |
| Dritter Klick | Platz 1 erscheint in der Mitte. Gudi fliegt mit dem bereitgestellten Partyhutbild wie eine Feuerwerksrakete quer über die Bühne; der am Gudi-Element verankerte Schweif endet mit dem Flug. Die übrigen Figuren springen, rotieren oder hüpfen jeweils eigenständig. Flasche und Champagnerregen kommen nicht vor. |
| Weitere normale Navigation | Alle drei Teamkarten bleiben stehen; die Figuren wippen dezent im pixelartigen Takt, bis die nächste Folie geöffnet wird. |

Die vorhandenen Moderationsklicks lösen weiterhin genau die Enthüllungen 3 → 2 → 1
aus. Animationen und Zeitgeber sind rein lokal und quittieren oder verzögern keinen
Folienwechsel. Bei `prefers-reduced-motion` entfallen CSS-Animationen; die kurze
Fokus-Pause und die vorhandene Reihenfolge bleiben bestehen.

## Änderungen

- `PodiumCelebrationCrowd.tsx` enthält die Figuren, rangbezogenes Konfetti und den
  lokalen Raketenabschluss.
- `PodiumCeremony.tsx` orchestriert Tanz, Sammeln, Enthüllungen und dauerhaftes
  Jubelbild, ohne den Ranglistensnapshot zu verändern.
- `presentationReadability.css` gestaltet Bühne, Teamkarten, Bewegungsbahnen und
  reduzierte Bewegung.
- Optimierte WebP-Bühnen- und Figurenassets liegen unter
  `public/assets/podium-ceremony/` (zusammen ca. 592 KB).

## Lokale Prüfungen

- TypeScript: erfolgreich.
- ESLint der geänderten TypeScript-Dateien: erfolgreich.
- Fokusregressionen für Rankingpolicy, Snapshot, Renderer und Präsentationssync:
  61 Tests erfolgreich.
- Produktionsbuild mit dem Webpack-Compiler: erfolgreich; eine bestehende Warnung
  im PDF-Workerimport bleibt bestehen.
- Der Standard-Turbopack-Build konnte in dieser temporären Worktree-Umgebung die
  außerhalb des Worktrees verlinkten `node_modules` nicht traversieren. Die PR-CI
  muss den regulären Produktionsbuild prüfen.
- Der lokale Zwei-Fenster-Browserlauf konnte Chromium wegen der
  Betriebssystem-Socket-Sperre der Ausführungsumgebung nicht starten. Die
  vorhandene Browserregression enthält Assertions für die fünf Phasen,
  Rangkonfetti, Fotos, quadratische Bildrahmen, Partyhut und Raketenabschluss; ihr
  Ergebnis aus der PR-CI steht noch aus.

## Release-Status

Diese Änderung baut auf dem offenen PR #175 auf, dessen geschützter
Production-Backup-Lauf am 22.11.2026 noch aktiv war. Um dessen geprüften
Releasekandidaten nicht auszutauschen, liegt die Animation auf einem separaten
Branch. PR, gehostete Preview, CI und Production-Smoke folgen über diesen Branch.
Noch kein Merge, kein Production-Deployment und keine Produktionsdatenänderung.
