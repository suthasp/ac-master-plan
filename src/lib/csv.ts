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

/** Published PM Results sheet — shared by the PM Results grid and the PM dashboard. */
export const PM_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQT_kYRb6046P3S6NXTZB7yTk4Za3pAY2gb1rA0fuwb4t12GhrM79lEhVXLru0odwXJRzgDHuRKSW-m/pub?gid=1213064501&single=true&output=csv";

/** Published CM Results sheet — shared by the CM Results grid and the CM dashboard. */
export const CM_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQQvngGGOY9JoMIeWBjSrXsJ3LGXLuLijSyCWvgoZNFEThads_vwnAWfM3Yt32jZlfu9JIYIYbcgWer/pub?gid=1331082262&single=true&output=csv";
