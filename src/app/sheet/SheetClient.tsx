"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";
import { FilterBar, useGridFilters, type FilterSpec } from "@/components/GridFilters";

const CsvGrid = dynamic(() => import("@/components/CsvGrid"), { ssr: false });

const FILTERS: FilterSpec[] = [
  { key: "site", label: "Site", header: "Site", fallback: 1 },
  {
    key: "round",
    label: "PM ครั้งที่",
    header: "แบบบันทึกผลการบำรุงรักษาเครื่องปรับอากาศ (Precision Air) ครั้งที่",
    fallback: 2,
  },
  { key: "region1", label: "Region1", header: "Region1", fallback: 39 },
  { key: "acType", label: "แอร์ชนิด", header: "แอร์ชนิด", fallback: 38 },
];

export default function SheetClient({
  headers,
  rows,
  error,
  userEmail,
  isLoggedIn,
  role,
}: {
  headers: string[];
  rows: string[][];
  error: string;
  userEmail: string;
  isLoggedIn: boolean;
  role: string;
}) {
  const isAdmin = role === "admin";
  const router = useRouter();
  const supabase = createClient();
  const filters = useGridFilters(headers, rows, FILTERS);

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
          <button onClick={() => router.push("/pm-dashboard")} className="text-[var(--text-muted)] hover:text-blue-400">Dashboard PM</button>
          <span className="text-blue-400 font-semibold">PM Results</span>
          <button onClick={() => router.push("/cm")} className="text-[var(--text-muted)] hover:text-blue-400">CM Results</button>
          {isAdmin && <button onClick={() => router.push("/users")} className="text-[var(--text-muted)] hover:text-blue-400">Users</button>}
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {isLoggedIn ? (
            <>
              <span className="text-[var(--text-muted)] text-xs hidden sm:inline">
                {userEmail} <span className="text-blue-400">({role || "viewer"})</span>
              </span>
              <button onClick={handleLogout} className="text-red-400 hover:text-red-300">Logout</button>
            </>
          ) : (
            <button onClick={() => router.push("/login")} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-0.5 rounded">Login</button>
          )}
        </div>
      </div>

      <div className="px-4 py-2 flex-shrink-0">
        <h1 className="text-lg font-bold">📄 PM Results</h1>
        <p className="text-[var(--text-muted)] text-xs">ผลการบำรุงรักษา (PM) — ดึงข้อมูลสดจาก Google Sheet (อ่านอย่างเดียว)</p>
      </div>

      {error ? (
        <div className="m-4 p-4 rounded border border-red-500/50 bg-red-500/10 text-red-400 text-sm">
          โหลดข้อมูลไม่สำเร็จ: {error}
        </div>
      ) : (
        <>
          <div className="px-4 pb-2 flex-shrink-0">
            <FilterBar filters={filters} />
          </div>

          <div className="flex-1 min-h-0 px-4 pb-4">
            <CsvGrid
              headers={headers}
              rows={filters.rowsFiltered}
              sheetName="PM Results"
              fileBaseName="pm-results"
            />
          </div>
        </>
      )}
    </div>
  );
}
