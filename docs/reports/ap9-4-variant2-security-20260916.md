# AP9.4 Variante 2 – adversarial Security Review

16.09.2026. Architektur vom Betreiber freigegeben; lokale Prüfungen nach minimaler
Verschärfung grün. **STOP vor Main-Integration und Provideraktivierung.**

> Vercel authentifiziert den erlaubten GitHub-Zugangsweg.
> Die Bridge autorisiert anhand des verifizierten GitHub-OIDC-JWTs die konkrete
> Backup- bzw. Restoreoperation.

Eine gemeinsame Trusted Source ist unter dem neuen Vertrag beabsichtigt. Fehlende
Environment-/ID-Prüfung bei Vercel ist kein unbekannter Restbefund. Die numerischen
IDs, exakten Subjects und alle übrigen Vertragsclaims werden in der Bridge geprüft.
Keine Identitätsübernahme aus Requestbody oder frei gesetztem Rollenheader.

## Befund und minimaler Fix

Main-Basis e85b2b2fa179862e6b7884c591d8212447b444ba akzeptierte zusätzlich zu den
gemessenen Subjects ein alternatives ID-basiertes Subjectformat. Der neue genaue
Vertrag erlaubt nur die beiden gemessenen Strings. Ein neu hinzugefügter Negativtest
scheiterte vor dem Fix mit Missing expected rejection. Nach dem Fix wird die Variante
abgewiesen. Kein nachgewiesener Fremdzugriff bei korrekter bisheriger Konfiguration.

Zusätzlich waren die ID-Pins nur konfigurationsgebunden: mit falsch gesetzten Pins
wäre ein entsprechend signierter Token akzeptierbar. Feste Codekonstanten 1253336192
und 288915542 müssen nun sowohl mit der Konfiguration als auch mit dem JWT übereinstimmen.
Eine spätere Änderung erfordert Code-Review statt allein einer Environmentänderung.
Fehlende/falsche Konfiguration blockiert. Keine Bibliotheks-, App- oder Workflowänderung.

## Angriffsmatrix

JWT-Tests verwenden echte RSA-Signaturen und JOSE-Verifikation mit lokalen Testschlüsseln.
Die HTTP-Matrix erreicht dieselbe Handler-/Identitäts-/Autorisierungskette wie die API;
Produktiv wird ausschließlich GitHubs festes JWKS verwendet. Ungültige Fälle 1–26
erreichen keinen Blob-Provider. Lokale Signaturen sind kein echter GitHub-Provider-Nachweis.

| Fälle aus Auftrag | Ergebnis / Nachweis |
|---|---|
| 1–4 Repository, gleichnamiges Repo fremder Owner, IDs | HTTP 403, keine Provideraufrufe |
| 5–7 Branch, Workflow/fremder Workflow | HTTP 403, auch bei korrekter Audience |
| 8–11 Audience, Issuer, Ablauf, manipulierte Signatur | HTTP 403 nach JOSE-Prüfung |
| 12–13 Environment fehlt/anderer Wert | HTTP 403 |
| 14–16 Backup→Restore, Delete, Overwriteflag | HTTP 403; bestehendes Objekt verweigert zusätzlichen PUT-Grant |
| 17–19 Restore→Upload/Delete/neuer Pfad | HTTP 403; fehlendes Objekt erlaubt nur Existenzprüfung, keinen Grant |
| 20–22 sub manipuliert/Widerspruch/Requestrolle | HTTP 403; zusätzliche Rollenfelder nicht erlaubt |
| 23–26 Traversal, fremder Runpfad, Store, Übergröße | HTTP 403 |
| 27 Signed-URL-Ablauf | Runner verweigert abgelaufenen Grant; Providermodell verweigert URL nach Ablauf |
| 28 URL-Verwendung außerhalb Vertrag | Providermodell verweigert PUT-Replay/Overwrite, DELETE/PUT mit GET-Grant; SDK-Optionen binden Operation/Pfad/Größe/TTL |
| 29 Log-/Fehlerexfiltration | Synthetischer JWT und Secret-URL in Providerfehler injiziert: nur fester Fehlercode; keine console-Ausgabe |

GET innerhalb seiner TTL ist bewusst wiederverwendbar, kein Einmal-URL-Versprechen.
Vercels echte Durchsetzung von Signed-URL-Ablauf, Signatur, Methodenwechsel,
Pfadbindung, Größe und Overwrite muss nach Einrichtung mit synthetischen Daten geprüft
werden. Lokale Modelltests ersetzen diese noch ausstehende Providerabnahme nicht.
Plattformlogs und Deployment Protection werden dort ebenfalls kontrolliert.

## Audience ist keine Rolle

Ein Job mit id-token:write kann eine eigene Audience anfordern, auch unsere bekannte
Audience: [GitHub OIDC](https://docs.github.com/en/actions/reference/security/oidc#customizing-the-audience-value).
Dies ändert nicht die von GitHub signierten Repository-/Workflow-/Environmentclaims.
Test 07 verwendet deshalb die richtige Audience mit einem anderen Workflow und muss
scheitern. Ein legitimer Backup-JWT mit richtiger Audience erhält keine Restore-Rechte.
Das Reviewer-Gate bleibt für operations-restore bestehen. Schutz von main/Workflow
und Environmentkonfiguration gehört weiterhin zum Vertrauensmodell; gegen einen
berechtigt bösartig geänderten zugelassenen Workflow ersetzt OIDC kein Code-Review.

## Tests und Grenzen

- 66/66 lokale Tests (einschließlich Untertests): vollständige bisherige Operations-,
  Deployment-Scope- und CI-Regression sowie erweiterte Bridge-Angriffsmatrix.
- Root-Typecheck und separater Bridge-Typecheck bestanden.
- ESLint aller geänderten TS-Dateien, --max-warnings=0, bestanden.
- Kein Productionzugriff, keine Providerregel, kein Backup/Restore, keine Secretänderung.
- Nur contract.ts, identity.ts, handler.ts, bridge.test.ts und Dokumentation geändert.

## Manuelles Gate

Zuerst den minimalen Fix regulär nach main integrieren (gesonderte Betreiberfreigabe),
CI abwarten und ausschließlich Operations mit diesem Stand deployen. Danach genau
eine Trusted Source gemäß [Runbook](../operations/ap94-oidc-bridge-setup.md).
Die Aktivierung wird in diesem Review noch nicht freigegeben.

Deployment Protection direkt gelesen: Vercel Authentication an, Standard Protection;
dessen UI sagt: außer Production Custom Domains. All Deployments (Protect all domains)
ist im Menü verfügbar, aber wurde nicht ausgewählt. Für eindeutige Abdeckung aller
Operations-URLs manuell All Deployments konfigurieren. Keine App-Schutzeinstellungen ändern.
Nur Standard-Selbstzugriff des Projekts sichtbar, keine externe Trusted Source.

R03 geschlossen: Nein. R04 neuer Operationsnachweis: offen.
AP9.4 vollständig abgenommen: Nein.
