import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

interface ImportRow {
  name: string;
  ac_count?: number;
  ac_type?: string;
  source_1?: string | null;
  source_2?: string | null;
  source_3?: string | null;
  weeks?: Record<string, string>; // { "1": "P", "5": "F", ... }
}

const VALID_STATUS = new Set(["P", "F", "D"]);

export async function POST(request: Request) {
  const supabase = createClient();

  const denied = await requireAdmin(supabase);
  if (denied) return denied;

  const { year = 2026, rows } = (await request.json()) as {
    year?: number;
    rows?: ImportRow[];
  };

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows to import" }, { status: 400 });
  }

  const entriesPayload: {
    site_id: string;
    year: number;
    week_number: number;
    status: string;
  }[] = [];

  let inserted = 0;
  for (const row of rows) {
    const trimmedName = String(row.name ?? "").trim();
    if (!trimmedName || trimmedName.toUpperCase() === "SUMMARY") continue;

    const { data: site, error } = await supabase
      .from("sites")
      .insert({
        name: trimmedName,
        ac_count: Number(row.ac_count) || 0,
        ac_type: row.ac_type || "Precision",
        source_1: row.source_1 || null,
        source_2: row.source_2 || null,
        source_3: row.source_3 || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    inserted++;

    if (row.weeks) {
      for (const [wk, raw] of Object.entries(row.weeks)) {
        const status = String(raw).trim().toUpperCase();
        const week_number = Number(wk);
        if (VALID_STATUS.has(status) && week_number >= 1 && week_number <= 53) {
          entriesPayload.push({ site_id: site.id, year, week_number, status });
        }
      }
    }
  }

  if (entriesPayload.length) {
    const { error } = await supabase.from("plan_entries").insert(entriesPayload);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ inserted, entries: entriesPayload.length });
}
