import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import SheetClient from "./SheetClient";

export const dynamic = "force-dynamic";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQT_kYRb6046P3S6NXTZB7yTk4Za3pAY2gb1rA0fuwb4t12GhrM79lEhVXLru0odwXJRzgDHuRKSW-m/pub?gid=1213064501&single=true&output=csv";

export default async function SheetPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let headers: string[] = [];
  let rows: string[][] = [];
  let error = "";

  try {
    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const wb = XLSX.read(text, { type: "string" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "" });
    headers = (aoa[0] ?? []).map(v => String(v));
    rows = (aoa.slice(1) as unknown[][]).map(r => r.map(v => String(v ?? "")));
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
    />
  );
}
