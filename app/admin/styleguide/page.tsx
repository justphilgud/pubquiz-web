"use client";

import { useState } from "react";
import {
  Accordion,
  Alert,
  AnswerCard,
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  Container,
  Countdown,
  DataTable,
  Divider,
  EmptyState,
  FileUpload,
  FormField,
  FormSection,
  ImageViewer,
  Inline,
  Input,
  Label,
  MediaPreview,
  Modal,
  PageHeader,
  Pagination,
  ProgressBar,
  QuestionCard,
  RadioGroup,
  ScoreCard,
  SearchInput,
  Select,
  Spinner,
  Stack,
  Switch,
  Tabs,
  TeamCard,
  Textarea,
  Tooltip,
} from "@/components/ui";

type ExampleRow = {
  name: string;
  category: string;
  status: string;
};

const exampleRows: ExampleRow[] = [
  { name: "Formel-1-Weltmeister", category: "Sport", status: "Freigegeben" },
  { name: "Musik rückwärts", category: "Musik", status: "Entwurf" },
  { name: "Alltagswissen", category: "Alltag", status: "Prüfen" },
];

export default function StyleguidePage() {
  const [switchChecked, setSwitchChecked] = useState(true);
  const [radioValue, setRadioValue] = useState("multiple-choice");
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <Container size="xl">
        <Stack gap="xl">
          <PageHeader
            title="Styleguide"
            subtitle="Interne UI-Bibliothek und Komponentenübersicht für PubQuiz."
            actions={
              <Inline>
                <a
                  href="https://heroicons.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-blue-700 hover:underline"
                >
                  Heroicons öffnen
                </a>
              </Inline>
            }
          />

          <Alert title="Ziel dieser Seite" variant="info">
            Diese Seite zeigt die gemeinsamen UI-Bausteine live. Neue Seiten
            sollten möglichst diese Komponenten verwenden, damit Adminbereich,
            Fragenanlage, Antwortformular, Moderation und Präsentation
            konsistent bleiben.
          </Alert>

          <FormSection
            title="1. Design Tokens"
            description="Grundregeln für Farben, Abstände, Rundungen und Schatten."
          >
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <div className="h-12 rounded-lg bg-blue-600" />
                <p className="mt-2 text-sm font-medium">Primary</p>
                <p className="text-xs text-gray-500">blue-600</p>
              </Card>
              <Card>
                <div className="h-12 rounded-lg bg-green-600" />
                <p className="mt-2 text-sm font-medium">Success</p>
                <p className="text-xs text-gray-500">green-600</p>
              </Card>
              <Card>
                <div className="h-12 rounded-lg bg-yellow-400" />
                <p className="mt-2 text-sm font-medium">Warning</p>
                <p className="text-xs text-gray-500">yellow-400</p>
              </Card>
              <Card>
                <div className="h-12 rounded-lg bg-red-600" />
                <p className="mt-2 text-sm font-medium">Danger</p>
                <p className="text-xs text-gray-500">red-600</p>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <h3 className="font-semibold">Rundungen</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Standard: <code>rounded-lg</code> für Inputs und Buttons,{" "}
                  <code>rounded-xl</code> für Cards.
                </p>
              </Card>
              <Card>
                <h3 className="font-semibold">Abstände</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Standard: <code>gap-4</code>, <code>space-y-4</code>,{" "}
                  <code>p-4</code>.
                </p>
              </Card>
              <Card>
                <h3 className="font-semibold">Schatten</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Zurückhaltend einsetzen: bevorzugt <code>shadow-sm</code>.
                </p>
              </Card>
            </div>
          </FormSection>

          <FormSection
            title="2. Buttons"
            description="Standardaktionen, Nebenaktionen und gefährliche Aktionen."
          >
            <Inline>
              <Button>Speichern</Button>
              <Button variant="secondary">Abbrechen</Button>
              <Button variant="danger">Löschen</Button>
              <Button variant="ghost">Nur Text</Button>
              <Button disabled>Deaktiviert</Button>
            </Inline>
          </FormSection>

          <FormSection
            title="3. Formulare"
            description="Bausteine für Adminseiten und Fragenanlage."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label="Fragentitel"
                hint="Kurz und eindeutig formulieren."
              >
                <Input placeholder="Wer gewann die meisten Formel-1-WM-Titel?" />
              </FormField>

              <FormField label="Kategorie">
                <Select defaultValue="">
                  <option value="" disabled>
                    Kategorie wählen
                  </option>
                  <option>Sport</option>
                  <option>Musik</option>
                  <option>Alltag</option>
                  <option>Geschichte</option>
                </Select>
              </FormField>
            </div>

            <FormField
              label="Moderationsnotiz"
              hint="Nur für die Moderation sichtbar."
            >
              <Textarea
                placeholder="Hinweise für die Auflösungsrunde..."
                rows={4}
              />
            </FormField>

            <div className="grid gap-6 md:grid-cols-2">
              <Stack>
                <Label>Checkbox</Label>
                <Checkbox
                  label="Frage ist noch nicht fertig"
                  hint="Wird im Adminbereich als Entwurf markiert."
                />
              </Stack>

              <Stack>
                <Label>Switch</Label>
                <Switch
                  checked={switchChecked}
                  onCheckedChange={setSwitchChecked}
                  label="Antworten zufällig sortieren"
                  hint="Pro Quiz einmal mischen und danach konstant halten."
                />
              </Stack>
            </div>

            <FormField label="Antworttyp">
              <RadioGroup
                name="answer-type"
                value={radioValue}
                onChange={setRadioValue}
                options={[
                  {
                    value: "multiple-choice",
                    label: "Multiple Choice",
                    hint: "Antwortoptionen werden angezeigt.",
                  },
                  {
                    value: "open",
                    label: "Offene Antwort",
                    hint: "Teams geben Freitext ein.",
                  },
                  {
                    value: "multi-field",
                    label: "Mehrere Antwortfelder",
                    hint: "Zum Beispiel Interpret und Titel.",
                  },
                ]}
              />
            </FormField>

            <FileUpload
              label="Medium hochladen"
              description="Bild, Audio oder Video für Frage oder Antwort auswählen."
            />
          </FormSection>

          <FormSection
            title="4. Layout"
            description="Container, Stack, Inline, Divider, Accordion und Tabs."
          >
            <Stack>
              <Inline>
                <Badge>Inline</Badge>
                <Badge variant="success">flex-wrap</Badge>
                <Badge variant="warning">gap-3</Badge>
              </Inline>

              <Divider label="Accordion" />

              <Accordion
                items={[
                  {
                    id: "admin",
                    title: "Adminbereich",
                    content: "Für Quizverwaltung, Fragenanlage und Auswertung.",
                  },
                  {
                    id: "presentation",
                    title: "Präsentation",
                    content:
                      "Für Beamer, Fullscreen und visuelle Quizdarstellung.",
                  },
                  {
                    id: "moderation",
                    title: "Moderation",
                    content:
                      "Für Steuerung, Timer, Notizen und nächste Slides.",
                  },
                ]}
              />

              <Tabs
                items={[
                  {
                    id: "frage",
                    label: "Frage",
                    content: (
                      <p className="text-sm text-gray-600">
                        Hier steht die eigentliche Frage.
                      </p>
                    ),
                  },
                  {
                    id: "antworten",
                    label: "Antworten",
                    content: (
                      <p className="text-sm text-gray-600">
                        Hier stehen Antwortoptionen und Zusatzinfos.
                      </p>
                    ),
                  },
                  {
                    id: "medien",
                    label: "Medien",
                    content: (
                      <p className="text-sm text-gray-600">
                        Hier werden Bilder, Audio und Video gepflegt.
                      </p>
                    ),
                  },
                ]}
              />
            </Stack>
          </FormSection>

          <FormSection
            title="5. Feedback"
            description="Status, Hinweise, Ladezustände und Bestätigungen."
          >
            <Inline>
              <Badge>Entwurf</Badge>
              <Badge variant="success">Freigegeben</Badge>
              <Badge variant="warning">Prüfen</Badge>
              <Badge variant="danger">Veraltet</Badge>
            </Inline>

            <div className="grid gap-4 md:grid-cols-2">
              <Alert variant="success" title="Gespeichert">
                Die Frage wurde erfolgreich aktualisiert.
              </Alert>
              <Alert variant="warning" title="Achtung">
                Für diese Frage fehlt noch eine Quelle.
              </Alert>
              <Alert variant="danger" title="Fehler">
                Die Änderung konnte nicht gespeichert werden.
              </Alert>
              <Alert variant="info" title="Info">
                Diese Frage wird aktuell noch nicht im Quiz verwendet.
              </Alert>
            </div>

            <ProgressBar label="Importfortschritt" value={68} />
            <Spinner label="Quizdaten werden geladen..." />

            <Inline>
              <Tooltip content="Das ist ein einfacher CSS-Tooltip.">
                <Button variant="secondary">Tooltip testen</Button>
              </Tooltip>

              <Button onClick={() => setModalOpen(true)}>Modal öffnen</Button>
              <Button variant="danger" onClick={() => setConfirmOpen(true)}>
                ConfirmDialog öffnen
              </Button>
            </Inline>
          </FormSection>

          <FormSection
            title="6. Daten"
            description="Suche, Tabellen und Pagination."
          >
            <SearchInput placeholder="Fragen durchsuchen..." />

            <DataTable
              rows={exampleRows}
              columns={[
                {
                  key: "name",
                  header: "Frage",
                  render: (row) => row.name,
                },
                {
                  key: "category",
                  header: "Kategorie",
                  render: (row) => row.category,
                },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => <Badge>{row.status}</Badge>,
                },
              ]}
            />

            <Pagination page={1} pageCount={5} />
          </FormSection>

          <FormSection
            title="7. Quiz-Komponenten"
            description="Spezifische Komponenten für PubQuiz-Ansichten."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <QuestionCard
                title="Wer gewann die meisten Formel-1-WM-Titel?"
                category="Sport"
                status="Freigegeben"
              >
                Beispiel für eine Frage mit Kategorie, Status und Beschreibung.
              </QuestionCard>

              <AnswerCard label="Michael Schumacher" correct>
                7 Weltmeistertitel.
              </AnswerCard>

              <AnswerCard label="Sebastian Vettel">
                4 Weltmeistertitel.
              </AnswerCard>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <TeamCard name="Quiztopher Columbus" score={42} status="Online" />
              <ScoreCard
                label="Antworten"
                value="18 / 24"
                hint="Teams haben geantwortet"
              />
              <Countdown seconds={125} />
            </div>
          </FormSection>

          <FormSection
            title="8. Medien"
            description="Vorschau und Player für Bilder, Audio und Video."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <MediaPreview title="fragebild.jpg" type="Bild" />
              <MediaPreview title="intro.mp3" type="Audio">
                Audio-Platzhalter
              </MediaPreview>
              <MediaPreview title="startsequenz.mp4" type="Video">
                Video-Platzhalter
              </MediaPreview>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ImageViewer
                src="https://placehold.co/800x450?text=Quiz+Bild"
                alt="Platzhalterbild für Quiz"
              />
              <Stack>
                <MediaPreview title="Audioplayer Beispiel" type="Audio">
                  Kein Audio hinterlegt
                </MediaPreview>

                <MediaPreview title="Videoplayer Beispiel" type="Video">
                  Kein Video hinterlegt
                </MediaPreview>
              </Stack>
            </div>
          </FormSection>

          <FormSection title="9. Empty States und Ressourcen">
            <EmptyState
              title="Noch keine Fragen vorhanden"
              description="Sobald du Fragen anlegst, erscheinen sie hier als Liste oder Kartenansicht."
              action={<Button>Erste Frage anlegen</Button>}
            />

            <Card>
              <h3 className="font-semibold">Ressourcen</h3>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-600">
                <li>
                  <a
                    href="https://heroicons.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-700 hover:underline"
                  >
                    Heroicons
                  </a>{" "}
                  für Icons.
                </li>
                <li>
                  Tailwind-Klassen möglichst konsistent und wiederverwendbar
                  halten.
                </li>
                <li>
                  Neue UI-Elemente zuerst hier im Styleguide sichtbar machen.
                </li>
              </ul>
            </Card>
          </FormSection>
        </Stack>
      </Container>

      <Modal
        open={modalOpen}
        title="Beispiel-Modal"
        onClose={() => setModalOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={() => setModalOpen(false)}>Speichern</Button>
          </div>
        }
      >
        <p className="text-sm text-gray-600">
          Dieses Modal kannst du später für Bestätigungen, Medienauswahl oder
          Bearbeitungsdialoge verwenden.
        </p>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="Aktion bestätigen"
        danger
        confirmLabel="Ja, löschen"
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => setConfirmOpen(false)}
      >
        <p className="text-sm text-gray-600">
          Diese Komponente eignet sich für riskante Aktionen wie Löschen, Quiz
          zurücksetzen oder Quiz beenden.
        </p>
      </ConfirmDialog>
    </main>
  );
}
