import * as XLSX from "xlsx";
import { headers, maxQuestions, maxDetailRows, type Sheet } from "./format";

const examples = {
  Fragen: [
    ["O-01", "Offen", "Wie heißt der höchste Berg der Erde über dem Meeresspiegel?", "", "", "Maßstab ist die Höhe über dem Meeresspiegel.", "Bei Rückfragen den Maßstab wiederholen.", "", "", ""],
    ["O-02", "Offen", "Welches chemische Element hat das Symbol Fe?", "", "", "Periodensystem, Ordnungszahl 26.", "F und e getrennt vorlesen.", "", "", ""],
    ["G-01", "Geschlossen", "In welcher Einheit wird elektrische Spannung gemessen?", "Einfachauswahl", "", "SI-Einheit der Spannung.", "Erst alle vier Optionen vorlesen.", "", "", ""],
    ["G-02", "Geschlossen", "Welche der folgenden Zahlen ist eine Primzahl?", "Einfachauswahl", "", "Eine Primzahl hat genau zwei positive Teiler.", "Alle vier Zahlen vorlesen.", "", "", ""],
    ["P-01", "Paare bilden", "Ordne den beiden Ländern ihre Hauptstadt zu.", "", "", "Portugal und Griechenland.", "", "", "", ""],
    ["P-02", "Paare bilden", "Ordne jeder SI-Basisgröße ihre Basiseinheit zu.", "", "", "Auswahl von vier SI-Basisgrößen.", "", "", "", ""],
  ],
  Antworten: [
    ["O-01", "Mount Everest", "Ja", "Der Gipfel liegt im Himalaya."],
    ["O-01", "Everest", "Ja", ""], ["O-01", "Sagarmatha", "Ja", ""],
    ["O-02", "Eisen", "Ja", "Das Symbol Fe geht auf den lateinischen Namen zurück."],
    ["O-02", "Ferrum", "Ja", ""],
    ["G-01", "Ampere", "Nein", "Ampere ist die Einheit der Stromstärke."],
    ["G-01", "Volt", "Ja", "Ein Volt entspricht einem Watt pro Ampere."],
    ["G-01", "Ohm", "Nein", ""], ["G-01", "Watt", "Nein", ""],
    ["G-02", "1", "Nein", ""], ["G-02", "3", "Ja", "Die positiven Teiler sind 1 und 3."],
    ["G-02", "4", "Nein", ""], ["G-02", "9", "Nein", ""],
  ],
  Paare: [
    ["P-01", "Portugal", "Lissabon"], ["P-01", "Griechenland", "Athen"],
    ["P-02", "Länge", "Meter"], ["P-02", "Masse", "Kilogramm"], ["P-02", "Zeit", "Sekunde"], ["P-02", "Stoffmenge", "Mol"],
  ],
};

const widths = {
  Fragen: [15, 18, 60, 19, 25, 40, 40, 24, 16, 16],
  Antworten: [15, 38, 12, 65],
  Paare: [15, 38, 38],
};

export function writeWorkbook(example: boolean): Buffer {
  const book = XLSX.utils.book_new();
  for (const name of Object.keys(headers) as Sheet[]) {
    const rows = [[...headers[name]], ...(example ? examples[name] : [])];
    // Keep a practical text-formatted entry range in the download, including dates and numbers.
    const preformattedRows = name === "Fragen" ? maxQuestions : 150;
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    for (let r = 1; r <= preformattedRows; r++) {
      for (let c = 0; c < headers[name].length; c++) {
        const address = XLSX.utils.encode_cell({ r, c });
        sheet[address] = { ...(sheet[address] ?? { t: "s", v: "" }), z: "@" };
      }
    }
    sheet["!ref"] = XLSX.utils.encode_range({ r: 0, c: 0 }, { r: preformattedRows, c: headers[name].length - 1 });
    sheet["!cols"] = widths[name].map(wch => ({ wch }));
    sheet["!autofilter"] = { ref: XLSX.utils.encode_range({ r: 0, c: 0 }, { r: rows.length - 1, c: headers[name].length - 1 }) };
    XLSX.utils.book_append_sheet(book, sheet, name);
  }
  const guide = XLSX.utils.aoa_to_sheet([
    ["PubQuiz Excel-Fragenimport", "Format 1"],
    ["Fragen", "Eine Zeile je Frage. Fragetyp: Offen, Geschlossen oder Paare bilden."],
    ["Fragekürzel", "Dateiweit eindeutig, zum Beispiel O-01. In Antworten oder Paare wiederholen."],
    ["Offen", "Eine Zeile je Schreibvariante in Antworten. Richtig bleibt leer oder lautet Ja."],
    ["Geschlossen", "Auswahlmodus Einfachauswahl. Genau ein Ja und mindestens ein Nein in Antworten."],
    ["Paare bilden", "Je Zuordnung eine Zeile in Paare. Pro Frage 2–10 Paare, links und rechts je eindeutig."],
    ["Zusatzinformation", "Eine Erläuterung je Antwort. Zeilenumbrüche in Erläuterungen sind möglich."],
    ["Kategorien", "Optional. Nur vorhandene aktive Namen, ein Name pro Zeile in derselben Zelle."],
    ["Aktualität", "Optional. Veraltet ab oder Prüfen ab als Text im Format JJJJ-MM-TT."],
    ["Zahlen und Daten", "Als Text eingeben. Jenseits der vorformatierten Zeilen ggf. zuerst das Zellformat Text wählen."],
    ["Zielbereich", "Eventreihe oder globalen Bereich im Importdialog auswählen."],
    ["Grenzen", `Je Datei bis ${maxQuestions} Fragen und ${maxDetailRows} Zeilen pro Detailblatt.`],
    ["Datei prüfen", "Die Vorschau prüft alle Fragen. Erst die Bestätigung legt sie gemeinsam als Entwürfe an."],
    ["Datei", "Als XLSX speichern. Formeln und verbundene Zellen sind in Datenblättern unzulässig."],
  ]);
  guide["!cols"] = [{ wch: 30 }, { wch: 110 }];
  XLSX.utils.book_append_sheet(book, guide, "Anleitung");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx", compression: true });
}
