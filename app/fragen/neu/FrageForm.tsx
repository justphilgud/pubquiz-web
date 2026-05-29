"use client";

import { useEffect, useMemo, useState } from "react";
import { updateFrage } from "../actions";
import { saveFrage } from "./actions";

type Kategorie = {
  fragenkategorie_id: number;
  kategorie: string;
};

type Antworttyp = {
  antworttyp_id: number;
  antworttyp: string;
};

type Medientyp = {
  medientyp_id: number;
  medientyp: string;
};

type FrageVorlage = {
  vorlage_id: number;
  code: string;
  name: string;
  slide_typ: string;
  antwortfelder: {
    vorlage_antwortfeld_id: number;
    label: string;
    sortierung: number;
    ist_pflicht: boolean;
  }[];
};

type OffenesQuiz = {
  quiz_id: number;
  titel: string | null;
  quiz_datum: Date | string | null;
};

type MedienOrdner = {
  bilder: string[];
  audio: string[];
  video: string[];
};

type MediumInput = {
  datei: string;
  medientyp_id: number;
  sortierung: number;
  zielordner?: string;
};

type AntwortInput = {
  antwort: string;
  ist_richtig: boolean;
  antworttyp_id: number;
  medien: MediumInput[];
};

type AntwortfeldInput = {
  label: string;
  sortierung: number;
  ist_pflicht: boolean;
  loesungen: {
    loesung_text: string;
    sortierung: number;
    ist_akzeptiert: boolean;
  }[];
};

type EditFrage = {
  fragen_id: number;
  frage: string;
  quelle: string | null;
  fragen_kategorien: {
    fragenkategorie_id: number;
  }[];
  medien: MediumInput[];
  antworten: AntwortInput[];
} | null;

type AntwortModus = "antwortmoeglichkeiten" | "antwortfelder";

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200";

const buttonSecondaryClass =
  "rounded-xl border border-slate-300 bg-white px-4 py-2 font-medium text-slate-900 shadow-sm transition hover:bg-slate-50 active:scale-[0.99]";

const trashButtonClass =
  "flex h-[50px] w-[50px] items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100 active:scale-[0.99]";

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7h7l2 2h9v10H3z" />
    </svg>
  );
}

export default function FrageForm({
  kategorien,
  antworttypen,
  medientypen,
  frageVorlagen,
  offeneQuizzes = [],
  editFrage,
  onCancelEdit,
}: {
  kategorien: Kategorie[];
  antworttypen: Antworttyp[];
  medientypen: Medientyp[];
  frageVorlagen: FrageVorlage[];
  offeneQuizzes: OffenesQuiz[];
  editFrage?: EditFrage;
  onCancelEdit?: () => void;
}) {
  const standardAntworttyp =
    antworttypen.find((t) => t.antworttyp === "Standard")?.antworttyp_id ??
    antworttypen[0]?.antworttyp_id ??
    1;

  const standardMedientyp =
    medientypen.find((t) => t.medientyp === "Bild")?.medientyp_id ??
    medientypen[0]?.medientyp_id ??
    1;

  const [frage, setFrage] = useState("");
  const [quelle, setQuelle] = useState("");
  const [selectedKategorien, setSelectedKategorien] = useState<number[]>([]);
  const [neueKategorie, setNeueKategorie] = useState("");
  const [neueKategorien, setNeueKategorien] = useState<string[]>([]);
  const [medienZurFrage, setMedienZurFrage] = useState<MediumInput[]>([]);
  const [meldung, setMeldung] = useState("");

  const [selectedVorlageId, setSelectedVorlageId] = useState<number | null>(
    null
  );
  const [antwortModus, setAntwortModus] = useState<AntwortModus>(
    "antwortmoeglichkeiten"
  );
  const [antwortfelder, setAntwortfelder] = useState<AntwortfeldInput[]>([]);
  const [selectedQuizIds, setSelectedQuizIds] = useState<number[]>([]);
  const [quizDropdownOpen, setQuizDropdownOpen] = useState(false);

  const [medienOrdner, setMedienOrdner] = useState<MedienOrdner>({
    bilder: [],
    audio: [],
    video: [],
  });

  const [antworten, setAntworten] = useState<AntwortInput[]>([
    {
      antwort: "",
      ist_richtig: false,
      antworttyp_id: standardAntworttyp,
      medien: [],
    },
    {
      antwort: "",
      ist_richtig: false,
      antworttyp_id: standardAntworttyp,
      medien: [],
    },
  ]);

  const selectedQuizzes = useMemo(
    () =>
      (offeneQuizzes ?? []).filter((quiz) =>
        selectedQuizIds.includes(quiz.quiz_id)
      ),
    [offeneQuizzes, selectedQuizIds]
  );
  const emptyMedium = (sortierung: number): MediumInput => ({
    datei: "",
    medientyp_id: standardMedientyp,
    sortierung,
    zielordner: getDefaultZielordner(standardMedientyp),
  });

  useEffect(() => {
    async function loadMedienOrdner() {
      try {
        const response = await fetch("/api/medien-ordner");
        const data = await response.json();

        setMedienOrdner({
          bilder: Array.isArray(data.bilder) ? data.bilder : [],
          audio: Array.isArray(data.audio) ? data.audio : [],
          video: Array.isArray(data.video) ? data.video : [],
        });
      } catch {
        setMedienOrdner({
          bilder: [],
          audio: [],
          video: [],
        });
      }
    }

    loadMedienOrdner();
  }, []);

  useEffect(() => {
    if (!editFrage) return;

    setFrage(editFrage.frage ?? "");
    setQuelle(editFrage.quelle ?? "");

    setSelectedKategorien(
      editFrage.fragen_kategorien.map((k) => k.fragenkategorie_id)
    );

    setMedienZurFrage(
      (editFrage.medien ?? []).map((medium) => ({
        ...medium,
        zielordner:
          medium.zielordner ?? getDefaultZielordner(medium.medientyp_id),
      }))
    );

    setAntworten(
      editFrage.antworten.length > 0
        ? editFrage.antworten.map((antwort) => ({
          antwort: antwort.antwort ?? "",
          ist_richtig: antwort.ist_richtig ?? false,
          antworttyp_id: antwort.antworttyp_id ?? standardAntworttyp,
          medien: (antwort.medien ?? []).map((medium) => ({
            ...medium,
            zielordner:
              medium.zielordner ?? getDefaultZielordner(medium.medientyp_id),
          })),
        }))
        : [
          {
            antwort: "",
            ist_richtig: false,
            antworttyp_id: standardAntworttyp,
            medien: [],
          },
        ]
    );

    setMeldung(`Frage ${editFrage.fragen_id} wird bearbeitet.`);
  }, [editFrage, standardAntworttyp]);

  function getMedientypName(medientypId: number) {
    return (
      medientypen.find((typ) => typ.medientyp_id === medientypId)?.medientyp ??
      ""
    );
  }

  function getMedienGruppe(medientypId: number): keyof MedienOrdner {
    const medientyp = getMedientypName(medientypId).toLowerCase();

    if (medientyp.includes("audio")) return "audio";
    if (medientyp.includes("video")) return "video";

    return "bilder";
  }

  function getDefaultZielordner(medientypId: number) {
    const gruppe = getMedienGruppe(medientypId);
    const ordner = medienOrdner[gruppe];

    if (ordner.includes("unsortiert")) return `${gruppe}/unsortiert`;
    if (ordner.length > 0) return `${gruppe}/${ordner[0]}`;

    return `${gruppe}/unsortiert`;
  }

  function getDefaultZielordnerForGruppe(gruppe: keyof MedienOrdner) {
    const ordner = medienOrdner[gruppe];

    if (ordner.includes("unsortiert")) return `${gruppe}/unsortiert`;
    if (ordner.length > 0) return `${gruppe}/${ordner[0]}`;

    return `${gruppe}/unsortiert`;
  }

  function getOrdnerOptionen(medientypId: number) {
    const gruppe = getMedienGruppe(medientypId);

    return medienOrdner[gruppe].map((ordner) => ({
      value: `${gruppe}/${ordner}`,
      label: ordner,
    }));
  }

  function getMedienGruppeFromFile(file: File): keyof MedienOrdner {
    const mimeType = file.type.toLowerCase();
    const name = file.name.toLowerCase();

    if (mimeType.startsWith("audio/") || /\.(mp3|wav|ogg|m4a)$/i.test(name)) {
      return "audio";
    }

    if (mimeType.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(name)) {
      return "video";
    }

    if (
      mimeType.startsWith("image/") ||
      /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name)
    ) {
      return "bilder";
    }

    throw new Error("Nicht unterstützter Dateityp.");
  }

  function getMedientypIdForGruppe(gruppe: keyof MedienOrdner) {
    const suchwort =
      gruppe === "audio" ? "audio" : gruppe === "video" ? "video" : "bild";

    return (
      medientypen.find((typ) =>
        typ.medientyp.toLowerCase().includes(suchwort)
      )?.medientyp_id ?? standardMedientyp
    );
  }

  function toggleKategorie(id: number) {
    setSelectedKategorien((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  }

  function toggleQuiz(id: number) {
    setSelectedQuizIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  }

  function updateMedium(
    medien: MediumInput[],
    index: number,
    value: Partial<MediumInput>
  ) {
    return medien.map((medium, i) =>
      i === index ? { ...medium, ...value } : medium
    );
  }

  function removeMedium(medien: MediumInput[], index: number) {
    return medien
      .filter((_, i) => i !== index)
      .map((medium, i) => ({ ...medium, sortierung: i + 1 }));
  }

  function updateAntwort(index: number, value: Partial<AntwortInput>) {
    setAntworten((current) =>
      current.map((antwort, i) =>
        i === index ? { ...antwort, ...value } : antwort
      )
    );
  }

  function addAntwort() {
    setAntworten((current) => [
      ...current,
      {
        antwort: "",
        ist_richtig: false,
        antworttyp_id: standardAntworttyp,
        medien: [],
      },
    ]);
  }

  function removeAntwort(index: number) {
    setAntworten((current) => current.filter((_, i) => i !== index));
  }

  function addNeueKategorie() {
    const name = neueKategorie.trim();
    if (!name) return;

    if (
      neueKategorien.some((kat) => kat.toLowerCase() === name.toLowerCase()) ||
      kategorien.some(
        (kat) => kat.kategorie.toLowerCase() === name.toLowerCase()
      )
    ) {
      setMeldung("Diese Kategorie existiert bereits.");
      return;
    }

    setNeueKategorien((current) => [...current, name]);
    setNeueKategorie("");
  }

  function uebernehmeVorlage(vorlageId: number) {
    setSelectedVorlageId(vorlageId);
    setAntwortModus("antwortfelder");

    const vorlage = frageVorlagen.find((v) => v.vorlage_id === vorlageId);
    if (!vorlage) return;

    setAntwortfelder(
      vorlage.antwortfelder.map((feld, index) => ({
        label: feld.label,
        sortierung: feld.sortierung || index + 1,
        ist_pflicht: feld.ist_pflicht,
        loesungen: [
          {
            loesung_text: "",
            sortierung: 1,
            ist_akzeptiert: true,
          },
        ],
      }))
    );
  }

  function addAntwortfeld() {
    setAntwortModus("antwortfelder");
    setAntwortfelder((current) => [
      ...current,
      {
        label: "",
        sortierung: current.length + 1,
        ist_pflicht: true,
        loesungen: [
          {
            loesung_text: "",
            sortierung: 1,
            ist_akzeptiert: true,
          },
        ],
      },
    ]);
  }

  function removeAntwortfeld(index: number) {
    setAntwortfelder((current) =>
      current
        .filter((_, i) => i !== index)
        .map((feld, i) => ({ ...feld, sortierung: i + 1 }))
    );
  }

  function updateAntwortfeld(
    index: number,
    value: Partial<AntwortfeldInput>
  ) {
    setAntwortfelder((current) =>
      current.map((feld, i) => (i === index ? { ...feld, ...value } : feld))
    );
  }

  function updateAntwortfeldLoesung(feldIndex: number, value: string) {
    setAntwortfelder((current) =>
      current.map((feld, index) => {
        if (index !== feldIndex) return feld;

        const vorhandeneLoesung = feld.loesungen[0] ?? {
          loesung_text: "",
          sortierung: 1,
          ist_akzeptiert: true,
        };

        return {
          ...feld,
          loesungen: [
            {
              ...vorhandeneLoesung,
              loesung_text: value,
              sortierung: 1,
              ist_akzeptiert: true,
            },
          ],
        };
      })
    );
  }

  function renderMedienZeile({
    medium,
    onChange,
    onRemove,
  }: {
    medium: MediumInput;
    onChange: (value: Partial<MediumInput>) => void;
    onRemove: () => void;
  }) {
    const ordnerOptionen = getOrdnerOptionen(medium.medientyp_id);
    const zielordner =
      medium.zielordner ?? getDefaultZielordner(medium.medientyp_id);

    function getFormatHinweis() {
      const gruppe = getMedienGruppe(medium.medientyp_id);

      if (gruppe === "audio") {
        return "Ausgewähltes Format: Audio, z. B. .mp3, .wav oder .m4a";
      }

      if (gruppe === "video") {
        return "Ausgewähltes Format: Video, z. B. .mp4, .webm oder .mov";
      }

      return "Ausgewähltes Format: Bild, z. B. .jpg, .png oder .webp";
    }

    return (
      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(460px,1fr)_190px_64px_50px] md:items-start">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Dateipfad
          </label>

          <div className="flex">
            <input
              value={medium.datei}
              onChange={(e) => onChange({ datei: e.target.value })}
              className="w-full rounded-l-xl border border-r-0 border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              placeholder="z. B. bilder/facemorph/bild.jpg"
            />

            <label
              className="flex h-[50px] w-[56px] shrink-0 cursor-pointer items-center justify-center rounded-r-xl bg-slate-900 text-white shadow-sm transition hover:bg-slate-700 active:scale-[0.99]"
              title="Datei auswählen"
              aria-label="Datei auswählen"
            >
              <FolderIcon />
              <input
                type="file"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  let erkannteGruppe: keyof MedienOrdner;

                  try {
                    erkannteGruppe = getMedienGruppeFromFile(file);
                  } catch {
                    alert(
                      "Dieser Dateityp wird nicht unterstützt. Erlaubt sind Bilder, Audio und Video."
                    );
                    return;
                  }

                  const erkannterMedientypId =
                    getMedientypIdForGruppe(erkannteGruppe);
                  const erkannterZielordner =
                    getDefaultZielordnerForGruppe(erkannteGruppe);

                  onChange({
                    medientyp_id: erkannterMedientypId,
                    zielordner: erkannterZielordner,
                  });

                  const formData = new FormData();
                  formData.append("file", file);
                  formData.append("zielordner", erkannterZielordner);

                  const response = await fetch("/api/upload-medium", {
                    method: "POST",
                    body: formData,
                  });

                  const result = await response.json();

                  if (!result.success || !result.datei) {
                    alert(result.message ?? "Upload fehlgeschlagen.");
                    return;
                  }

                  onChange({
                    datei: result.datei,
                    medientyp_id: erkannterMedientypId,
                    zielordner: erkannterZielordner,
                  });
                }}
              />
            </label>
          </div>

          <p className="mt-1 text-xs text-slate-500">{getFormatHinweis()}</p>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Zielordner
          </label>
          <select
            value={zielordner}
            onChange={(e) => onChange({ zielordner: e.target.value })}
            className={inputClass}
          >
            {ordnerOptionen.length === 0 ? (
              <option value={zielordner}>{zielordner}</option>
            ) : (
              ordnerOptionen.map((ordner) => (
                <option key={ordner.value} value={ordner.value}>
                  {ordner.label}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sort.
          </label>
          <input
            type="number"
            min={1}
            value={medium.sortierung}
            onChange={(e) => onChange({ sortierung: Number(e.target.value) })}
            className={inputClass}
          />
        </div>

        <div className="pt-[26px]">
          <button
            type="button"
            onClick={onRemove}
            className={trashButtonClass}
            title="Entfernen"
            aria-label="Entfernen"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    );
  }

  async function handleSubmit() {
    setMeldung("");

    const aktiveAntwortfelder =
      antwortModus === "antwortfelder"
        ? antwortfelder.map((feld, index) => ({
          ...feld,
          label:
            antwortfelder.length > 1
              ? feld.label.trim()
              : feld.label.trim() || "Antwort",
          sortierung: feld.sortierung || index + 1,
          loesungen: [
            {
              loesung_text: feld.loesungen[0]?.loesung_text.trim() ?? "",
              sortierung: 1,
              ist_akzeptiert: true,
            },
          ],
        }))
        : [];

    if (
      aktiveAntwortfelder.length > 1 &&
      aktiveAntwortfelder.some((feld) => !feld.label.trim())
    ) {
      setMeldung(
        "Bitte gib bei mehreren offenen Antwortfeldern für jedes Feld eine Beschriftung ein."
      );
      return;
    }

    const medienZurFrageOhneUploadMeta = medienZurFrage.map(
      ({ zielordner, ...medium }) => medium
    );

    const antwortenOhneUploadMeta =
      antwortModus === "antwortmoeglichkeiten"
        ? antworten.map((antwort) => ({
          ...antwort,
          medien: antwort.medien.map(({ zielordner, ...medium }) => medium),
        }))
        : [];

    const result = editFrage
      ? await updateFrage({
        fragenId: editFrage.fragen_id,
        frage,
        quelle,
        schwierigkeitslevel: null,
        kategorieIds: selectedKategorien,
        neueKategorien,
        medienZurFrage: medienZurFrageOhneUploadMeta,
        antworten: antwortenOhneUploadMeta,
      })
      : await saveFrage({
        frage,
        quelle,
        kategorien: selectedKategorien,
        neueKategorie: neueKategorien.join(","),
        medienZurFrage: medienZurFrageOhneUploadMeta,
        antworten: antwortenOhneUploadMeta,
        vorlageId: selectedVorlageId,
        antwortfelder: aktiveAntwortfelder,
        quizIds: selectedQuizIds,
      });

    if (!result.success) {
      setMeldung(result.message);
      return;
    }

    setFrage("");
    setQuelle("");
    setSelectedKategorien([]);
    setNeueKategorie("");
    setNeueKategorien([]);
    setMedienZurFrage([]);
    setSelectedVorlageId(null);
    setAntwortModus("antwortmoeglichkeiten");
    setAntwortfelder([]);
    setSelectedQuizIds([]);
    setAntworten([
      {
        antwort: "",
        ist_richtig: false,
        antworttyp_id: standardAntworttyp,
        medien: [],
      },
      {
        antwort: "",
        ist_richtig: false,
        antworttyp_id: standardAntworttyp,
        medien: [],
      },
    ]);

    setMeldung(
      editFrage
        ? "Frage wurde aktualisiert."
        : "Frage wurde gespeichert. Du kannst die nächste Frage eintragen."
    );

    if (editFrage && onCancelEdit) onCancelEdit();
  }

  return (
    <form action={handleSubmit} className="space-y-6 text-slate-900">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-5">
          <h2 className="text-xl font-semibold">Frage</h2>
          <p className="mt-1 text-sm text-slate-500">
            Lege den Fragetext und optionale Metadaten fest.
          </p>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Frage:
          </span>
          <textarea
            value={frage}
            onChange={(e) => setFrage(e.target.value)}
            className={`${inputClass} min-h-32 resize-y`}
            placeholder="Frage eingeben..."
          />
        </label>

        <label className="mt-4 block">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Quelle:
          </span>
          <input
            value={quelle}
            onChange={(e) => setQuelle(e.target.value)}
            className={inputClass}
            placeholder="z. B. Musikrunde"
          />
        </label>
      </section>

      {!editFrage && offeneQuizzes.length > 0 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5">
            <h2 className="text-xl font-semibold">
              Direkt zu Quiz hinzufügen
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Optional: Die neue Frage wird automatisch ans Ende der gewählten
              Quiz eingefügt.
            </p>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setQuizDropdownOpen((current) => !current)}
              className="flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-4 py-3 text-left font-medium shadow-sm hover:bg-slate-50"
            >
              <span>
                {selectedQuizIds.length === 0
                  ? "Quiz auswählen"
                  : `${selectedQuizIds.length} Quiz ausgewählt`}
              </span>
              <span>▾</span>
            </button>

            {quizDropdownOpen && (
              <div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                {offeneQuizzes.map((quiz) => {
                  const selected = selectedQuizIds.includes(quiz.quiz_id);

                  return (
                    <label
                      key={quiz.quiz_id}
                      className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleQuiz(quiz.quiz_id)}
                        className="h-5 w-5 accent-slate-900"
                      />
                      <div>
                        <div className="font-semibold text-slate-900">
                          {quiz.titel || `Quiz ${quiz.quiz_id}`}
                        </div>
                        <div className="text-sm text-slate-500">
                          {quiz.quiz_datum
                            ? new Date(quiz.quiz_datum).toLocaleDateString(
                              "de-DE"
                            )
                            : "Ohne Datum"}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {selectedQuizzes.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedQuizzes.map((quiz) => (
                <button
                  type="button"
                  key={quiz.quiz_id}
                  onClick={() => toggleQuiz(quiz.quiz_id)}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                  title="Auswahl entfernen"
                >
                  {quiz.titel || `Quiz ${quiz.quiz_id}`} ×
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Medien zur Frage</h2>
            <p className="mt-1 text-sm text-slate-500">
              Bilder, Audio oder Video zur Frage hinterlegen.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setMedienZurFrage((current) => [
                ...current,
                emptyMedium(current.length + 1),
              ])
            }
            className={buttonSecondaryClass}
          >
            + Medium hinzufügen
          </button>
        </div>

        <div className="space-y-3">
          {medienZurFrage.map((medium, index) => (
            <div key={`frage-medium-${index}`}>
              {renderMedienZeile({
                medium,
                onChange: (value) =>
                  setMedienZurFrage((current) =>
                    updateMedium(current, index, value)
                  ),
                onRemove: () =>
                  setMedienZurFrage((current) => removeMedium(current, index)),
              })}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <h2 className="mb-5 text-xl font-semibold">Kategorien</h2>

        <div className="flex flex-wrap gap-2">
          {kategorien.map((kat) => {
            const selected = selectedKategorien.includes(
              kat.fragenkategorie_id
            );

            return (
              <button
                type="button"
                key={kat.fragenkategorie_id}
                onClick={() => toggleKategorie(kat.fragenkategorie_id)}
                className={`rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition ${selected
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                  }`}
              >
                {selected ? "✓ " : ""}
                {kat.kategorie}
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Neue Kategorie:
            </span>
            <input
              value={neueKategorie}
              onChange={(e) => setNeueKategorie(e.target.value)}
              className={inputClass}
              placeholder="z. B. Literatur, 90er, Disney..."
            />
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={addNeueKategorie}
              className={buttonSecondaryClass}
            >
              Kategorie übernehmen
            </button>
          </div>
        </div>

        {neueKategorien.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {neueKategorien.map((kat) => (
              <span
                key={kat}
                className="rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                ✓ {kat}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-5">
          <h2 className="text-xl font-semibold">Antworten</h2>
          <p className="mt-1 text-sm text-slate-500">
            Wähle zwischen Antwortmöglichkeiten und offenen Antwortfeldern.
          </p>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setAntwortModus("antwortmoeglichkeiten")}
            className={`rounded-2xl border px-4 py-3 text-left font-semibold transition ${antwortModus === "antwortmoeglichkeiten"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
              }`}
          >
            Antwortmöglichkeiten
            <span className="block text-sm font-normal opacity-75">
              Für geschlossene Fragen oder klassische Antworten
            </span>
          </button>

          <button
            type="button"
            onClick={() => setAntwortModus("antwortfelder")}
            className={`rounded-2xl border px-4 py-3 text-left font-semibold transition ${antwortModus === "antwortfelder"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
              }`}
          >
            Offene Antwortfelder
            <span className="block text-sm font-normal opacity-75">
              Für Interpret + Titel, Person A + B usw.
            </span>
          </button>
        </div>

        {antwortModus === "antwortfelder" && frageVorlagen.length > 0 && (
          <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Vorlage übernehmen
              </span>
              <select
                value={selectedVorlageId ?? ""}
                onChange={(event) => {
                  const value = Number(event.target.value);

                  if (!value) {
                    setSelectedVorlageId(null);
                    return;
                  }

                  uebernehmeVorlage(value);
                }}
                className={inputClass}
              >
                <option value="">Keine Vorlage</option>
                {frageVorlagen.map((vorlage) => (
                  <option key={vorlage.vorlage_id} value={vorlage.vorlage_id}>
                    {vorlage.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {antwortModus === "antwortmoeglichkeiten" ? (
          <div className="space-y-4">
            {antworten.map((antwort, index) => (
              <div
                key={index}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-medium">Antwort {index + 1}</h3>

                  {antworten.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAntwort(index)}
                      className={trashButtonClass}
                      title="Antwort entfernen"
                      aria-label="Antwort entfernen"
                    >
                      <TrashIcon />
                    </button>
                  )}
                </div>

                <div className="grid gap-5 md:grid-cols-[minmax(420px,1fr)_220px]">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Antwort:
                    </span>
                    <textarea
                      value={antwort.antwort}
                      onChange={(e) =>
                        updateAntwort(index, { antwort: e.target.value })
                      }
                      className={`${inputClass} min-h-28 resize-y`}
                      placeholder="Antwort eingeben..."
                    />
                  </label>

                  <div className="space-y-4">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Antworttyp:
                      </span>
                      <select
                        value={antwort.antworttyp_id}
                        onChange={(e) =>
                          updateAntwort(index, {
                            antworttyp_id: Number(e.target.value),
                          })
                        }
                        className={inputClass}
                      >
                        {antworttypen.map((typ) => (
                          <option
                            key={typ.antworttyp_id}
                            value={typ.antworttyp_id}
                          >
                            {typ.antworttyp}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Richtig:
                      </span>
                      <input
                        type="checkbox"
                        checked={antwort.ist_richtig}
                        onChange={(e) =>
                          updateAntwort(index, {
                            ist_richtig: e.target.checked,
                          })
                        }
                        className="h-6 w-6 cursor-pointer accent-green-600"
                      />
                    </label>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-700">
                      Medien zur Antwort
                    </h4>

                    <button
                      type="button"
                      onClick={() =>
                        updateAntwort(index, {
                          medien: [
                            ...antwort.medien,
                            emptyMedium(antwort.medien.length + 1),
                          ],
                        })
                      }
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
                    >
                      + Medium
                    </button>
                  </div>

                  <div className="space-y-3">
                    {antwort.medien.map((medium, mediumIndex) => (
                      <div key={`antwort-${index}-medium-${mediumIndex}`}>
                        {renderMedienZeile({
                          medium,
                          onChange: (value) =>
                            updateAntwort(index, {
                              medien: updateMedium(
                                antwort.medien,
                                mediumIndex,
                                value
                              ),
                            }),
                          onRemove: () =>
                            updateAntwort(index, {
                              medien: removeMedium(
                                antwort.medien,
                                mediumIndex
                              ),
                            }),
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addAntwort}
              className={buttonSecondaryClass}
            >
              + Antwort hinzufügen
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={addAntwortfeld}
                className={buttonSecondaryClass}
              >
                + Antwortfeld hinzufügen
              </button>
            </div>

            {antwortfelder.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                Noch keine offenen Antwortfelder definiert.
              </div>
            ) : (
              antwortfelder.map((feld, feldIndex) => (
                <div
                  key={`antwortfeld-${feldIndex}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-medium">
                      Offenes Antwortfeld {feldIndex + 1}
                    </h3>

                    <button
                      type="button"
                      onClick={() => removeAntwortfeld(feldIndex)}
                      className={trashButtonClass}
                      title="Antwortfeld entfernen"
                      aria-label="Antwortfeld entfernen"
                    >
                      <TrashIcon />
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[220px_1fr_120px]">
                    <label>
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Beschriftung
                        {antwortfelder.length > 1 ? " *" : ""}
                      </span>
                      <input
                        value={feld.label}
                        onChange={(e) =>
                          updateAntwortfeld(feldIndex, {
                            label: e.target.value,
                          })
                        }
                        className={inputClass}
                        placeholder={
                          antwortfelder.length > 1
                            ? "z. B. Interpret"
                            : "optional"
                        }
                      />
                    </label>

                    <label>
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Lösung
                      </span>
                      <input
                        value={feld.loesungen[0]?.loesung_text ?? ""}
                        onChange={(e) =>
                          updateAntwortfeldLoesung(feldIndex, e.target.value)
                        }
                        className={inputClass}
                        placeholder="Richtige Lösung"
                      />
                    </label>

                    <label className="flex items-end gap-2 pb-3">
                      <input
                        type="checkbox"
                        checked={feld.ist_pflicht}
                        onChange={(e) =>
                          updateAntwortfeld(feldIndex, {
                            ist_pflicht: e.target.checked,
                          })
                        }
                        className="h-5 w-5 accent-slate-900"
                      />
                      <span className="text-sm font-medium text-slate-700">
                        Pflicht
                      </span>
                    </label>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      {meldung && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-800 shadow-sm">
          {meldung}
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/90 p-4 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
        <button
          type="submit"
          className="w-full rounded-2xl bg-slate-900 px-6 py-4 font-semibold text-white shadow-sm transition hover:bg-slate-700 active:scale-[0.99] md:w-auto"
        >
          {editFrage ? "Änderungen speichern" : "Speichern & nächste Frage"}
        </button>
      </div>
    </form>
  );
}
