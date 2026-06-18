import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

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

  const denied = await requireAdmin(supabase);
  if (denied) return denied;

  const body = await request.json();
  const { id, ...updates } = body;
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
