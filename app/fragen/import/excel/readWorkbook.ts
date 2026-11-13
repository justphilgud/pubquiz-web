import { posix } from "node:path";
import { XMLParser } from "fast-xml-parser";
import { headers, maxDetailRows, maxQuestions, type Issue, type Sheet } from "./format";
import { readWorkbookArchive } from "./workbookArchive";

type Xml = { [key: string]: Xml | Xml[] | string | undefined };
type Cell = { value: string; error?: string };
type Row = { number: number; cells: Map<number, Cell> };
export type Table = { columns: Map<string, number>; rows: Row[] };

const xmlParser = new XMLParser({
  ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false,
  trimValues: false, alwaysCreateTextNode: true, maxNestedTags: 64,
  processEntities: { enabled: true, maxTotalExpansions: 100_000 },
});

function xml(text: string | undefined): Xml {
  if (!text || /<!\s*(DOCTYPE|ENTITY)/i.test(text)) throw new Error("Ungültiges Workbook-XML.");
  return xmlParser.parse(text) as Xml;
}

function objects(node: Xml[string]): Xml[] {
  if (Array.isArray(node)) return node;
  return node && typeof node === "object" ? [node] : [];
}

function object(node: Xml[string]): Xml {
  return objects(node)[0] ?? {};
}

function string(node: Xml[string]) {
  return typeof node === "string" ? node : "";
}

function text(node: Xml[string]) {
  return typeof node === "string" ? node : string(object(node)["#text"]);
}

function decodeExcel(value: string) {
  return value.replace(/_x([0-9A-Fa-f]{4})_/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

function richText(node: Xml[string]) {
  const item = object(node);
  return decodeExcel(text(item.t) + objects(item.r).map(run => text(run.t)).join(""));
}

function cellValue(cell: Xml, shared: string[]): Cell {
  const type = string(cell["@_t"]);
  const value = text(cell.v);
  if ("f" in cell) return { value: "", error: "Formeln sind in Eingabezellen nicht zulässig." };
  if (type === "inlineStr") return { value: richText(cell.is) };
  if (type === "s") {
    if (!/^\d+$/.test(value) || shared[Number(value)] === undefined) throw new Error("Ungültiger Textverweis.");
    return { value: shared[Number(value)] };
  }
  if (type === "str") return { value: decodeExcel(value) };
  return value
    ? { value, error: "Bitte die Zelle als Text eingeben, etwa Zahlen oder Daten im Format JJJJ-MM-TT." }
    : { value: "" };
}

function columnNumber(letters: string) {
  return [...letters].reduce((column, char) => column * 26 + char.charCodeAt(0) - 64, 0);
}

function rowsOf(sheet: Xml, shared: string[]) {
  const rows: Row[] = [];
  let previous = 0;
  for (const row of objects(object(sheet.sheetData).row)) {
    const number = Number(row["@_r"] ?? previous + 1);
    if (!Number.isSafeInteger(number) || number <= previous || number > 1_048_576) {
      throw new Error("Ungültige Excel-Zeilennummer.");
    }
    previous = number;
    const cells = new Map<number, Cell>();
    let lastColumn = 0;
    for (const cell of objects(row.c)) {
      const address = string(cell["@_r"]);
      const match = address.match(/^([A-Z]{1,3})([1-9][0-9]*)$/);
      if (address && (!match || Number(match[2]) !== number)) throw new Error("Ungültige Excel-Zelladresse.");
      const column = match ? columnNumber(match[1]) : lastColumn + 1;
      if (column <= lastColumn || column > 16384) throw new Error("Ungültige Excel-Spalte.");
      lastColumn = column;
      const value = cellValue(cell, shared);
      if (value.error || value.value.trim()) cells.set(column, value);
    }
    if (cells.size) rows.push({ number, cells });
    if (rows.length > maxDetailRows + 1) throw new Error("Zu viele befüllte Zeilen.");
  }
  return rows;
}

export function readTables(bytes: Buffer) {
  const read = readWorkbookArchive(bytes);
  const contentTypes = xml(read("[Content_Types].xml"));
  if (!objects(object(contentTypes.Types).Override).some(entry =>
    entry["@_PartName"] === "/xl/workbook.xml" &&
    entry["@_ContentType"] === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml")) {
    throw new Error("Bitte eine XLSX-Arbeitsmappe ohne Makros auswählen.");
  }
  const workbook = object(xml(read("xl/workbook.xml")).workbook);
  const sheets = objects(object(workbook.sheets).sheet);
  const relationships = objects(object(xml(read("xl/_rels/workbook.xml.rels")).Relationships).Relationship);
  const sharedPath = relationships.find(link => string(link["@_Type"]).endsWith("/sharedStrings"));
  const sharedXml = sharedPath ? read(workbookPart(sharedPath)) : undefined;
  const shared = sharedXml ? objects(object(xml(sharedXml).sst).si).map(richText) : [];
  const tables = new Map<Sheet, Table>();
  const errors: Issue[] = [];

  for (const sheet of Object.keys(headers) as Sheet[]) {
    const entries = sheets.filter(item => item["@_name"] === sheet);
    const link = entries.length === 1
      ? relationships.find(item => item["@_Id"] === entries[0]["@_id"] && string(item["@_Type"]).endsWith("/worksheet"))
      : undefined;
    if (!link) {
      errors.push({ sheet, field: "Tabellenblatt", message: "Dieses Tabellenblatt muss genau einmal vorhanden sein." });
      continue;
    }
    const document = object(xml(read(workbookPart(link))).worksheet);
    if (document.mergeCells) {
      errors.push({ sheet, field: "Zellen", message: "Verbundene Zellen sind in Datenblättern nicht zulässig." });
    }
    const rows = rowsOf(document, shared);
    const header = rows[0]?.number === 1 ? rows.shift() : undefined;
    const columns = new Map<string, number>();
    const expected: readonly string[] = headers[sheet];
    for (const [column, cell] of header?.cells ?? []) {
      if (cell.error || !expected.includes(cell.value.trim()) || columns.has(cell.value.trim())) {
        errors.push({ sheet, row: 1, field: cell.value.slice(0, 80) || `Spalte ${column}`,
          message: cell.error || "Unbekannte oder doppelte Spaltenüberschrift." });
      } else {
        columns.set(cell.value.trim(), column);
      }
    }
    for (const field of expected) {
      if (!columns.has(field)) errors.push({ sheet, row: 1, field, message: "Diese Spaltenüberschrift fehlt." });
    }
    if (rows.length > (sheet === "Fragen" ? maxQuestions : maxDetailRows)) {
      errors.push({ sheet, field: "Zeilen", message: `Maximal ${sheet === "Fragen" ? maxQuestions : maxDetailRows} befüllte Zeilen sind zulässig.` });
    }
    tables.set(sheet, { columns, rows });
  }
  return { tables, errors };
}

function workbookPart(link: Xml) {
  const path = string(link["@_Target"]);
  const normalized = path.startsWith("/") ? posix.normalize(path).slice(1) : posix.join("xl", path);
  if (!path || !normalized.startsWith("xl/") || link["@_TargetMode"] === "External") {
    throw new Error("Ungültiger Workbook-Verweis.");
  }
  return normalized;
}
