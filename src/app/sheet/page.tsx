import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/auth";
import SheetClient from "./SheetClient";

export const dynamic = "force-dynamic";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQT_kYRb6046P3S6NXTZB7yTk4Za3pAY2gb1rA0fuwb4t12GhrM79lEhVXLru0odwXJRzgDHuRKSW-m/pub?gid=1213064501&single=true&output=csv";

// Parse CSV preserving every field as the exact source string (no date/number
// coercion), so timestamps are shown verbatim and stay consistent.
function parseCSV(text: string): string[][] {
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

export default async function SheetPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const role = await getRole(supabase);

  let headers: string[] = [];
  let rows: string[][] = [];
  let error = "";

  try {
    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const aoa = parseCSV(text);
    headers = aoa[0] ?? [];
    rows = aoa.slice(1);
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <SheetClient
      headers={headers}
      rows={rows}
      error={error}
      userEmail={user?.email ?? ""}
      isLoggedIn={!!user}
      role={role}
    />
  );
}
