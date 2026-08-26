# Öffentliche Frageneinreichung

Stand: 26. August 2026

## Zweck und Abgrenzung

`/frage-einreichen` ist ein bewusst öffentlicher, anonymer Eingang in den
bestehenden Fragen-Lifecycle. Die Route erzeugt keine zweite Inhaltsdomäne und
keinen Quiz-Antwortdatensatz. Eine erfolgreiche Einreichung wird als normale
`fragen`-Entität mit `review_status = IN_REVIEW` und `freigegeben = false`
gespeichert. Erst der vorhandene interne Review kann sie bearbeiten, freigeben,
ablehnen oder archivieren.

Die öffentliche Route enthält keine interne Navigation. Pflichtfelder sind
Frage und richtige Antwort; Erklärung und HTTP(S)-Quelle sind optional.

## Datenvertrag und Datenschutz

- Fragetext, Lösung, Erklärung und Quelle werden in den bestehenden
  Fragen-/Antworttabellen gespeichert.
- Der Herkunftsmarker sowie der optionale Name und die optionale E-Mail-Adresse
  liegen getrennt in `public_question_submissions`.
- Kontaktangaben werden niemals in Präsentations-, Quiz- oder öffentliche
  Read-Models aufgenommen. Der Editor lädt sie nur für Administratoren.
- Die öffentliche Review-Kennzeichnung funktioniert auch ohne Kontaktangaben.
- Das Löschen der zugehörigen Frage entfernt ausschließlich ihre öffentlichen
  Submission-Metadaten. Die Migration verändert keine bestehenden Fragen.

## Sicherheitsgrenzen

Serverseitig gelten dieselben Längenbegrenzungen wie im Formular. Zusätzlich
werden Quelle und E-Mail validiert, Steuerzeichen abgewiesen und Reacts
standardmäßige Text-Escapes beibehalten. Eingereichtes HTML wird nicht als HTML
gerendert.

Ein verstecktes Honeypot-Feld beantwortet Bot-Einreichungen neutral, ohne einen
Datensatz anzulegen. Das persistente Rate-Limit erlaubt pro gehashtem
Request-Fingerprint höchstens drei erfolgreiche Versuche je UTC-Stundenfenster.
Es speichert weder IP-Adresse noch User-Agent im Klartext. Die Zählung erfolgt
atomisch in einer serialisierbaren Datenbanktransaktion und funktioniert damit
auch über mehrere Server-Instanzen hinweg.

Der Fingerprint wird mit `PUBLIC_QUESTION_RATE_LIMIT_SECRET` gesalzen. Wenn die
Variable nicht gesetzt ist, wird der bereits umgebungsspezifische
`AUTH_SECRET`- beziehungsweise `NEXTAUTH_SECRET`-Wert verwendet. Production und
Preview müssen deshalb weiterhin unterschiedliche, stabile Secrets besitzen.

## Präsentations-Slide

Der feste Outro-Slide `QUESTION_SUBMISSION_QR` verweist immer auf
`<aktuelle-origin>/frage-einreichen`. Er ist standardmäßig deaktiviert und kann
pro Quiz im vorhandenen Outro-Editor aktiviert sowie textlich konfiguriert
werden. Er besitzt weder Kontaktinformationen noch eine automatische
Freigabefunktion. Join- und Kalender-QR bleiben getrennte Flow-Typen.

## Betrieb und Regression

Vor einem Deployment sind die additive Migration, Prisma-Validierung,
TypeScript, ESLint, Production Build und die vollständige Testsuite auszuführen.
Die zentralen Regressionen liegen in:

- `app/frage-einreichen/publicQuestionSubmission.test.ts`
- `app/quiz/flow/quizFlow.test.ts`
- `app/quiz/fixedSlidesPolicy.test.ts`
- `app/rendering/presentation/PresentationSlideRenderer.test.ts`

Die neue Migration darf nur über den normalen Environment-Workflow ausgeführt
werden. Ein Rate-Limit-Abbruch oder ein interner Speicherfehler bleibt eine
kontrollierte Formularmeldung; keine Einreichung darf dadurch automatisch
freigegeben werden.
