# AP2–4 – Webex-Audio-Diagnose

Stand: 2. Oktober 2026

## Ergebnis

Im Anwendungscode ist kein eigener Webex-, Geräte- oder Audio-Routingpfad
vorhanden. Produktive Fragen-Audios, konfigurierte Intro-Audios und der
Startsequenz-Fallback werden im Präsentationsbrowser über dasselbe native
HTML-`audio`-Element in `SynchronizedMedia` wiedergegeben. Laptop 2 übermittelt
nur `play`, `pause`, `restart` und `stop`; die Tonwiedergabe findet auf dem
Präsentations-Laptop statt.

Die Startsequenz hat bei fehlender Konfiguration bewusst die versionierte Datei
`/medien/audio/intro/mexico.mp3` als Fallback. Sie ist im Repository vorhanden.
Der Player verwendet weder `AudioContext` noch `setSinkId`, `captureStream`,
`getDisplayMedia` oder einen Webex-spezifischen Ausgang. Im
Präsentationsmodus ist das Element nicht stumm; lediglich Vorschau-Renderer
bleiben absichtlich stumm. Fehlende Browser-Autoplay-Freigabe wird durch den
vorhandenen Aktivierungsknopf sichtbar und behebbar gemacht.

Damit ist kein reproduzierbarer Produktfehler belegt, der einen Codefix
rechtfertigt. Das optionale AP4-Kriterium bleibt bis zu einem echten
Webex-Gegentest eine externe Betriebsprüfung und blockiert AP2/AP3 nicht.

## Abgrenzung der Hypothesen

Folgende Ursachen sind nach der Codeprüfung ausgeschlossen:

- ein abweichender Audiopfad speziell für die Startsequenz,
- ein hart stummgeschaltetes produktives Audioelement,
- eine im Produkt erzwungene Ausgabegerätewahl,
- eine Übertragung des Audios von Laptop 2 statt vom Präsentations-Laptop.

Folgende Ursachen sind Webex-seitig plausibel, aber ohne den konkreten
Meetingzustand nicht bewiesen:

- Es wurde ein Fenster geteilt, während Webex Computer-Audio nur bei der
  gewählten Bildschirm-/Tab-Freigabe erfasst.
- Bei der Desktop-App war „Computer-Audio einbeziehen“ für die konkrete
  Freigabe nicht aktiv.
- Im Webclient wurde weder „Tab-Audio ebenfalls teilen“ noch „Systemaudio
  ebenfalls teilen“ aktiviert.
- Ein anderes Browserfenster oder ein anderer Tab als die tatsächlich
  geteilte Quelle gab das PubQuiz-Audio wieder.
- Die Freigabe war nicht für Bewegung und Video optimiert. Das ist vor allem
  eine Qualitäts-, nicht zwingend eine Stummschaltungsursache.

Dass YouTube im selben Meeting hörbar war, belegt die grundsätzliche
Webex-Audioübertragung. Es belegt nur dann denselben Capture-Pfad, wenn YouTube
und PubQuiz nachweislich im selben geteilten Tab/Fenster beziehungsweise auf
demselben geteilten Bildschirm mit unveränderter Audiooption liefen.

## Reproduzierbarer Webex-Gegentest

1. Laptop 1 öffnet die produktnahe Preview-Präsentation in Chrome oder Edge.
2. Laptop 2 öffnet ausschließlich die Moderation und steuert die Wiedergabe.
3. Ein drittes Gerät tritt als entfernter Meetingteilnehmer bei und bestätigt
   ausschließlich den tatsächlich empfangenen Ton.
4. In der Webex-Desktop-App wird der komplette Bildschirm oder der konkrete
   Browser geteilt und „Computer-Audio einbeziehen“ aktiviert. Im Webclient
   wird der PubQuiz-Tab oder der Bildschirm gewählt und die angebotene Option
   „Tab-Audio ebenfalls teilen“ beziehungsweise „Systemaudio ebenfalls
   teilen“ aktiviert. Das Webex-Meetingfenster selbst wird nicht als
   Audioquelle gewählt.
5. Die Optimierung für Bewegung und Video wird aktiviert.
6. Nacheinander werden geprüft: eine Frage mit gespeichertem Audio, die
   Startsequenz ohne konfigurierte URL (Fallback) und eine Startsequenz mit
   konfigurierter URL.
7. Laptop 2 prüft je Quelle `play`, `pause`, `restart` und `stop`. Laptop 1
   bestätigt lokale Wiedergabe, das dritte Gerät die entfernte Wiedergabe.
8. Browser, Webex-Client und Version, gewählte Freigabequelle, Audiooption,
   Optimierungsmodus und Resultat je Quelle werden protokolliert. Bei einem
   Fehler wird zusätzlich dieselbe Audiodatei direkt im selben geteilten Tab
   abgespielt. So trennt der Versuch App-Wiedergabe von Webex-Capture.

## Providerquellen

- Cisco Webex, „Share Your Screen or Application in a Meeting“:
  <https://help.webex.com/en-us/article/i62jfl/Webex-Share-Your-Screen-or-Application-in-a-Meeting>
- Cisco Webex, Browser-Freigabe mit Tab-/Systemaudio:
  <https://help.webex.com/en-us/article/njfw8qg>
- Cisco Webex, „Share motion and video content“:
  <https://help.webex.com/en-us/article/nkjrl9eb/Share-motion-and-video-content-in-Webex-Meetings-and-Webex-Webinars>
