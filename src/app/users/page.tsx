import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import UsersClient from "./UsersClient";

export default async function UsersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[var(--app-bg)] text-[var(--app-text)]">
        <p className="text-lg">⛔ หน้านี้สำหรับผู้ดูแลระบบ (admin) เท่านั้น</p>
        <Link href="/dashboard" className="text-blue-400 hover:underline">← กลับหน้า Plan</Link>
      </div>
    );
  }

  return <UsersClient userEmail={user.email ?? ""} />;
}
