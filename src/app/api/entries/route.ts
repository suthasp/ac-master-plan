import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("plan_entries")
    .select("*");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const supabase = createClient();
  const body = await request.json();
  // body: { site_id, year, week_number, status }
  const { site_id, year, week_number, status } = body;

  if (!status) {
    // delete if empty
    const { error } = await supabase
      .from("plan_entries")
      .delete()
      .match({ site_id, year, week_number });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  const { data, error } = await supabase
    .from("plan_entries")
    .upsert({ site_id, year, week_number, status }, { onConflict: "site_id,year,week_number" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
