"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";

const CsvGrid = dynamic(() => import("@/components/CsvGrid"), { ssr: false });

// Columns the filters read, with the position they sit at today as a fallback
// in case the sheet ever renames a header.
const COLS = {
  site: { name: "Site", fallback: 6 },
  acType: { name: "แอร์ชนิด", fallback: 7 },
  date: { name: "วันที่ทำ CM", fallback: 12 },
};

// Dates arrive as d/m/yyyy; fall back to the first 4-digit run for any other format.
function yearOf(value: string): string {
  const s = (value ?? "").trim();
  const parts = s.split("/");
  if (parts.length === 3 && /^\d{4}$/.test(parts[2].trim())) return parts[2].trim();
  return s.match(/\d{4}/)?.[0] ?? "";
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs">
      <span className="text-[var(--text-muted)]">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-[var(--panel-2)] text-[var(--app-text)] border border-[var(--border)] rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400"
      >
        <option value="">ทั้งหมด</option>
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

export default function CmClient({
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

  const [site, setSite] = useState("");
  const [year, setYear] = useState("");
  const [acType, setAcType] = useState("");

  const idx = useMemo(() => {
    const find = ({ name, fallback }: { name: string; fallback: number }) => {
      const i = headers.findIndex(h => h.trim() === name);
      return i >= 0 ? i : fallback;
    };
    return { site: find(COLS.site), acType: find(COLS.acType), date: find(COLS.date) };
  }, [headers]);

  // Each dropdown lists only values still reachable under the *other* two
  // filters, so no combination can come back empty.
  const { rowsFiltered, siteOptions, yearOptions, acTypeOptions } = useMemo(() => {
    const bySite = (r: string[], v: string) => !v || (r[idx.site] ?? "").trim() === v;
    const byType = (r: string[], v: string) => !v || (r[idx.acType] ?? "").trim() === v;
    const byYear = (r: string[], v: string) => !v || yearOf(r[idx.date] ?? "") === v;

    const uniq = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

    return {
      rowsFiltered: rows.filter(r => bySite(r, site) && byType(r, acType) && byYear(r, year)),
      siteOptions: uniq(
        rows.filter(r => byType(r, acType) && byYear(r, year)).map(r => (r[idx.site] ?? "").trim())
      ).sort((a, b) => a.localeCompare(b, "th")),
      yearOptions: uniq(
        rows.filter(r => bySite(r, site) && byType(r, acType)).map(r => yearOf(r[idx.date] ?? ""))
      ).sort((a, b) => b.localeCompare(a)),
      acTypeOptions: uniq(
        rows.filter(r => bySite(r, site) && byYear(r, year)).map(r => (r[idx.acType] ?? "").trim())
      ).sort((a, b) => a.localeCompare(b, "th")),
    };
  }, [rows, idx, site, year, acType]);

  const hasFilter = !!(site || year || acType);

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
          <button onClick={() => router.push("/sheet")} className="text-[var(--text-muted)] hover:text-blue-400">PM Results</button>
          <span className="text-blue-400 font-semibold">CM Results</span>
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
        <h1 className="text-lg font-bold">🛠️ CM Results</h1>
        <p className="text-[var(--text-muted)] text-xs">ผลการซ่อมแซมแก้ไข (CM) — ดึงข้อมูลสดจาก Google Sheet (อ่านอย่างเดียว)</p>
      </div>

      {error ? (
        <div className="m-4 p-4 rounded border border-red-500/50 bg-red-500/10 text-red-400 text-sm">
          โหลดข้อมูลไม่สำเร็จ: {error}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 px-4 pb-2 flex-shrink-0">
            <Select label="Site" value={site} options={siteOptions} onChange={setSite} />
            <Select label="ปีที่ทำ CM" value={year} options={yearOptions} onChange={setYear} />
            <Select label="แอร์ชนิด" value={acType} options={acTypeOptions} onChange={setAcType} />
            {hasFilter && (
              <button
                onClick={() => { setSite(""); setYear(""); setAcType(""); }}
                className="text-xs text-[var(--text-muted)] hover:text-blue-400 underline"
              >
                ล้างตัวกรอง
              </button>
            )}
            <span className="text-xs text-[var(--text-muted)] ml-auto">
              {rowsFiltered.length.toLocaleString()}
              {hasFilter && ` / ${rows.length.toLocaleString()}`} รายการ
            </span>
          </div>

          <div className="flex-1 min-h-0 px-4 pb-4">
            <CsvGrid headers={headers} rows={rowsFiltered} />
          </div>
        </>
      )}
    </div>
  );
}
