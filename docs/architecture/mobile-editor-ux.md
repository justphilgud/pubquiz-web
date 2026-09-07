# Mobile redaktionelle Bedienbarkeit (AP7)

## Verantwortlichkeiten

Fragen-, Story- und Umfrageeditor verwenden `ContentEditorShell` und
`ContentEditorActionBar`. Die Editoren behalten Validierung, Speichern, Pending,
Rollen, Review, Freigabe und Template-Konfiguration. Die gemeinsame Leiste
projiziert ausschließlich die bereits erlaubten Callbacks und Labels.
Es gibt weder eine zweite mobile Editorinstanz noch duplizierte Template-Zustände.

## Aktionshierarchie und Breakpoint

Unter 640 px steht die Workflow-Aktion neben „Weitere Aktionen“. Wenn nur
Entwurfsspeicherung erlaubt ist, ist diese primär. Das aufklappbare Menü enthält
die alternative Speicheraktion, die optionale Spezialfragenvorlage und zuletzt
„Abbrechen“. Keine fachliche Aktion entfällt. Pending deaktiviert sämtliche
Aktionsbuttons einschließlich des Menüs; die vorhandenen Editor-Callbacks
bleiben für den Speicherablauf verantwortlich.

Ab 640 px bleiben Abbrechen, Entwurf und Workflow nebeneinander in der bisherigen
Reihenfolge sichtbar. Die Spezialvorlagenoption steht weiterhin darüber.
Read-only- und archivierte Ansichten behalten ihre bestehenden Regeln.

## Viewport, Scrollen und Safe-Area

Die Shell verwendet `min-height: 100dvh`. Ein gemeinsamer Observer liest bei
`visualViewport.resize`, `visualViewport.scroll` und `window.resize` ausschließlich
Viewport-Höhe und oberen Versatz. Er setzt CSS-Variablen für die verbleibende Höhe
und den unteren Versatz. Ohne VisualViewport gilt `window.innerHeight`.
Listener werden beim Unmount entfernt; es gibt keine Geräteerkennung, Timer,
Animationsschleife, Server-Action oder Request für das Layout.

Die mobile Leiste sitzt über dem nicht sichtbaren unteren Viewportbereich.
`env(safe-area-inset-bottom)` schützt ihre Buttons und den unteren Inhaltsabstand.
Die Seite bleibt der Hauptscrollbereich. Das bewusst geöffnete Aktionsmenü und
der Spezialvorlagen-Dialog dürfen bei geringer Höhe begrenzt scrollen.
Formularfelder erhalten Scroll-Abstand zur Leiste; die mobile Schriftgröße von
mindestens 16 px vermeidet den üblichen automatischen Input-Zoom.
Browser-Fokus und bestehende Validierungsnavigation bleiben maßgeblich.

## Warnungen und Accessibility

AP5-Schwellen und harte Inhaltsgrenzen bleiben unverändert. Mobil zeigt ein
nativer Details-Bereich „Präsentationshinweis“ und die aktuelle Zeichenzahl;
aufgeklappt enthält er den vollständigen vorhandenen Hinweis. Desktop zeigt
weiterhin den vollständigen Text. Speicherfehler und Rückmeldungen aus Story
und Poll stehen mobil in der Leiste, damit sie auch am Seitenende auffindbar sind.

Primäraktion, Menü und Menüaktionen besitzen mindestens 44 px Höhe.
Das Menü verwendet `aria-expanded` und `aria-controls`; sichtbarer Tastaturfokus,
Button-Labels, Pending/Disabled und vorhandene Rollenverträge bleiben erhalten.

## Abnahme und Grenzen

Browserabnahme auf Preview mit eigenem Inhalt: neue/bestehende Fragen, Antworten,
Lösung und Spezialfelder, Storytext sowie unterste Polloption; Validierung,
Entwurf und berechtigte Freigabe; 360–390, 430, Zwischenbreite, Desktop und
Landscape. Echte Systemtastaturen sind separat auf Android Chrome und iOS Safari
zu prüfen, wenn das Automationsgerät sie nicht darstellen kann. Reduzierte
Viewport-Höhe und Geometriemessungen sind ergänzende Nachweise, keine Behauptung
einer Hardwareabnahme. Die konkrete Evidenz steht im AP7-Abnahmebericht.

Invarianten: primäre Aktion erreichbar; aktives Feld normal erreichbar; sinnvoller
Arbeitsbereich; keine verlorene Aktion; Spezialvorlage sekundär erreichbar;
unveränderte Rollen und Freigabe; unveränderte AP5-Warnungen; Desktop erhalten;
keine neue Requestschleife; Safe-Area berücksichtigt; Fehler auffindbar.
