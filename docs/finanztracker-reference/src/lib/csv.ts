// Kleiner, robuster CSV-Parser: erkennt Trennzeichen (; oder ,), respektiert
// Anführungszeichen und Zeilenumbrüche innerhalb von Feldern.

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  delimiter: string;
}

function detectDelimiter(firstLine: string): string {
  const semis = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  if (tabs > semis && tabs > commas) return "\t";
  return semis >= commas ? ";" : ",";
}

export function parseCsv(text: string): ParsedCsv {
  const clean = text.replace(/^﻿/, ""); // BOM entfernen
  const firstLine = clean.split(/\r?\n/)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);

  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      record.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      record.push(field);
      field = "";
      if (record.some((c) => c.trim() !== "")) records.push(record);
      record = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || record.length) {
    record.push(field);
    if (record.some((c) => c.trim() !== "")) records.push(record);
  }

  const headers = (records.shift() ?? []).map((h) => h.trim());
  return { headers, rows: records, delimiter };
}

// Betrags-Parsing lebt jetzt zentral in amount.ts (von allen Eingabepfaden
// genutzt). Für Abwärtskompatibilität hier unter dem alten Namen re-exportiert.
export { parseAmount as parseNumber } from "./amount";

// Datum in ISO YYYY-MM-DD wandeln. Erkennt DD.MM.YYYY, YYYY-MM-DD, DD/MM/YYYY.
export function parseDate(raw: string): string | null {
  const s = String(raw).trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/))) {
    const day = m[1].padStart(2, "0");
    const mon = m[2].padStart(2, "0");
    let year = m[3];
    if (year.length === 2) year = "20" + year;
    return `${year}-${mon}-${day}`;
  }
  return null;
}
