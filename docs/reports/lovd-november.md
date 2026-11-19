# LOVD November · AP 1–4

Stand: 19. November 2026. Basis: `origin/main` bei `9766a294`.
AP 5 wurde nicht bearbeitet. Kein Merge und kein Production-Deployment.

## Architektur und Änderungen

Die bestehenden Serveraktionen, Quiz-Locks und Live-Snapshots bleiben die fachliche
Zustandsquelle. `NavigationTransition` verhindert synchron mehrfach gestartete
Befehle. `presentationWindowSync` quittiert gerenderte Zustände zwischen lokalen
Präsentationsfenstern desselben Browserprofils/Ursprungs; es persistiert nichts.
Moderation und öffentlicher Player verwenden weiterhin denselben Renderer.

`PodiumCeremony` kapselt ausschließlich die Darstellung und endliche Animation
neuer Ranggruppen. Die Servernavigation speichert beim Eintritt die Rangliste in
dem additiven Feld `quiz_praesentation_status.podium_snapshot`. Stichentscheide,
Wettbewerbsränge, Antworten, Punkte und bestehende Submission-Regeln bleiben erhalten.
Normale Navigation und Reset entfernen den Snapshot. Sponsorpositionen behalten
ihren bestehenden Vertrag, ausschließlich die Präsentationsposition zu schreiben.

Geänderte Bereiche:

- Moderation: Client, Toolbar, Meme-Review und Vorschaufeld.
- Navigation: synchroner Gate, Renderquittung und Leerfall-Policy.
- Präsentation: gemeinsamer Header, Podiumskomponente und begrenzte Layoutregeln.
- Server/Persistenz: Statusaktionen, Lifecycle-Reset, Snapshotparser, Prisma-Schema
  und additive Migration `20261119120000_podium_snapshot` samt generiertem Client.
- Regressionen und Living Specifications für Lifecycle und Präsentation.

Keine neuen Projektabhängigkeiten. Ein lokaler temporärer ZXing-Decoder wurde
ausschließlich für die Screenshotprüfung verwendet.

## Testumgebung

Separater Worktree `codex/lovd-november`, lokaler Next-Production-Build auf Port 3059.
Leere isolierte Review-Datenbank auf dem geprüften Development-Compute, eigener
Runtime-Benutzer und synthetischer Admin. Synthetisches Quiz 1 mit zwei Blöcken,
zuletzt 21 Fragen, drei voneinander getrennten Teamsitzungen und drei Meme-Fällen.
Die Erweiterung auf 21 Fragen trennt den Leerfall von der tatsächlichen Abstimmung.
Keine bestehenden Quizdaten wurden kopiert oder verändert.

Der erstmalige Datenbank-Bootstrap über die vorhandene Migrationshistorie scheiterte
an einem BOM in `0_init` und anschließend einer bereits in der Baseline enthaltenen
Spalte. Die nachweislich leere Review-Datenbank wurde deshalb aus dem aktuellen
Prisma-Schema initialisiert und baselined. Die historische Migration wurde nicht
geändert. Diese bestehende Bootstrapgrenze ist von der neuen additiven Migration
zu unterscheiden.

## AP 1 · Verzögerung und Überspringschutz

Gemessen wurden Browser-Eingabe, Serverbestätigung und anschließende Renderquittung.
Die bestehende serverseitige Phaseninstrumentierung bleibt erhalten. Eine Quittung
nach zwei Renderframes bestätigt DOM-Sichtbarkeit, keine physische Bildausgabe.

| Fall | Eingabe bis Serverbestätigung | Weitere Wartezeit auf Renderquittung | Ergebnis |
|---|---:|---:|---|
| Kontrollwechsel ohne langen Intro-Vorlauf | 850,5 ms | 1.815,9 ms | genau eine nächste Folie |
| Nach beobachtetem Intro-Vorlauf von 610,4 s; acht erfasste Videowiederholungen | 858,5 ms | 476,7 ms | genau eine nächste Folie |
| Gezielte 5.000-ms-Verzögerung vor Verarbeitung, Doppelklick plus Pfeiltaste während Pending | 5.915,1 ms | 660,2 ms | genau ein Mutationsrequest; beide Fenster und Server auf Folie 4 |

Introbedingung: vorhandenes `/medien/video/intro/intro.mp4`, `loop=true`, am Ende
spielend. Ein früher Hintergrundtab-Versuch wurde nach festgestellter Pause verworfen;
der dokumentierte Durchlauf verwendete ein aktives Präsentationsfenster. Kein
Kausalitätsnachweis zur ursprünglichen Live-Verzögerung. **Der ursprüngliche Hänger
wurde nicht reproduziert; der gezielte Überspringschutz wurde reproduzierbar geprüft.**

Pending ist sofort sichtbar, Navigationstasten sind gesperrt und wiederholte
Eingaben werden verworfen. Nach Abschluss funktioniert ein bewusster nächster Klick.
Serverfehler lassen die bestätigte Position stehen. Bei fehlender Renderquittung
führt „Anzeige erneut prüfen“ denselben Vorgang fort, statt eine weitere Folie
anzufordern. Andere Geräte/Browserprofile quittieren nicht über BroadcastChannel;
die dortige sichtbare Synchronisation wurde nicht nachgewiesen.

## AP 2 · Präsentationsflächen

| Geprüfte CSS-Fläche | Auswahlantworten | Kalender-QR | Podium mit langen Namen |
|---|---|---|---|
| 1366 × 768 | „Marokko“ genau eine Textzeile, 53,18 px; Mehrwortantworten vollständig; kein Überlauf | Code 292 × 292 px, weißer Rand vollständig | drei Ränge vollständig, keine Überlagerung |
| 1920 × 1080 | kurze und lange Antworten vollständig | ganzer Code und Überschrift sichtbar | separat geprüft |
| 1093 × 614 | lange Antworten vollständig, Fitter `fitted` | Code rund 180 × 180 px, vollständig | alle drei langen Namen innerhalb des Podiums |

1093 × 614 ist die emulierte effektive Fläche bei etwa 125 % Skalierung eines
1366 × 768-Bildes. Ein nativer Browserzoom-/physischer Fernsehtest wird damit nicht
behauptet. Ein gesonderter CSS-Zoomversuch war kein geeigneter Ersatz für Browserzoom.

Belege: [Auswahlantworten 1366](assets/lovd-november/answers-1366.png),
[Kalenderfolie 1366](assets/lovd-november/calendar-1366.png).

Aus beiden finalen Kalender-Screenshots (1366 und 1920) dekodiert:
`webcal://127.0.0.1:4321/calendar/public.ics` im Rendererharness. Der zentrale
Kalenderbuilder und der stabile Feedpfad bleiben unverändert. **Kein Handyscan.**

Alle 23 registrierten Fragetemplates wurden mit dem gemeinsamen Header „Frage 17“
gerendert. Der Decktest prüft Pixel an Position 17, identische Nummer nach erneutem
Deckaufbau und „Frage 1“ im nächsten Block. Im echten Quiz zusätzlich Pixel-Frage 17
aufgerufen, zur Auflösung und zurück navigiert: weiterhin „Frage 17“.

## AP 3 · Moderation und Meme

- Regulärer Blockeintritt öffnet den Block; manuelles Schließen und Wiederfreigeben
  funktionieren mit der versetzten, beschrifteten Steuerung. Häufige Medien- und
  Navigationstasten bleiben davor.
- Vorschau zeigt konkrete konfigurierte Titel und verständlichen Typfallback.
  Gerenderte Regression prüft die umsortierte Folge mit „Unsere Regeln“ und
  dem vorhandenen Typnamen „Gewinner“.
- Drei reguläre Meme-Submissions aus getrennten Teamsichten; zwei freigegeben,
  eine ausgeschlossen. Anzeige zählt „Noch 3“ → „Noch 2“ → „Noch 1 Beitrag prüfen“.
- Vorstellung → Übersicht → „Abstimmung starten“ → „Abstimmung schließen“ →
  Finalisierung → Auflösung ohne vorzeitigen regulären Folienwechsel.
- Drei echte Stimmen, eigene Meme-Karte gesperrt; Ergebnis 2:1, drei Stimmen in
  Moderation und Teamansicht, Gewinner +1 Punkt. Zusätzlich Fall ohne Stimmen geprüft.
- Separater Run ohne Einreichungen: explizit „Ohne Meme fortfahren“, keine Stimmen
  oder Punkte. Der zuvor gefundene leere Ergebnisplatz wird nun über die vorhandene
  Skip-Policy übersprungen; nur die eigene unmittelbar folgende Auflösung entfällt.

## AP 4 · Siegerehrung

Im realen Renderer nacheinander 0 → 1 → 2 → 3 enthüllt. Bei den drei Schritten
waren ausschließlich die Ranggruppen 3, dann 2, dann 1 animiert. Vorherige Gruppen
bleiben durch stabile React-Schlüssel stehen. Bei langen Namen liegen alle
Teamflächen auch bei 1093 × 614 innerhalb des Podiums. Die drei leeren Stufen sind
vor dem ersten Klick sichtbar. Reduzierte Bewegung zeigt unmittelbar die Endposition.
Vorhandene Gleichstände bleiben gemeinsame Wettbewerbsranggruppen; fehlende Ränge
werden nicht erfunden. Regressionen prüfen dieses Verhalten und den leeren Beginn.

Die echte Fensterprüfung deckte zusätzlich den historischen Reveal-Mindestwert 1
im Live-State-Adapter auf. Er ist gezielt für Podiumsfolien auf 0 korrigiert und
über Öffnen/Reload abgesichert; andere Folientypen behalten ihren Mindestwert.
[Podium mit langen Namen bei 1920](assets/lovd-november/podium-1920.png).

Auch im echten Quiz geprüft: Folie 56 öffnet mit drei leeren Stufen und null Teams;
Reload erhält diesen Zustand. Der erste Klick enthüllt Platz 3, weitere bewusst
gestartete Klicks Platz 2 und Platz 1, jeweils weiterhin auf Folie 56. Absichtliche
Doppelklicks verändern jeweils nur einen Schritt. Erst der anschließende Klick
öffnet Folie 57 „Finale Tabelle“; `podium_snapshot` ist danach wieder `null`.

Snapshotprüfung: Nach Öffnung wurde der synthetische Live-Punktestand des dritten
Teams von 1 auf 11 geändert. Das öffentliche Podium behielt Platz 3 und 1 Punkt
aus dem gespeicherten 3/2/1-Snapshot. Danach wurden die Testpunkte zurückgestellt.
Zusätzlich wurde eine Renderquittung gezielt unterdrückt: nach Timeout erschien
die Wiederholungsaktion; nach „Anzeige erneut prüfen“ blieb genau ein Team
enthüllt und die Navigation war wieder frei. Kein zusätzliches Reveal wurde geschrieben.

## Prüfungen und offene Grenzen

- Vollständiges `npm test`: 1.901 Tests, 0 Fehler. Anschließend gezielte Regressionen
  für den korrigierten Podium-Nullzustand einschließlich Moderation/Renderer:
  71 Tests, 0 Fehler. Dieser zusätzliche Nullzustandtest ist Teil der normalen Suite.
- Abschließender Mehrfenster-Protokolltest schützt zwei öffentliche Fenster vor
  gegenseitigem Quittungsecho und ignoriert fremde/unvollständige Nachrichten;
  `test:lovd-november` besteht mit 5 Tests ohne Fehler.
- TypeScript, Prisma-Schemavalidierung und Production-Build erfolgreich.
  ESLint aller geänderten Quelldateien ohne Befund.
- Die historischen Eventarten-/Shared-Design-PostgreSQL-Fixtures wenden vor den
  aktuellen Runtime-Actions zusätzlich die neue Snapshotmigration an. Die vorherigen
  historischen Migrations-/Erhaltungsassertions bleiben unverändert. Beide Fixtures
  lokal auf neu erzeugten Datenbanken geprüft: 3 echte PostgreSQL-Tests, 0 Fehler.
  GitHub-CI für den jeweiligen PR-Kopf: [PR #171](https://github.com/justphilgud/pubquiz-web/pull/171).
- Der zunächst fehlgeschlagene unveränderte Importplan-Hash war ein bestehendes
  Windows-CRLF-Checkoutproblem. Kanonische LF-Bytes liefern exakt den erwarteten Hash;
  weder die versionierte Datei noch der Test wurden dafür geändert.
- Kein physischer Fernseher, kein Handyscan, kein Nachweis des ursprünglichen
  Live-Hängers und kein geräteübergreifender Renderack.
- Außerhalb des Auftrags beobachtet und nicht geändert: Die Teamansicht kann nach
  einem Fragewechsel eine alte „Bestätigte Antwort“ als JSON anzeigen. Außerdem
  warnt `pg` vor bereits vorhandenen parallelen Queries innerhalb einer Transaktion
  im Hinblick auf pg 9. Beides ist von den neuen Änderungen zu unterscheiden.
- **Gehostete Preview bereitgestellt:** Nach ausdrücklicher Freigabe wurden die neue
  isolierte Runtime-Datenbank-URL und das neue Auth-Secret ausschließlich für
  `codex/lovd-november` als Preview-Variablen gesetzt. Die bestehende Preview-Trustliste
  und Branchpolicy wurden um genau diesen Branch ergänzt; Production blieb unberührt.
  [Preview](https://pubquiz-b0ova47qr-just-phil-gud.vercel.app), Deployment
  `dpl_2wUC1hXGpDQmLdxM4VnDPyQBLT38`, geprüfte Quellrevision
  `e601dcd5905934d06e9546bc128e367dab97755a`, Status `READY`.
  Die erfolgreiche Push-CI derselben Revision sowie sechs zentrale Preview-Medienkeys
  wurden vom vorhandenen Deploymentskript bestätigt. Push- und PR-CI sind grün.
  Vercel-Anmeldeschutz bleibt aktiv. Nach gesonderter ausdrücklicher Zustimmung
  wurde der vorhandene Automation-Bypass ausschließlich per HTTP-Header für diese
  Browserabnahme verwendet; weder Token noch App-Zugangsdaten sind versioniert.

## Gehostete Browserabnahme · 19. November 2026

Frisches isoliertes Chrome-Profil auf obiger Preview; Anmeldung mit synthetischem
Admin erfolgreich, Moderation und öffentliches Fenster geöffnet. Beide zeigen
die drei synthetischen Teams und denselben Stand. Rücknavigation von Folie 57
auf 56 öffnet drei leere Podiumsstufen. Doppelklick auf Weiter plus ArrowRight
enthüllt genau Platz 3 und bleibt auf Folie 56. Nach Animation und Renderquittung
ist Weiter wieder freigegeben. Zwei weitere bewusst getrennte Klicks enthüllen
Platz 2 und Platz 1, weiterhin auf Folie 56. Lange Namen sind bei 1366 × 768
vollständig sichtbar; kein horizontaler Overflow.
[Gehosteter Screenshot](assets/lovd-november/hosted-podium-1366.png).

Erst der nächste bewusste Klick öffnet die finale Tabelle auf Folie 57; die
anschließende Datenbankprüfung bestätigt `podium_snapshot = null` und den
zugehörigen `FINAL_STANDINGS`-Schlüssel. Keine App-Änderung seit der vollständig
grünen Push-/PR-CI von `e601dcd5`; spätere Commits ergänzen ausschließlich diesen
Abnahmebericht und Screenshot. Gehosteter Smoke-Test bestanden. Die ausführlichen
AP-1–4-Prüfungen oben bleiben lokale Abnahmen mit den ausdrücklich genannten Grenzen.

Lokale Screenshots und ausführliche Messausgaben liegen unter
`.artifacts/lovd-november/` im Auftragsworktree; Zugangsdaten werden nicht versioniert.
