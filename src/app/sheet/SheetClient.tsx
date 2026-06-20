"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";

const SheetGrid = dynamic(() => import("./SheetGrid"), { ssr: false });

export default function SheetClient({
  headers,
  rows,
  error,
  userEmail,
  isLoggedIn,
}: {
  headers: string[];
  rows: string[][];
  error: string;
  userEmail: string;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.refresh();
  }

  return (
    <div className="flex flex-col h-screen bg-[var(--app-bg)] text-[var(--app-text)]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--panel-2)] border-b border-[var(--border)] text-sm flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="font-bold text-blue-400">❄️ AC Master Plan 2026 (AMC)</span>
          <button onClick={() => router.push("/dashboard")} className="text-[var(--text-muted)] hover:text-blue-400">Plan</button>
          <button onClick={() => router.push("/insights")} className="text-[var(--text-muted)] hover:text-blue-400">Insights</button>
          <span className="text-blue-400 font-semibold">Sheet</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {isLoggedIn ? (
            <>
              <span className="text-[var(--text-muted)] text-xs hidden sm:inline">{userEmail}</span>
              <button onClick={handleLogout} className="text-red-400 hover:text-red-300">Logout</button>
            </>
          ) : (
            <button onClick={() => router.push("/login")} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-0.5 rounded">Login</button>
          )}
        </div>
      </div>

      <div className="px-4 py-2 flex-shrink-0">
        <h1 className="text-lg font-bold">📄 Google Sheet</h1>
        <p className="text-[var(--text-muted)] text-xs">ดึงข้อมูลสดจาก Google Sheet ที่เผยแพร่ (อ่านอย่างเดียว)</p>
      </div>

      {error ? (
        <div className="m-4 p-4 rounded border border-red-500/50 bg-red-500/10 text-red-400 text-sm">
          โหลดข้อมูลไม่สำเร็จ: {error}
        </div>
      ) : (
        <div className="flex-1 min-h-0 px-4 pb-4">
          <SheetGrid headers={headers} rows={rows} />
        </div>
      )}
    </div>
  );
}
