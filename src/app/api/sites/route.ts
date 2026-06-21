import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, getRole } from "@/lib/auth";

// fields a "manager" is allowed to edit
const MANAGER_FIELDS = new Set(["ac_count", "source_1", "source_2", "source_3"]);

export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = createClient();

  const denied = await requireAdmin(supabase);
  if (denied) return denied;

  const body = await request.json();
  const { data, error } = await supabase
    .from("sites")
    .insert([body])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const supabase = createClient();

  const role = await getRole(supabase);
  if (role !== "admin" && role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  // managers may only edit the AC count and round columns
  if (role === "manager" && Object.keys(updates).some(k => !MANAGER_FIELDS.has(k))) {
    return NextResponse.json(
      { error: "Forbidden: manager can edit only counts and rounds" },
      { status: 403 }
    );
  }
  const { data, error } = await supabase
    .from("sites")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const supabase = createClient();

  const denied = await requireAdmin(supabase);
  if (denied) return denied;

  const { id } = await request.json();
  const { error } = await supabase.from("sites").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
