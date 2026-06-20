import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";

// GET: list all users with their role
export async function GET() {
  const supabase = createClient();
  const denied = await requireAdmin(supabase);
  if (denied) return denied;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: profiles } = await admin.from("profiles").select("id, role");
  const roleMap = new Map((profiles ?? []).map(p => [p.id as string, p.role as string]));

  const users = data.users.map(u => ({
    id: u.id,
    email: u.email ?? "",
    role: roleMap.get(u.id) ?? "viewer",
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
  }));
  return NextResponse.json(users);
}

// POST: create a new user { email, password, role }
export async function POST(request: Request) {
  const supabase = createClient();
  const denied = await requireAdmin(supabase);
  if (denied) return denied;

  const { email, password, role } = await request.json();
  if (!email || !password) {
    return NextResponse.json({ error: "ต้องระบุอีเมลและรหัสผ่าน" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { error: pErr } = await admin
    .from("profiles")
    .upsert({ id: data.user.id, email, role: role || "viewer" }, { onConflict: "id" });
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  return NextResponse.json({ id: data.user.id });
}

// PATCH: update a user's role { id, role }
export async function PATCH(request: Request) {
  const supabase = createClient();
  const denied = await requireAdmin(supabase);
  if (denied) return denied;

  const { id, role } = await request.json();
  if (!id || !role) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ role }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE: remove a user { id }
export async function DELETE(request: Request) {
  const supabase = createClient();
  const denied = await requireAdmin(supabase);
  if (denied) return denied;

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "ไม่พบ id" }, { status: 400 });

  // prevent deleting yourself
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id === id) {
    return NextResponse.json({ error: "ลบบัญชีตัวเองไม่ได้" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await admin.from("profiles").delete().eq("id", id);
  return NextResponse.json({ success: true });
}
