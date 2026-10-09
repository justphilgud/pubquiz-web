# Variety-Domainfunktion V1

Diese Vorbereitung implementiert ausschließlich eine reine Berechnung in `app/quiz/variety/quizVariety.ts`. Kein Datenbankzugriff, keine Runtime-Kategorisierung, keine generative KI, keine UI und keine Migration. Bestehende Komponenten behalten Laden, Berechtigungen und Darstellung; die Domainfunktion übernimmt Verteilungen, Scores und deterministische Hinweise. Medienrollen werden vor dem Aufruf aufgelöst. Lösungsbilder sind kein visuelles Frageerlebnis.

## Metadaten und spätere Persistenz

Eine Frage besitzt eine primäre Erlebnisfamilie und ein bis zwei explizite Oberkategorien. Die 15 geplanten Oberkategorien sind in der Domain als Vokabular dokumentiert. Bestehende Tags und Motive sind keine Oberkategorien. Mehrfachzuordnungen teilen ein Fragegewicht gleichmäßig, sodass ein Slot insgesamt ein Gewicht behält. Unbekannte Kategorien oder mehr als zwei Zuordnungen gelten als Datenlücke. Keine Bestandsfrage wird automatisch rekategorisiert.

Die spätere additive Persistenz soll das vorhandene Kategorienmodell um eine explizite Rolle für Oberkategorien erweitern, statt eine zweite konkurrierende Taxonomie einzuführen. Namen im vorbereiteten Domainvokabular sind noch keine Datenbank-IDs; ein künftiger Adapter muss die explizit gepflegten Kategorien stabil zuordnen. Fragen, Eventreihen und Quizze bleiben unverändert.

`VarietyConfig` enthält `version: 1`, Modus, ignorierte Kategorien und Themenrahmen. `resolveVarietyConfig` verwendet vollständig den Quiz-Override oder vollständig die aktuelle Eventreihen-Konfiguration. Zurücksetzen entfernt den Override. Kopieren übernimmt einen expliziten Override als unabhängige Kopie; bei geerbter Konfiguration bleibt der Override leer und die Ziel-Eventreihe bestimmt den Standard. Kein Mischen einzelner Felder.

Ein späteres `variety_config_version` beziehungsweise ein historischer Score-Snapshot für abgeschlossene Quizze ist architektonisch durch versionierte Konfiguration und versionierte Berechnung vorbereitet. V1 speichert noch keinen Snapshot: Eine spätere Änderung des Eventreihenstandards kann deshalb historische Berechnungen verändern. Vor UI-Einsatz muss diese Einschränkung sichtbar dokumentiert bleiben.

## Berechnung

Die fünf Basisanteile ergeben 85 Punkte:

| Anteil | Maximum | Berechnung |
| --- | --- | --- |
| Themenbreite | 20 | Vorhandene Kategorien / Zielbreite, gedeckelt und mit Kategorieabdeckung gewichtet |
| Themenbalance | 20 | Normierte Shannon-Entropie, mit Kategorieabdeckung gewichtet |
| Templatebreite | 15 | Kanonische Basistemplates / 10, gedeckelt und mit Templateabdeckung gewichtet |
| Templatebalance | 10 | Normierte Shannon-Entropie, mit Templateabdeckung gewichtet |
| Erlebnisvielfalt | 20 | Mittel aus Breite / 5 und Entropie, mit Erlebnisabdeckung gewichtet |

Zielbreite im STANDARD-Modus ist `min(10, max(1, 15 − gültige ignorierte Kategorien))`. Entropie wird durch `log(max(2, Zielbreite, tatsächlich vorhandene Arten))` normalisiert. Anwesende ignorierte Kategorien zählen weiterhin zur Vielfalt und Konzentration. Ihre Abwesenheit erzeugt keinen fehlenden-Kategorie-Hinweis.

Blockwerte sind die auf 100 normierten fünf Basisanteile und werden separat ausgewiesen. Die restlichen 15 Punkte verbinden den schwächsten Blockwert und die Wechselquote, je zur Hälfte. Monotone Sequenzen über drei Slots senken den Wechselanteil linear; ab zehn gleichen Erlebnisfamilien ist er null. Nur tatsächlich benachbarte Slots desselben Blocks mit bekannter Familie zählen als Übergang. Die Pause zwischen Slot 20 und 21 wird nicht gewertet. Fehlende Slotpositionen werden nicht künstlich verbunden.

Bei mindestens zwei Blöcken mit jeweils mindestens fünf Fragen begrenzt außerdem `schwächster Blockwert + 15` den Gesamtscore. So kann eine rechnerisch breite Gesamtverteilung keinen schlechten Block zu 90/100 aufwerten. Gerundet wird erst die Ausgabe. Alle Komponenten und die angewandte Obergrenze bleiben nachvollziehbar im Resultat.

Legacy-Aliase werden über die vorhandene zentrale Template-Registry kanonisiert. Multiple Choice zählt zum Standard-Basistemplate; dynamische Varianten verwenden das explizite Basistemplate. Unbekannte Templates erhöhen die Vielfalt nicht. Fakten-Jahr, Fakten-Land und Fakten-frei bleiben ohne zusätzliche Frage-Medien TEXT.

## Modi und Datenlücken

STANDARD bewertet breite Themen- und Erlebnisvielfalt. THEMENQUIZ verlangt einen expliziten Kategorien-/Tagrahmen; erlaubte Kategorie oder erlaubter Tag genügt. Themenanteile bewerten dann die überprüfbare Rahmentreue. Unkategorisierte Fragen ohne positiven Tagtreffer gelten als nicht überprüfbar, niemals automatisch als Fremdfrage. Ohne Themenrahmen gibt es keinen Score und die Meldung „Themenquiz unvollständig konfiguriert“. Fehlende allgemeine Themen werden in diesem Modus nicht bemängelt.

DEAKTIVIERT führt keine Analyse aus und liefert ausschließlich „Abwechslungsanalyse deaktiviert“, ohne Score oder Warnungen. Ein leeres Quiz liefert 0 mit „Noch nicht bewertbar“, keine Qualitätsbehauptung. Unter fünf Fragen, kleine Blöcke und fehlende Metadaten führen zum Kennzeichen „vorläufig“. Review-Status beeinflusst die Berechnung nicht; unveröffentlichte Fragen bleiben redaktionell ungeprüft.

## Hinweise und spätere UI

Hinweise werden nach Datenqualität, starker Konzentration, Block-/Dramaturgieproblemen, fehlenden Themen/Erlebnissen und positiven Befunden sortiert. Gleichrangige Codes erhalten eine feste lexikalische Reihenfolge. Die ersten drei stehen in `topHints`, alle weiteren in `hints`. Starke Konzentration beginnt über 25 % Themenanteil, dominante Templates über 50 %. Monotoniehinweise nennen einen tatsächlich vorhandenen Slot. Keine Ersatzfragen werden erzeugt.

Die spätere UI kann kompakte Kartenwerte, Block-Scores, Verteilungen, Abdeckung, Herkunft der Konfiguration und aufklappbare Details aus dem Resultat darstellen. Dieser PR integriert die Funktion noch in keine Production-Seite. Der Vergleich Paule II/Oktober benötigt erst verifizierte Frage-, Lösungs- und Medienmetadaten; synthetische Ergebnisse sind kein realer Quizscore.

## Verifikation

`npm run test:quiz-variety` führt 28 synthetische Tests aus und ist in `npm test` eingebunden. Abgedeckt sind Vielfalt versus Konzentration, monotone Familien, schlechter Block trotz breitem Gesamtquiz, alle Modi, ignorierte Kategorien, Datenlücken, Themenrahmen, Vererbung, Override/Reset/Kopie, Legacy-Aliase, Lösungsbilder, kleine/leere Quizze und deterministische Hinweise. Keine Production-Zugänge erforderlich.
