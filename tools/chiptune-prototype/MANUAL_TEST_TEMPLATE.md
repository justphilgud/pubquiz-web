# Manueller Vergleichstest – Paket 3C.4

## Verbindliche Ausgangslage

| Pipeline | Wiedererkennbarkeit | Musikalischer Klang | Quiztauglich |
| --- | ---: | ---: | --- |
| FFT, Paket 3C.2 | 1/5 | 2/5 | Nein |
| Basic Pitch Full Mix, Paket 3C.3 | 1/5 | 3/5 | Nein |

Keine dieser Bewertungen wird durch Codex verändert oder ergänzt.

## Testmaterial

Ausschließlich dieselben drei rechtmäßig bereitgestellten Ausschnitte verwenden:

1. Uptown Funk
2. Viva la Vida
3. Mr. Brightside

Keine Musikdatei in das Repository kopieren oder committen.

## Erzeugung

Für jeden Song:

```powershell
node --import tsx tools/chiptune-prototype/src/cli.ts `
  --input "C:\Pfad\rechtmaessiger-ausschnitt.wav" `
  --output "tools/chiptune-prototype/output/song.wav" `
  --transcriber basic-pitch `
  --separator demucs `
  --compare-stems
```

Die Dateien `full`, `vocals`, `other` und `vocals-other` werden fachlich bewertet. `bass` ist nur Diagnosematerial.

## Bewertungsbogen pro Song

Song:

Ausschnitt und Dauer:

Technischer Bericht:

| Variante | Wiedererkennbarkeit 1–5 | Musikalischer Klang 1–5 | Quiztauglich Ja/Nein | Bemerkungen |
| --- | ---: | ---: | --- | --- |
| Full Mix | | | | |
| Vocals | | | | |
| Other | | | | |
| Vocals + Other | | | | |

Zusätzliche technische Beobachtungen:

- Stem-Artefakte oder Bleeding:
- fehlende/leere Stems:
- Laufzeit:
- Peak-RSS:
- Cache-Treffer:
- Fehler oder Warnungen:

## Fachliches Erfolgskriterium

Paket 3C.4 ist nur ein fachlicher Fortschritt, wenn mindestens eine Stem-Variante bei mindestens zwei der drei Songs gleichzeitig erreicht:

- Wiedererkennbarkeit mindestens 3/5
- musikalischer Klang mindestens 3/5
- grundsätzlich quiztauglich

„Etwas sauberer“ bei weiterhin 1/5 Wiedererkennbarkeit gilt nicht als Erfolg.

## Stop-Regel

Erreicht keine Variante das Erfolgskriterium, werden keine weiteren Modelle oder umfangreichen Optimierungen automatisch ergänzt. Dann ist festzuhalten:

> Der vollautomatische Weg von beliebigem Popsong zu wiedererkennbarem Chiptune-Cover erreicht mit der getesteten Architektur nicht die erforderliche Qualität.

Mögliche Alternativen wie MIDI-Upload, manuelle Melodiespur, halbautomatische Notenkorrektur, ein spezialisierter externer Musikdienst oder der Verzicht auf die Funktion werden dann nur dokumentiert.
