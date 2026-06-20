"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";

interface AppUser {
  id: string;
  email: string;
  role: string;
  last_sign_in_at: string | null;
}

export default function UsersClient({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", role: "viewer" });
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const showToast = useCallback((type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/users");
    if (res.ok) {
      setUsers(await res.json());
    } else {
      const e = await res.json().catch(() => ({}));
      showToast("error", `โหลดไม่สำเร็จ (${res.status}): ${e.error || "unknown"}`);
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const addUser = useCallback(async () => {
    if (!form.email.trim() || !form.password) {
      showToast("error", "กรอกอีเมลและรหัสผ่านให้ครบ");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email.trim(), password: form.password, role: form.role }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "เพิ่มไม่สำเร็จ");
      showToast("success", `เพิ่มผู้ใช้ ${form.email} แล้ว`);
      setForm({ email: "", password: "", role: "viewer" });
      await load();
    } catch (e) {
      showToast("error", (e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [form, load, showToast]);

  const changeRole = useCallback(async (id: string, role: string) => {
    const res = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, role }),
    });
    if (res.ok) {
      setUsers(prev => prev.map(u => (u.id === id ? { ...u, role } : u)));
      showToast("success", "อัปเดต role แล้ว");
    } else {
      showToast("error", "อัปเดต role ไม่สำเร็จ");
    }
  }, [showToast]);

  const deleteUser = useCallback(async (id: string, email: string) => {
    if (!confirm(`ลบผู้ใช้ "${email}"?`)) return;
    const res = await fetch("/api/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setUsers(prev => prev.filter(u => u.id !== id));
      showToast("success", `ลบ ${email} แล้ว`);
    } else {
      showToast("error", (await res.json().catch(() => ({}))).error || "ลบไม่สำเร็จ");
    }
  }, [showToast]);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.refresh();
  }, [supabase, router]);

  const input = "bg-[var(--panel-2)] border border-[var(--border)] text-[var(--app-text)] rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500";

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]">
      {/* Top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between px-4 py-2 bg-[var(--panel-2)] border-b border-[var(--border)] text-sm">
        <div className="flex items-center gap-4">
          <span className="font-bold text-blue-400">❄️ AC Master Plan 2026 (AMC)</span>
          <button onClick={() => router.push("/dashboard")} className="text-[var(--text-muted)] hover:text-blue-400">Plan</button>
          <button onClick={() => router.push("/insights")} className="text-[var(--text-muted)] hover:text-blue-400">Insights</button>
          <button onClick={() => router.push("/sheet")} className="text-[var(--text-muted)] hover:text-blue-400">PM Results</button>
          <span className="text-blue-400 font-semibold">Users</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="text-[var(--text-muted)] text-xs hidden sm:inline">{userEmail} <span className="text-blue-400">(admin)</span></span>
          <button onClick={handleLogout} className="text-red-400 hover:text-red-300">Logout</button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-1">จัดการผู้ใช้</h1>
        <p className="text-[var(--text-muted)] text-sm mb-6">เพิ่ม / ลบ ผู้ใช้ และกำหนดสิทธิ์ (admin / viewer)</p>

        {/* add user */}
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl p-4 mb-6">
          <h2 className="font-semibold mb-3">+ เพิ่มผู้ใช้ใหม่</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--text-muted)]">อีเมล</span>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={`${input} w-56`} placeholder="user@example.com" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--text-muted)]">รหัสผ่าน</span>
              <input type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className={`${input} w-44`} placeholder="อย่างน้อย 6 ตัว" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--text-muted)]">Role</span>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className={input}>
                <option value="viewer">viewer</option>
                <option value="admin">admin</option>
              </select>
            </label>
            <button onClick={addUser} disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded">
              {saving ? "กำลังเพิ่ม..." : "เพิ่มผู้ใช้"}
            </button>
          </div>
        </div>

        {/* list */}
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-xl overflow-hidden">
          {loading ? (
            <div className="text-[var(--text-muted)] py-12 text-center text-sm">กำลังโหลด...</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--panel-2)] text-left">
                  <th className="px-4 py-2">อีเมล</th>
                  <th className="px-4 py-2 w-32">Role</th>
                  <th className="px-4 py-2 w-40">เข้าระบบล่าสุด</th>
                  <th className="px-4 py-2 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-2">{u.email}</td>
                    <td className="px-4 py-2">
                      <select value={u.role} onChange={e => changeRole(u.id, e.target.value)} className={input}>
                        <option value="viewer">viewer</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 text-[var(--text-muted)] text-xs">
                      {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("th-TH") : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => deleteUser(u.id, u.email)} className="text-red-400 hover:text-red-600" title="ลบผู้ใช้">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {toast && (
        <div className={`fixed top-3 right-3 z-[60] max-w-sm px-4 py-2.5 rounded-lg shadow-lg text-sm text-white flex items-center gap-2 ${toast.type === "success" ? "bg-emerald-600" : "bg-red-600"}`}>
          <span>{toast.type === "success" ? "✓" : "⚠"}</span>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
