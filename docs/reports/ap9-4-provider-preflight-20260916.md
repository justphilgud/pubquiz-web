# AP9.4 Variante 2 – Provider-Preflight und synthetischer Lauf

16.09.2026. Kein Production-Backup, kein Restore, keine Transportfreigabe.

## Tatsächlich geprüft und eingerichtet

- Main `4bb6168ebf49a9ed058d7e45360eb0d42db54de1`.
- Operations-Projekt `pubquiz-backup-operations`, ID `prj_vlY35Hljx5kGaMvEuFixATxn5bzv`.
- All Deployments, Require Log In aktiv; keine Bypass-Secrets/Domainexceptions.
- Genau eine zusätzliche GitHub-Regel: justphilgud/pubquiz-web, main,
  ap94-acceptance.yml, Audience urn:pubquiz:ap94:blob-bridge, nur Operations-Production.
  Gespeicherte Werte im Edit-Dialog gelesen, unverändert geschlossen.
- Projektinterne Regel unverändert. OIDC Team-Issuer https://oidc.vercel.com/just-phil-gud.
- Store pubquiz-backups, store_BVRjATGCRBW0fBeF, Private/FRA1, genau eine Verbindung
  zu Operations-Production. UI bestätigt OIDC. Kein statischer Token in Operations-Env.
- Zunächst kein Production-Deployment und nur BLOB_STORE_ID/BLOB_WEBHOOK_PUBLIC_KEY
  vorhanden. Vier fehlende nicht geheime AP94-Parameter ergänzt: Projekt-ID, feste
  Repository-ID 1253336192, Owner-ID 288915542, Modus synthetic; ausschließlich Production.
- Framework Other, Root scripts/operations/bridge, Node 24. Include files outside
  root war aktiviert und wurde deaktiviert. Befehle aus Bridge-vercel.json.
- Systemvariablen aktiviert. Keine Datenbank-/App-Credentials im Operations-Projekt.
- Ausschließlich Operations aus exakt genanntem Main-SHA deployed: READY, 17 Sekunden.
  https://vercel.com/just-phil-gud/pubquiz-backup-operations/E7eAZPYzo7P88ZytMSJLUrk3i5dZ
- Production-Origin https://pubquiz-backup-operations.vercel.app
- Auch Branchdomain pubquiz-backup-operations-git-main-just-phil-gud.vercel.app und
  Deploymentdomain pubquiz-backup-operations-65339qhnj-just-phil-gud.vercel.app geprüft:
  anonyme POST /api/access ohne Cookies/Token liefern jeweils HTTP 401, kein Redirect.
- In beiden GitHub-Operations-Environments fehlende AP94_BRIDGE_ORIGIN ergänzt und
  AP94_OIDC_TRANSPORT_ACCEPTED=false gesetzt. Bestehende Schalter bleiben false.
- Restore main-only, Required Reviewer aktiv, Administrator-Bypass aus; unverändert.
  Erwarteter Restorehost weiterhin ep-small-poetry-b2jfzg9w.c-6.eu-central-1.aws.neon.tech.
- Alte Blob-Secrets nicht gelöscht/rotiert; OIDC-Workflow referenziert sie nicht.

## Echter Lauf und begrenzte Aussage

Synthetischer Lauf #11 auf Main:
https://github.com/justphilgud/pubquiz-web/actions/runs/35083812674

Backupjob 104753809017 scheiterte nach 50 Sekunden mit SYNTHETIC_NEGATIVE_FAILED;
Restorejob 104754077062 skipped. Der Modus übergibt keine Datenbankcredentials.
Die Negativmatrix läuft vor jedem Upload: kein Upload, kein Readback, keine Signed-URL-
Ablaufprüfung erfolgt. Store nach Lauf sichtbar leer (There are no blobs in this store yet).
Keine Bereinigung erforderlich; Testvertrag sieht auch später keinen Delete vor.

Die vorhandene Fehlermeldung enthält weder Fallnummer noch Status/Antwortkategorie.
Welcher Fall innerhalb der Matrix scheiterte, ist daher nicht belegt. Fehlende Runtime-
Logs allein beweisen keine bestimmte Edge-/Bridge-Ursache. Insbesondere keine Aussage,
dass ein illegitimer Zugriff erfolgreich gewesen wäre. Providerabnahme bleibt rot/offen.

## Minimaler Probe-Fix

Probe prüfte bisher nur HTTP 403. Eine Edge-/Identitätsabweisung konnte damit als
Operationserfolg zählen; andere Antworten waren nicht diagnostizierbar. Neue reine
Testhilfe erwartet für jeden Fall die konkrete Bridge-Kategorie, zusätzlich zu 403.
Falsche Store-/Rollen-/Pfadanfragen: REQUEST_REJECTED; Übergröße: OBJECT_TOO_LARGE;
Overwrite-Grant: OBJECT_EXISTS. IDENTITY_REJECTED zählt nicht als Operationsnachweis.

Bei Abweichung ausschließlich feste Fallnummer, numerischer HTTP-Status, strikt
erlaubte Fehlerkategorie bzw. UNRECOGNIZED. Maximal 1024 Antwortbytes werden gelesen;
freie Texte, Header, URLs, JWTs, Zusatzfelder und Streamfehler werden nicht ausgegeben.
Bridge-Runtime, Claims, Trusted Source, Storeberechtigungen und App unverändert.

Regression: 68/68 erfolgreich (vorher 66/66). Neue Tests prüfen falsche Status-/Bridge-
Kategorien, HTML/freie Fehler, zusätzliche Secretfelder, Übergröße und Streamfehler.
Root-/Bridge-Typechecks und ESLint der drei betroffenen TS-Dateien erfolgreich.
Alle Änderungen liegen unter geprüften Operations-/Berichtspfaden; kein Appdeployment nötig.

## Offene Nachweise und Stopp

Regulären PR-Merge freigeben lassen; danach Main-CI und synthetischen Lauf erneut prüfen.
Keine Regel verbreitern und keine alternativ gültigen Subjects/IDs einführen.
Keine neue Integration ohne ausdrückliche PR-Freigabe. Kein Reviewer-Gate umgehen.

Lokale adversarial Tests verwenden echte JOSE-Signaturprüfung mit Testschlüsseln und
decken falsche Repo-/Branch-/Workflow-/Audience-/Environment-/sub-/ID-Claims ab.
Sie sind kein Nachweis für gültige fremde GitHub-Identitäten am echten Provider.
Live-Claim-Negativmatrix, legitimer Backup-/Restorezugriff, Signed-URL-Upload,
Hash/Größe/Readback, Methoden/Pfade/Overwrite/Ablauf und Provider-Leakageprüfung offen.

R03 geschlossen: Nein. R04: bestehender App-Isolationsnachweis unverändert; Abschluss
einschließlich neuer Operations-Providerabnahme noch Nein. AP9.4 vollständig: Nein.
PubQuiz-Production wurde weder deployed noch beschrieben; keine Rotation.
