# LOVD – moderierter Sponsor-Moment: Abnahme 2026-09-16

## Status

Implementiert und auf Preview bereit. **Vollständige Browserabnahme noch nicht
abgeschlossen**: Full HD, Reduced Motion und gezielte Netzwerkdrosselung/-unterbrechung
sind mit der aktuell verfügbaren Browsersteuerung nicht nachgewiesen. Kein Merge
nach main und kein Production-Deployment.

- Feature: `8f762ea8431e7c5e3ed9ad55931475dae8e8dfb9`
- Visuelle Korrektur / geprüfter Code: `c91636524fb55b8e24925003134199d206d674a6`
- [Preview](https://pubquiz-web-git-codex-lovd-brand-refinement-just-phil-gud.vercel.app)
- [Unveränderliches Deployment](https://pubquiz-de5ipsi27-just-phil-gud.vercel.app)
- Deployment: `dpl_3xg4Bp4MtrnrGMt6JaCjAyJfVRRY`, READY, target Preview.
- [CI erfolgreich](https://github.com/justphilgud/pubquiz-web/actions/runs/35141920497)
- Production-Baseline vor/nach Deployment unverändert:
  `dpl_3Ufmv6QmvYkp712cPjVPXBDJtsN3`.

## Bedienweg

1. Content → Frage erstellen oder bearbeiten → **Weitere Funktionen** öffnen.
2. Unter **Sponsor → Sponsorlogo → Bild auswählen** JPEG, PNG oder WebP bis 10 MB
   hochladen. Die Vorschau erscheint nach dem Upload.
3. **Sponsorzeile** bearbeiten (Default „Präsentiert von“, maximal 80 Zeichen,
   leere Zeile zulässig). Speichern bzw. Speichern und freigeben.
4. Erneutes Bild auswählen ersetzt die Referenz. **Entfernen** entfernt den Sponsor.
5. Die freigegebene Frage regulär einem LOVD-Quiz zuordnen. Vor der Frage entsteht
   automatisch ein Sponsor-Moment. Erst Moderator-**Weiter** öffnet die Frage.

Keine URL-Eingabe und kein Aktivierungsschalter. Keine neue Medienbibliothek:
der bestehende Datei-Upload wird wiederverwendet. Logo und Zeile werden mit der
Frage gespeichert; Klonen übernimmt dieselbe Medienreferenz ohne Medienduplikation.

## Architektur und Sicherheitsvertrag

Der Editor bleibt für Eingabe und bestehenden Upload verantwortlich. Der Deckbau
leitet eine explizite nicht-interaktive Position mit `presentationRole.kind=SPONSOR`
und `sponsor:<assignmentId>` ab. Es gibt keinen separaten redaktionellen Datensatz,
keine Namens-/Text-/Slideindex-Heuristik und keinen STELP-Codepfad.

Der vorhandene serverseitige Navigationspfad validiert Berechtigung, Lifecycle,
Revision und Deck. Eintritt in Sponsor aktualisiert nur Präsentationsposition und
Anzeigezeit. Die normale Interaktionssynchronisation bleibt für den anschließenden
Fragenstart zuständig. Sponsor umgeht ausdrücklich deren schreibende Run-/Block-
Übergänge. Teilnehmer-Read-Models verbergen während Sponsor auch vorherige Fragen.

Vorhandene Deadlines laufen natürlich weiter; sie werden weder pausiert noch
verlängert. Unabhängige Deadlineabläufe sind keine Sponsor-Eintrittsaktion.
Antwortannahme, Finalisierung, Bewertung, Punkte und Pixelregeln bleiben in ihren
bestehenden Diensten. Ein visueller Callback steuert keine fachliche Aktion.

`SponsorMoment` übernimmt nur Darstellung: 400 ms Fade, 700 ms Logoübergang zur
gemessenen Headerposition, contain-Bounding-Boxes und Reduced-Motion-Abzweig.
`sponsorAnimationFrame` rechnet Viewportmessungen in den lokalen Canvasraum um.
Andere Designwelten erhalten weder Sponsorposition noch Sponsoroverlay.

## Reale Preview-Prüfungen

Eigenes Quiz **44: Codex LOVD Sponsor-Abnahme 2026-09-16**, Block 148.
Eigene Fragen 105 (offen, STELP), 106 (Auswahl, geklont) und 107 (Pixel-Testkopie
mit neu hochgeladenem synthetischem Original und regulär erzeugten Pixelstufen).
Keine vorhandene Originalfrage wurde redaktionell verändert.

| Fall | Beobachtung / Ergebnis |
| --- | --- |
| Upload und Vorschau | STELP-JPEG im Sponsorbereich erfolgreich hochgeladen und angezeigt. |
| Medienisolation | Tatsächliche Bildreferenzen unter `vzfnwjccgkzhc9bi.public.blob.vercel-storage.com/preview/question-media/`; Nonprod-Store `store_VzfNwjccgkzhc9bi`. |
| Speicherung | Frage 105 freigegeben, anschließend aus Bibliothek ins Testquiz übernommen. |
| Klonen | Frage 106 über Klonen erzeugt; exakt gleiche STELP-URL und „Präsentiert von“ vorhanden. |
| Sponsorzeile | In Kopie auf „Unterstützt von“ geändert; auf Sponsor und Frage sichtbar. |
| Sponsor bleibt stehen | Über mehrere Minuten bzw. während weiterer Prüfungen unverändert; kein automatischer Wechsel nach drei Sekunden. |
| Teilnehmer während Sponsor | Beide geöffneten Antwortclients zeigen „Nächste Frage gleich …“, keine neue Frage. Zweiter Client auch erst auf Sponsorposition geöffnet. |
| Explizites Weiter | Offene Frage bzw. Auswahlfrage erscheint erst nach Moderationsnavigation auf Präsentation und beiden Antwortclients. |
| Reload | Moderation, Präsentation und Antwortformular tatsächlich neu geladen. Persistierte Sponsorposition und neutraler Zustand bleiben erhalten. Präsentation verlangt reguläre Browseraktivierung. |
| Zurück zur Sponsorposition | Auch nach bereits geöffneter Frage zeigen beide Antwortclients wieder neutralen Zustand. |
| Zweiter Sponsor | Synthetische Partnerlogos über denselben Upload, ohne Code-/Templateänderung. |
| Formate | Quadrat 600×600, hoch 260×1000, breit 1200×240 sowie STELP 1042×652 bei tatsächlich gemessenen 1280×720 visuell geprüft. Transparente Außenränder, kein Beschnitt/Verzerren. |
| Animation | Zwischenzustand und Endposition in skalierter Moderationsvorschau geprüft; siehe Fehlerkorrektur unten. Großes und kleines Logo verwenden dieselbe Referenz. |
| Pixel → Sponsor → Frage | Eigene Pixel-Frage normal geöffnet, unmittelbar Weiter auf Sponsor. Beide Antwortclients neutral. Anschließend Weiter öffnet Auswahlfrage. Keine Sponsor-Countdownsteuerung angeboten. |
| Countdown | Reguläre Pause erreicht; normalen Ein-Minuten-Countdown gestartet. Natürlicher Ablauf bis 00:00, nach Reload weiterhin 00:00 und Block wieder freigebbar. Keine fachliche Deadlineänderung für Tests. |
| Reveal | Reguläre Auflösung der offenen Frage zeigt „Berlin“. Kein Sponsoroverlay auf Auflösung. |
| Entfernen | Bei Frage 106 Logo entfernt und gespeichert. Deck reduziert sich von 22 auf 21 Positionen; Auswahlfrage ohne Sponsorposition und ohne Headerkennzeichnung. |

Die Browserprüfung beobachtet sichtbare Zustände. Die detaillierte Nichtmutation
von Runs, Drafts, Submissions, Pixelstufen, Punkten und Deadlines wird durch den
separaten automatisierten Serveraktionsvertrag abgesichert; sie wurde nicht als
zusätzlicher Datenbank-Vorher/Nachhervergleich im Browserlauf ausgegeben.

Ein anfänglich nach Reload sichtbares „Block freigeben“ normalisiert sich nach
der bestehenden Snapshot-Synchronisierung zu „Block schließen“. Keine dauerhafte
Blockzustandsänderung beobachtet; keine Änderung außerhalb des Sponsor-Scopes.

## Gefundener und korrigierter Fehler

Die erste Browserfassung verwendete Viewportkoordinaten direkt als lokale
Animationskoordinaten. In der skalierten Moderationsvorschau wurde die Skalierung
dadurch doppelt angewandt: Logo kurz an falscher Position/Größe.

Korrektur in `c916365`: Koordinaten und Boxgrößen durch die tatsächliche Skalierung
des Overlay-Containers teilen. Padding bleibt im lokalen CSS-Raum. Regression
prüft Start- und Zielbox für Maßstäbe 1, 2/3 und 0,32. Anschließend neu deployed
und Übergang mit quadratischem, hohem und breitem Logo erneut im Browser geprüft.
Keine Navigations-, Timer- oder Antwortlogik hierfür geändert.

## Automatisierte Prüfungen

- Vollständiges `npm test`: **1.107 bestanden, 0 fehlgeschlagen**
  (400 Pretest + 520 Haupttests + 11 Lesbarkeit + 176 Posttest).
- TypeScript `npm run typecheck`: bestanden.
- ESLint für geänderte Dateien: bestanden.
- Production-Build: erster Featurestand lokal erfolgreich; korrigierter Stand
  in Branch-CI und Vercel-Preview erfolgreich gebaut.
- Sponsor-Serveraktionsregression: Deckvalidierung, Fälschung abweisen,
  ausschließlich drei Präsentationsfelder schreiben, Vorwärts/Rückwärts,
  bestehende Countdownwerte unverändert, keine Interaktionssynchronisation beim
  Sponsor, Teilnehmerausblendung, Idempotenz und normaler Fragenstart genau einmal.
- Vorpositionen: Frage, Auflösung, Pause, Countdown und Pixel-Erklärung. Der
  No-mutation-Pfad hängt nicht vom vorherigen Fragetyp ab; bestehende vollständige
  Pixel-/Deadline-/Finalisierungs-/AP9-Regression bleibt enthalten.
- Metadatenvalidierung, Kopier-Roundtrip, Entfernen und andere Designwelten geschützt.

## Noch offene Browsernachweise

1. **1920×1080**: Der dokumentierte Viewport-Override wird ohne Fehler angenommen,
   aber DOM, Root-Clientgröße und Screenshot bleiben tatsächlich 1280×720. Kein
   Full-HD-Ergebnis behauptet. Geometrie ist automatisiert für skalierte Canvas
   getestet, ersetzt aber die angeforderte reale Full-HD-Sichtprüfung nicht.
2. **Reduced Motion**: Implementierter CSS-/JS-Abzweig ist geprüft, reale
   Browserpräferenz konnte mit den verfügbaren APIs nicht umgestellt werden.
3. **Gezielte langsame Verbindung / Offline-Reconnect**: Reload und späterer
   Clientbeitritt bestanden; keine Netzwerkdrosselungs-/Offline-API verfügbar.
   Diese Fälle sind nicht mit einer bloßen Reload-Prüfung gleichgesetzt.

Nächster Schritt: diese drei Fälle in einem regulär angemeldeten Browser mit
entsprechenden Entwicklertools prüfen. Kein weiterer Produktumbau und keine
Production-Freigabe daraus ableiten. Für die manuellen Prüfungen Frage 105 nutzen:
STELP bleibt dort gepflegt. Frage 106 ist absichtlich der Ohne-Sponsor-Nachweis.

## Logoquelle

Vom Betreiber benannte [Partnerseite](https://www.lindencompany.com/executive-search/),
dort eingebundenes [STELP-Bild](https://www.lindencompany.com/wp-content/uploads/stelp-logo.jpg).
Unverändert hochgeladen; keine Behauptung eines separat bestätigten direkten
STELP-Brandportal-Downloads. Synthetische Partnerlogos sind ausschließlich Testdaten.

## Geänderte Dateien

- Editor/Upload: `app/api/question-media-upload/route.ts`,
  `app/fragen/editor/{types,mediaSlots,mediaSlots.test}.ts`,
  `app/fragen/editor/components/{AdditionalDetailsSection,QuestionEditor,QuestionSponsorSection}.tsx`,
  `app/i18n/messages/de/questionEditor.ts`.
- Deck/Live: `app/quiz/[quizId]/moderation/ModerationClient.tsx`,
  `app/quiz/[quizId]/praesentation/{buildPraesentationSlides,statusActions}.ts`,
  `app/quiz/{actions,quizAnswerLiveState}.ts`, `app/quiz/interaction/interaction.server.ts`.
- Darstellung/Tests: `app/globals.css`,
  `app/rendering/presentation/{PresentationSlideRenderer,SponsorMoment}.tsx`,
  `app/rendering/presentation/{presentationLiveState,presentationQualityFixtures,sponsorAnimationFrame,sponsorNavigation.test}.ts`,
  `app/rendering/presentation/questionSponsor.test.tsx`, `package.json`.
- Dokumentation: `docs/architecture/quiz-lifecycle.md`,
  `docs/design/lovd-brand-refinement.md`, dieser Bericht.
