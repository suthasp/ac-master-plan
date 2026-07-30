// Parse CSV preserving every field as the exact source string (no date/number
// coercion), so timestamps are shown verbatim and stay consistent.
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

/** Fetch a published Google Sheet CSV and split it into headers + data rows. */
export async function fetchSheetCSV(url: string): Promise<{
  headers: string[];
  rows: string[][];
  error: string;
}> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const aoa = parseCSV(await res.text());
    return { headers: aoa[0] ?? [], rows: aoa.slice(1), error: "" };
  } catch (e) {
    return { headers: [], rows: [], error: (e as Error).message };
  }
}
