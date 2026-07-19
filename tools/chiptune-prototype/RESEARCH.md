# Technische Machbarkeitsbewertung

Stand: 19. Juli 2026. Prototype-Version: `3`.

## Forschungsfrage Paket 3C.4

> Verbessert eine Stem-Separation mit Demucs die anschließende Basic-Pitch-Transkription so stark, dass eine wiedererkennbare und grundsätzlich quiztaugliche Chiptune-Version entsteht?

Die technische Pipeline ist implementiert. Die fachliche Antwort bleibt bis zu den drei manuellen Hörtests ausdrücklich offen.

## Verbindliche Baseline

| Paket | Pipeline | Wiedererkennbarkeit | Musikalischer Klang | Quiztauglich |
| --- | --- | ---: | ---: | --- |
| 3C.2 | FFT | 1/5 | 2/5 | Nein |
| 3C.3 | Basic Pitch, Full Mix | 1/5 | 3/5 | Nein |

Basic Pitch erzeugte musikalisch plausiblere Ergebnisse, verbesserte die Wiedererkennbarkeit aber nicht ausreichend. 3C.4 verändert deshalb nur die Audioquelle vor Basic Pitch; Bereinigung, Arrangement und Synthesizer bleiben gemeinsam.

## Primärquellen und Auswahl

- Offizielles, vom ursprünglichen Autor weitergeführtes Repository: https://github.com/adefossez/demucs
- Aktuelles PyPI-Paket: https://pypi.org/project/demucs/
- Offizielles `HTDemucs`-Modell: https://huggingface.co/adefossez/HTDemucs
- Offizielle PyTorch-CPU-Installationsmatrix: https://pytorch.org/get-started/previous-versions/
- Hybrid-Transformer-Paper: https://arxiv.org/abs/2211.08553

Demucs 4.1.0 wurde am 11. Juli 2026 veröffentlicht und ist die aktuelle stabile PyPI-Version. Das frühere Meta-Repository ist archiviert; das Repository des ursprünglichen Autors bezeichnet sich als offiziell weitergeführte Variante, weist aber zugleich auf langsame beziehungsweise geringe aktive Pflege hin.

## Versionen, Lizenz und Plattform

| Bestandteil | Version | Lizenz | Einordnung |
| --- | --- | --- | --- |
| Demucs | 4.1.0 | MIT | Python ≥3.10; Windows wird offiziell beschrieben. |
| `htdemucs` | Revision `bf35a81b663819a8255c8fefee17f9d812b786b5` | MIT laut offizieller Modellseite | Standardmodell, vier Stems, ein Modell statt vierfach langsamer Fine-Tune-Bag. |
| PyTorch CPU | 2.12.1+cpu | BSD-3-Clause | Offizielles Windows-CPU-Wheel, keine CUDA-/GPU-Abhängigkeit. |
| Python Embeddable | 3.11.9 | PSF License | Separate portable Runtime innerhalb des Prototyps. |
| Basic Pitch | 0.4.0 | Apache-2.0 | Unveränderte getrennte ONNX-Runtime. |

Demucs 4.1.0 verlangt offiziell Python 3.10 oder neuer. Python 3.11 ist mit Demucs, PyTorch 2.12.1 und Basic Pitch kompatibel. Trotzdem wurden zwei getrennte Python-3.11-Runtimes gewählt: Dadurch kann das große, aktuelle PyTorch-Abhängigkeitsset die bereits getestete Basic-Pitch-/ONNX-Installation nicht verändern.

## Modellwahl

Verwendet wird ausschließlich `htdemucs`:

- etabliertes Standardmodell,
- vier Quellen `vocals`, `drums`, `bass`, `other`,
- laut offizieller Dokumentation auf MUSDB HQ plus 800 zusätzlichen Songs trainiert,
- ein einzelnes Modell,
- geringere Laufzeit als `htdemucs_ft`, das vier Modelle ausführt,
- keine experimentellen Piano-/Gitarren-Stems.

Das Modell `955717e8.safetensors` wurde lokal mit 84.025.440 Byte gemessen. SHA-256:

```text
d9fa14133cfcc034a6758923bb3a8ca9f8dfd0b582134643bbf83f72c17576dd
```

Die Konfiguration `htdemucs.yaml` hat SHA-256:

```text
239c445d0b14454d541ad8bd9bb271c9e536d267e8a4625208744cbb2e7bb66c
```

Beide Werte werden beim Setup und vor jeder Separation geprüft.

## Runtime, CPU, RAM und Speicher

Offizielle Demucs-Hinweise:

- CPU-Betrieb wird unterstützt.
- Die Dokumentation nennt als grobe CPU-Laufzeit ungefähr das 1,5-Fache der Audiolänge.
- Paralleljobs erhöhen den RAM-Bedarf proportional; der Prototyp verwendet deshalb `jobs=0` und startet keine parallelen Separationsjobs.
- Für GPU-Betrieb werden offiziell mindestens etwa 3 GiB, mit Standardparametern eher etwa 7 GiB GPU-RAM genannt. Der Prototyp verwendet keine GPU.
- `htdemucs` trennt in überlappenden Segmenten; verwendet werden ein Shift und Overlap 0,25.

Lokal gemessene Größen:

| Bestandteil | Größe |
| --- | ---: |
| Demucs-/PyTorch-Runtime | 773.446.617 Byte, rund 737,62 MiB |
| Modellcache einschließlich Metadaten | 84.026.769 Byte, rund 80,13 MiB |
| bestehende Basic-Pitch-Runtime | rund 600 MiB |

Synthetischer technischer 20-Sekunden-Vergleich:

| Phase | Messwert |
| --- | ---: |
| reine Demucs-Inferenz | 7.537 ms |
| Demucs-Aufruf inklusive Modellladen und WAV-Schreiben | 10.373 ms |
| Peak-RSS Demucs-Python | rund 1.252 MiB |
| Basic Pitch je Stem | rund 2,5–2,8 s |
| Arrangement und Synthese je Stem | rund 20–31 ms |
| kompletter Fünf-Varianten-CLI-Lauf | rund 27,7 s |

Das synthetische Signal und die lokale Hardware sind keine belastbare Hochrechnung für reale Popsongs. Der Bericht misst jeden echten Lauf erneut.

## Offline-Nutzung und Download-Sicherheit

Das Setup lädt einmalig über HTTPS:

- das offizielle Python-Embeddable-Paket von python.org,
- `get-pip.py` vom offiziellen PyPA-Bootstrap-Endpunkt,
- gepinnte Pakete von PyPI und dem offiziellen PyTorch-CPU-Index,
- `htdemucs` vom offiziellen Hugging-Face-Modellrepository des Demucs-Autors.

Python-Archiv, Bootstrap-Datei, Modell und Modellkonfiguration werden gegen feste SHA-256-Werte geprüft. Ein vollständiges lokales Modellmanifest dokumentiert Pfade, Größen und Hashes. Normale Separationsläufe setzen `HF_HUB_OFFLINE=1` und können das Modell nicht nachladen.

Restrisiko: Die Python-Paketversionen sind vollständig gepinnt, aber der Prototyp besitzt noch kein eigenes Wheelhouse mit `--require-hashes` für jedes transitive Paket. Für eine produktive Lieferkette wären ein geprüfter interner Artefaktspiegel, vollständige Wheel-Hashes, SBOM und Vulnerability-Scanning erforderlich. Das ist nicht Teil dieses lokalen Spikes.

## Architektur

```text
Originalaudio
├── Full Mix ───────────────────────────────┐
└── Demucs → vocals / drums / bass / other │
              ├── vocals                   │
              ├── other                    │
              ├── vocals 60 % + other 40 %│
              └── bass (Diagnose)          │
                                            ↓
                                      Basic Pitch
                                            ↓
                                 gemeinsame Bereinigung
                                            ↓
                                  gemeinsames Arrangement
                                            ↓
                                  bestehender Synthesizer
                                            ↓
                                           WAV
```

Der Separator-Layer liegt unter `src/separators/`:

- `types.ts`: `AudioStemSeparator` und typisiertes Ergebnis
- `registry.ts`: feste Separator-Auswahl
- `demucs.ts`: Cache, sicherer Prozessstart, Timeout und Ergebnisvalidierung
- `cache.ts`: Inhaltsfingerprint, Konfigurationsschlüssel und Manifest
- `stems.ts`: Auswahl, Leersignalprüfung und kontrollierter Mix

FFT und Basic Pitch bleiben über den vorhandenen Transcriber-Layer verfügbar. Der Synthesizer wurde nicht verändert.

## Sichere Prozessgrenzen

- `spawn` mit separater Argumentliste und `shell: false`
- feste Werte für Modell, CPU, Shift, Overlap, Split und Jobs
- keine Weitergabe beliebiger Demucs-Argumente aus der CLI
- reduzierte Kindprozess-Umgebung ohne Anwendungstokens
- keine ungefilterten Python-Ausgaben in der normalen CLI
- kontrollierte deutsche Fehler ohne lokale absolute Pfade
- 15-Minuten-Timeout mit Prozessabbruch
- temporäres Cache-Staging und Cleanup bei Fehlern
- Validierung aller vier erwarteten Stem-Dateien
- Leersignalprüfung vor ausgewählter Stem-Verarbeitung

## Stem-Mix

`vocals-other` verwendet fest:

- Vocals 60 %
- Other 40 %
- Downmix beider Quellen auf Mono
- gemeinsame Samplerate; Abbruch bei inkonsistenten Stems
- gemeinsame Mindestdauer
- Peak-Begrenzung auf 0,92

Es gibt keine UI und keine frei konfigurierbaren Mischparameter.

## Cache-Konzept

Der SHA-256-Cache-Key umfasst:

- vollständigen Inhalt der Eingabedatei,
- Demucs-Version,
- Modellname,
- Device, Shift, Overlap und Split-Konfiguration.

Ein Treffer erfordert ein passendes Manifest und alle vier nichtleeren WAV-Dateien. Schreibvorgänge erfolgen zunächst in einem eindeutigen Staging-Verzeichnis; erst ein vollständiges Ergebnis wird atomar in den finalen Cachepfad verschoben. Cache, Modell, Runtimes und Ausgaben sind durch `.gitignore` ausgeschlossen.

## Erzeugte Varianten und technische Notenzahlen

Beim synthetischen 20-Sekunden-Lauf:

| Quelle | rohe Basic-Pitch-Noten | bereinigte Melodie | Bass | BPM |
| --- | ---: | ---: | ---: | ---: |
| Full Mix | 83 | 40 | 41 | 60 |
| Vocals | 41 | 30 | 15 | 179 |
| Other | 80 | 40 | 40 | 60 |
| Vocals + Other | 81 | 40 | 41 | 60 |
| Bass | 60 | 8 | 42 | 60 |

Alle Ausgaben waren 20 Sekunden lang und jeweils 882.044 Byte groß. Diese Zahlen bewerten weder richtige Tonhöhen noch Wiedererkennbarkeit.

## Datenschutz und Urheberrecht

Die Verarbeitung erfolgt lokal. Es werden keine Audiodateien an Demucs, Spotify, Hugging Face oder einen anderen Dienst übertragen. Der einmalige Modell-Download überträgt keine Testmusik.

Roh-Stems im Cache und normalisierte Debug-Eingaben können urheberrechtlich geschütztes Material enthalten. Sie sind ignoriert, dürfen nicht committed oder geteilt werden und sollten nach Abschluss der rechtmäßig autorisierten Tests gelöscht werden.

## Automatisierte Nachweise

- Unit-Tests für Registry, CLI, Cache-Key, Cache-Hit/-Miss, fehlende Stems, Stem-Mix, Clipping, Leersignal, Fehlerzuordnung und diskrete Prozessargumente
- reguläre FFT-/Basic-Pitch-Charakterisierungstests
- expliziter echter Demucs-Integrationstest mit synthetischem Signal
- echter Ablauf Demucs → Other → Basic Pitch → bestehender Synthesizer → gültige WAV
- echter anschließender Cache-Treffer

Der echte Demucs-Test ist absichtlich nur mit `CHIPTUNE_RUN_DEMUCS_INTEGRATION=1` aktiv, damit reguläre Tests weder Modelle herunterladen noch den großen Separator ungefragt starten.

## Bekannte Einschränkungen

- 4.1.0 ist eine sehr junge stabile Veröffentlichung.
- CPU-RAM und Runtime-Footprint sind für eine synchrone Produktivroute zu groß.
- Stem-Separation kann Bleeding, Phasenartefakte und falsche Tonhöhen hinterlassen.
- Basic Pitch arbeitet laut eigener Dokumentation am besten mit einzelnen Instrumenten; `vocals` und `other` sind weiterhin keine garantierten monophonen Quellen.
- Tempoerkennung bleibt die bestehende einfache Heuristik; keine neue Rhythmusengine wurde eingeführt.
- Es gibt keine subjektive Bewertung durch Codex.

## Manuelle Entscheidung und Stop-Regel

Der Product Owner bewertet ausschließlich Uptown Funk, Viva la Vida und Mr. Brightside. Fachlicher Fortschritt liegt nur vor, wenn mindestens eine Stem-Variante bei mindestens zwei Songs gleichzeitig mindestens 3/5 Wiedererkennbarkeit, mindestens 3/5 Klang und grundsätzliche Quiztauglichkeit erreicht.

Falls das nicht erreicht wird, gilt:

> Der vollautomatische Weg von beliebigem Popsong zu wiedererkennbarem Chiptune-Cover erreicht mit der getesteten Architektur nicht die erforderliche Qualität.

Dann werden keine weiteren Modelle oder umfangreichen Optimierungen automatisch integriert. MIDI-Upload, manuelle Melodiespur, halbautomatische Notenkorrektur, ein spezialisierter externer Dienst oder der Verzicht auf die Funktion bleiben lediglich dokumentierte Alternativen.

## Vorläufige Empfehlung

Technisch ist 3C.4 reproduzierbar ausführbar. Wegen etwa 1,25 GiB gemessenem Separator-RSS, rund 818 MiB Demucs-Runtime plus Modell und noch ungeklärter realer Wiedererkennbarkeit ist keine produktive Integration zu empfehlen. Nächster und einziger vorgesehener Schritt sind die drei manuellen Vergleichstests gemäß `MANUAL_TEST_TEMPLATE.md`.
