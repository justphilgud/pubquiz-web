# Chiptune-Machbarkeitsprototyp

Dieser ausschließlich lokale Research-Workflow untersucht, ob sich ein rechtmäßig bereitgestellter Musikausschnitt automatisch in ein vollständig neu synthetisiertes Retro-Cover überführen lässt. Version 3 kann dem bestehenden FFT-/Basic-Pitch-Vergleich optional eine Demucs-Stem-Separation vorschalten.

Der Prototyp bleibt von der produktiven Anwendung getrennt. `audio_chiptune` ist weiterhin inaktiv. Es gibt keine UI, API-Route, Datenbank-, Prisma-, Blob- oder Deployment-Integration. Der Synthesizer rendert ausschließlich neue Pulse-, Triangle- und Noise-Samples; Originalaudio und Stems werden nie in das Ergebnis gemischt.

## Verzeichnisstruktur

```text
tools/chiptune-prototype/
├── .cache/demucs/                 # lokaler Stem-Cache, ignoriert
├── output/                        # lokale Ergebnisse, ignoriert
├── python/
│   ├── .runtime/                  # Basic Pitch / ONNX, ignoriert
│   └── demucs/
│       ├── .runtime/              # Demucs / PyTorch CPU, ignoriert
│       ├── .models/               # htdemucs-Modell, ignoriert
│       ├── .downloads/            # Setup-Downloads, ignoriert
│       └── setup.ps1
├── src/separators/
└── src/transcribers/
```

## Installation unter Windows

### Basic Pitch

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File tools/chiptune-prototype/python/setup.ps1
```

### Demucs

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File tools/chiptune-prototype/python/demucs/setup.ps1
```

Beide Setups verwenden getrennte portable Python-3.11.9-Runtimes. System-Python, globales `PATH`, Registry und Hauptprojekt-Abhängigkeiten bleiben unverändert. Demucs ist auf Version 4.1.0, PyTorch CPU auf 2.12.1 und das Modell auf `htdemucs` festgelegt. Python-/Bootstrap-Downloads sowie Modell und Modellkonfiguration werden per SHA-256 geprüft. Nach dem einmaligen Modell-Download laufen Separationen mit `HF_HUB_OFFLINE=1`.

Lokale Größen dieser Installation:

- Basic-Pitch-Runtime: rund 600 MiB
- Demucs-/PyTorch-Runtime: rund 738 MiB
- `htdemucs`: rund 80 MiB

## Bestehende Aufrufe

FFT bleibt Standard:

```powershell
node --import tsx tools/chiptune-prototype/src/cli.ts `
  --input "C:\Temp\song.wav" `
  --output "C:\Temp\song-chiptune.wav" `
  --transcriber fft
```

Basic Pitch ohne Separation:

```powershell
node --import tsx tools/chiptune-prototype/src/cli.ts `
  --input "C:\Temp\song.wav" `
  --output "C:\Temp\song-chiptune.wav" `
  --transcriber basic-pitch
```

Der bisherige `--compare`-Modus bleibt erhalten und erzeugt FFT- und Basic-Pitch-Ausgabe plus `comparison.json`.

## Demucs und Stem-Auswahl

Einzelnen Stem verarbeiten:

```powershell
node --import tsx tools/chiptune-prototype/src/cli.ts `
  --input "C:\Temp\song.wav" `
  --output "C:\Temp\song-vocals.wav" `
  --transcriber basic-pitch `
  --separator demucs `
  --stem vocals
```

Unterstützte Stem-Auswahlen:

- `full`: Originalmix
- `vocals`: Gesangsstem
- `other`: sonstige Instrumente
- `vocals-other`: kontrollierter Mix aus 60 % Vocals und 40 % Other
- `bass`: Diagnosevariante

Der reine Drum-Stem wird nicht als Melodie transkribiert. `vocals-other` wird auf Mono vereinheitlicht, auf die gemeinsame Mindestdauer gekürzt und bei Bedarf auf Peak 0,92 skaliert. Unterschiedliche Sampleraten werden kontrolliert abgewiesen; Demucs erzeugt alle Stems einheitlich mit 44,1 kHz.

## Stem-Vergleich

```powershell
node --import tsx tools/chiptune-prototype/src/cli.ts `
  --input "C:\Temp\song.wav" `
  --output "tools/chiptune-prototype/output/song.wav" `
  --transcriber basic-pitch `
  --separator demucs `
  --compare-stems
```

Erzeugt werden:

- `song.full.basic-pitch.wav`
- `song.vocals.basic-pitch.wav`
- `song.other.basic-pitch.wav`
- `song.vocals-other.basic-pitch.wav`
- `song.bass.basic-pitch.wav`
- `song.stem-comparison.json`

Der JSON-Bericht enthält Demucs-/Python-Version, Modell, Cache-Status, Separations-, Basic-Pitch- und Syntheselaufzeit, Node-/Separator-/Transcriber-RSS, Notenzahlen, BPM, Ein-/Ausgabedauer, Dateigröße, Warnungen und kontrollierte Variantenfehler. Er enthält keine subjektive Bewertung.

## Cache

Demucs-Stems werden unter `.cache/demucs/<cache-key>/` gespeichert. Der Schlüssel enthält:

- SHA-256 des vollständigen Eingabedateiinhalts
- Demucs-Version
- Modellname
- CPU-, Shift-, Overlap- und Split-Konfiguration

Nur ein vollständiger Cache mit Manifest und allen vier nichtleeren WAV-Dateien gilt als Treffer. Fehlgeschlagene Staging-Verzeichnisse werden entfernt. Der Cache ist lokal und durch `.gitignore` ausgeschlossen.

Roh-Stems können urheberrechtlich geschütztes Material enthalten. Sie dürfen nicht committed, weitergegeben oder länger als für den Test benötigt aufbewahrt werden.

## Sicherheit und Fehlerverhalten

- Unterprozesse werden mit Argumentlisten und `shell: false` gestartet.
- Demucs erhält nur feste Modell- und Separationsparameter.
- Normale CLI-Ausgaben enthalten nur Dateinamen, keine absoluten Pfade.
- Demucs läuft mit reduziertem Environment ohne übernommene Anwendungstokens.
- Das Laufzeitlimit beträgt 15 Minuten; bei Überschreitung wird der Prozess beendet.
- Die Modellgewichte werden vor jedem Lauf gegen feste SHA-256-Werte geprüft.
- URLs und Streaming-Eingaben werden weiterhin abgewiesen.

Kontrollierte Fehler umfassen unter anderem `DEMUCS_ENVIRONMENT_MISSING`, `DEMUCS_MODEL_MISSING`, `DEMUCS_TIMEOUT`, `DEMUCS_OUT_OF_MEMORY`, `DEMUCS_STEMS_MISSING`, `STEM_EMPTY` und `STEM_DECODE_FAILED`.

## Tests

Reguläre Suite ohne echten Demucs-Download/-Lauf:

```powershell
node --import tsx --test tools/chiptune-prototype/tests/*.test.ts
```

Expliziter lokaler Integrationstest mit bereits installiertem Modell:

```powershell
$env:CHIPTUNE_RUN_DEMUCS_INTEGRATION = "1"
node --import tsx --test tools/chiptune-prototype/tests/demucs.integration.test.ts
```

Der Integrationstest verwendet ein zur Laufzeit synthetisiertes Signal, führt echtes Demucs aus, transkribiert `other` mit Basic Pitch, rendert mit dem bestehenden Synthesizer und prüft den anschließenden Cache-Treffer. Es werden keine Songs oder Audiofixtures eingecheckt.

## Fehlerbehebung

- Fehlende Basic-Pitch-Umgebung: `python/setup.ps1` ausführen.
- Fehlende Demucs-Umgebung oder Modell: `python/demucs/setup.ps1` ausführen.
- Modellprüfung fehlgeschlagen: `.models` entfernen und das Setup erneut aus einer vertrauenswürdigen Netzwerkumgebung ausführen.
- Arbeitsspeicherfehler: andere Anwendungen schließen; keine parallelen Demucs-Jobs starten.
- Timeout: einen kürzeren, weiterhin mindestens drei Sekunden langen Ausschnitt verwenden.
- Beschädigter Cache: den betroffenen Ordner unter `.cache/demucs` entfernen; der nächste Lauf trennt neu.

## Entfernen großer lokaler Dateien

Wenn der Spike beendet ist, können ausschließlich diese ignorierten Ordner entfernt werden:

```text
tools/chiptune-prototype/python/demucs/.runtime
tools/chiptune-prototype/python/demucs/.models
tools/chiptune-prototype/python/demucs/.downloads
tools/chiptune-prototype/.cache
tools/chiptune-prototype/output
```

## Bekannte Grenzen

- Die neue Demucs-Version 4.1.0 ist erst seit dem 11. Juli 2026 veröffentlicht und laut Autor nur langsam gepflegt.
- CPU-Separation benötigt erheblich mehr RAM als FFT oder Basic Pitch allein.
- Das vollständige Dependency-Lock pinnt Versionen, nutzt aber noch kein lokales Wheelhouse mit Hashes für jedes Python-Paket.
- Stem-Bleeding und Artefakte können weiterhin falsche Noten erzeugen.
- Technische Funktion und synthetische Messungen belegen keine Wiedererkennbarkeit realer Popsongs.
- Die fachliche Entscheidung treffen ausschließlich die drei dokumentierten Hörtests durch den Product Owner.
