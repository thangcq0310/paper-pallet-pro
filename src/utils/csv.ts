export type CsvCell = string | number | boolean | null | undefined;

function stripBom(text: string) {
  if (text.charCodeAt(0) === 0xfeff) return text.slice(1);
  return text;
}

// Minimal CSV parser with quoted fields support.
export function parseCsv(text: string, delimiter: "," | "\t" = ","): string[][] {
  const input = stripBom(text ?? "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    // skip trailing empty row
    if (row.length === 1 && row[0] === "" && rows.length === 0) return;
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];

    if (inQuotes) {
      if (ch === "\"") {
        if (next === "\"") {
          cell += "\"";
          i++;
          continue;
        }
        inQuotes = false;
        continue;
      }
      cell += ch;
      continue;
    }

    if (ch === "\"") {
      inQuotes = true;
      continue;
    }

    if (ch === delimiter) {
      pushCell();
      continue;
    }

    if (ch === "\r") {
      if (next === "\n") i++;
      pushCell();
      pushRow();
      continue;
    }

    if (ch === "\n") {
      pushCell();
      pushRow();
      continue;
    }

    cell += ch;
  }

  // last cell/row
  pushCell();
  if (row.some((c) => c !== "")) pushRow();
  return rows.map((r) => r.map((c) => c.trim()));
}

export function detectDelimiter(text: string): "," | "\t" {
  const head = stripBom(text).split(/\r?\n/)[0] ?? "";
  const commaCount = (head.match(/,/g) ?? []).length;
  const tabCount = (head.match(/\t/g) ?? []).length;
  return tabCount > commaCount ? "\t" : ",";
}

function escapeCell(v: CsvCell): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes("\"") || s.includes(",") || s.includes("\n") || s.includes("\r") || s.includes("\t")) {
    return `"${s.replaceAll("\"", "\"\"")}"`;
  }
  return s;
}

export function toCsv(rows: CsvCell[][], delimiter: "," | "\t" = ","): string {
  return rows.map((r) => r.map(escapeCell).join(delimiter)).join("\n") + "\n";
}

export function downloadTextFile(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

