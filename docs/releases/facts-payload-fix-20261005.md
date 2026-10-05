# Fakten: serverseitiger Teilnehmer-Payload-Fix

Der vollständige Editorial-Template-Config wurde zusätzlich zum reduzierten Antwortvertrag an Teilnehmer ausgeliefert. Die gemeinsame Serverantwort projiziert jetzt ausschließlich freigegebene Faktenhinweise. Sollantworten, Varianten, Wahr/Falsch-Erklärungen, Schätzwerte und beliebige zusätzliche Config-Felder bleiben intern. Lösungsmaterial im selben Serializer erhält eine explizite Medien-Allowlist. Eine kanonische Lösung wird ausschließlich für einen nicht versteckten REVEALED-Run innerhalb der aktuellen Blockfreigabe geliefert; CLOSED, Bewertung und Finalisierung reichen nicht aus.

Die vorhandene Sitzungsauflösung, Draft-/Submission-Persistenz und automatische/manuelle Bewertung bleiben unverändert. Direkte Server-Action-Anfragen nach Präsentationsumfang und der authentifizierte Live-Snapshot benötigen die bestehende Quizberechtigung. Keine Migration, kein Import und keine neue Dependency.

Regressionen führen die tatsächliche getQuizAntwortStatus-Funktion sowie beide Teilnehmer-HTTP-Zweige aus. Geprüft werden drei Faktenformate, Wahr/Falsch, Auswahl-Schlüssel, eigene Antworten, fremde Teamabgrenzung, noch nicht freigegebene Fragen, Auflösung, Reset-Epochen, Reload/Reconnect, unbekannte Zustände und verweigerte Moderation. 21 der 24 Transportregressionen erkennen den bisherigen Fehler. Zusammen mit den Projektionstests sind 53 neue Tests grün.

Typecheck und striktes Lint der geänderten Dateien bestanden. Windows meldet weiterhin den bereits dokumentierten CRLF-Hashunterschied des unveränderten Importplans; Linux-CI ist das verbindliche vollständige Gate. Der lokale Production-Build bestand nach einer isolierten Installation des unveränderten Lockfiles.

Die neun vorhandenen Preview- und 60 Production-Fragen werden anhand des bestehenden PR88-Manifests erneut abgenommen. Neue klar markierte Quizkopien/Teilnahmen verändern keine Inhaltsfragen; frühere Durchläufe bleiben erhalten. Private Zugangsdaten werden nicht in Nachweisen gespeichert. Vollständige Deployment-, HTTP-, Inhalts-, CI- und Recovery-Nachweise werden im bestehenden lokalen night-pr88/payload-fix-Arbeitsbereich geführt. Release bleibt bis zur bestandenen Preview-Abnahme gesperrt.

Bekannte Hydrationmeldung und unabhängige Dependency-/Lint-Schulden bleiben außerhalb des Fixes. Flaggen/Länderumrisse sind unverändert.
