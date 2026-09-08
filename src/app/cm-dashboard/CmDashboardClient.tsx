"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
  LineChart, Line,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";
import { FilterBar, useGridFilters, type FilterSpec } from "@/components/GridFilters";

const ALL_YEARS = "";

const PRECISION_COLOR = "#3b82f6";
const COMFORT_COLOR = "#f59e0b";
const ACCENT_COLOR = "#8b5cf6"; // single-series charts, so it never reads as an AC type

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/** Column position by header name, falling back to a fixed index if renamed. */
function colIndex(headers: string[], header: string, fallback: number) {
  const i = headers.findIndex(h => norm(h) === norm(header));
  return i >= 0 ? i : fallback;
}

const HEADER = {
  site: "Site",
  acType: "แอร์ชนิด",
  region: "Region1",
  brand: "ยี่ห้อ",
  date: "วันที่ทำ CM",
};

const FILTERS: FilterSpec[] = [
  { key: "site", label: "Site", header: HEADER.site, fallback: 6 },
  { key: "region1", label: "Region1", header: HEADER.region, fallback: 1 },
  { key: "acType", label: "แอร์ชนิด", header: HEADER.acType, fallback: 7 },
];

/** "25/6/2026" → { year: "2026", key: "2026-06" }; blank for any other format. */
function parseDate(raw: string): { year: string; key: string } {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return { year: "", key: "" };
  return { year: m[3], key: `${m[3]}-${String(Number(m[2])).padStart(2, "0")}` };
}

/**
 * A few rows carry a Buddhist-era year (e.g. 2569). They still count in the
 * totals, but they sort after the real ones so a typo never heads the list.
 */
const isPlausibleYear = (y: string) => Number(y) >= 1990 && Number(y) <= 2100;

/** newest first, with any implausible year pushed to the end */
const compareYearsDesc = (a: string, b: string) =>
  Number(isPlausibleYear(b)) - Number(isPlausibleYear(a)) || b.localeCompare(a);

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const monthLabel = (key: string) => {
  const [y, mm] = key.split("-");
  return `${TH_MONTHS[Number(mm) - 1]} ${y.slice(2)}`;
};

export default function CmDashboardClient({
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
  const [year, setYear] = useState<string>(ALL_YEARS);

  const idx = useMemo(
    () => ({
      site: colIndex(headers, HEADER.site, 6),
      acType: colIndex(headers, HEADER.acType, 7),
      region: colIndex(headers, HEADER.region, 1),
      brand: colIndex(headers, HEADER.brand, 8),
      date: colIndex(headers, HEADER.date, 12),
    }),
    [headers]
  );

  const years = useMemo(() => {
    const found = new Set<string>();
    for (const r of rows) {
      const { year: y } = parseDate(r[idx.date] ?? "");
      if (y) found.add(y);
    }
    return Array.from(found).sort(compareYearsDesc);
  }, [rows, idx]);

  const yearRows = useMemo(
    () => (year ? rows.filter(r => parseDate(r[idx.date] ?? "").year === year) : rows),
    [rows, idx, year]
  );

  const filters = useGridFilters(headers, yearRows, FILTERS);
  const data = filters.rowsFiltered;

  async function handleLogout() {
    await supabase.auth.signOut();
    router.refresh();
  }

  const m = useMemo(() => {
    const siteOf = (r: string[]) => (r[idx.site] ?? "").trim();
    const isPrecision = (r: string[]) => /precision/i.test(r[idx.acType] ?? "");

    const precision = data.filter(isPrecision).length;
    const comfort = data.length - precision;
    const sites = new Set(data.map(siteOf).filter(Boolean)).size;

    // the year comparison is deliberately over the whole sheet, so it stays a
    // stable reference point while the year and dimension filters move
    const byYear = years
      .slice()
      .sort((a, b) => compareYearsDesc(b, a))
      .map(y => {
        const inYear = rows.filter(r => parseDate(r[idx.date] ?? "").year === y);
        const p = inYear.filter(isPrecision).length;
        return { name: y, "Precision Air": p, "Comfort Air": inYear.length - p };
      });

    const acDonut = [
      { name: "Precision Air", value: precision, color: PRECISION_COLOR },
      { name: "Comfort Air", value: comfort, color: COMFORT_COLOR },
    ].filter(d => d.value > 0);

    const countBy = (get: (r: string[]) => string) => {
      const map = new Map<string, number>();
      for (const r of data) {
        const k = get(r).trim() || "ไม่ระบุ";
        map.set(k, (map.get(k) ?? 0) + 1);
      }
      return Array.from(map, ([name, value]) => ({ name, "งาน CM": value }))
        .sort((a, b) => b["งาน CM"] - a["งาน CM"]);
    };

    const byRegion = countBy(r => r[idx.region] ?? "");
    const byBrand = countBy(r => r[idx.brand] ?? "").slice(0, 12);

    const monthMap = new Map<string, number>();
    for (const r of data) {
      const { key } = parseDate(r[idx.date] ?? "");
      if (key) monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
    }
    const byMonth = Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => ({ name: monthLabel(k), "งาน CM": v }));

    const siteMap = new Map<string, { precision: number; comfort: number }>();
    for (const r of data) {
      const s = siteOf(r);
      if (!s) continue;
      if (!siteMap.has(s)) siteMap.set(s, { precision: 0, comfort: 0 });
      const e = siteMap.get(s)!;
      if (isPrecision(r)) e.precision++;
      else e.comfort++;
    }
    const bySite = Array.from(siteMap, ([name, v]) => ({ name, ...v, total: v.precision + v.comfort }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

    return { precision, comfort, sites, byYear, acDonut, byRegion, byBrand, byMonth, bySite };
  }, [data, rows, years, idx]);

  const axisColor = "#94a3b8";
  const card = "bg-[var(--panel)] border border-[var(--border)] rounded-xl p-5";
  const scopeLabel = year || "ทุกปี";

  const tooltipProps = {
    cursor: false,
    contentStyle: {
      backgroundColor: "var(--panel)",
      border: "1px solid var(--border)",
      borderRadius: "8px",
    },
    labelStyle: { color: "var(--app-text)", fontWeight: 600 },
    itemStyle: { color: "var(--app-text)" },
  };

  // value + percent outside each donut segment (with leader line), so thin
  // slices stay readable
  const donutLabel = (p: {
    cx?: number; cy?: number; midAngle?: number;
    outerRadius?: number; value?: number; percent?: number;
  }) => {
    const RAD = Math.PI / 180;
    const cx = p.cx ?? 0, cy = p.cy ?? 0, midAngle = p.midAngle ?? 0;
    const r = (p.outerRadius ?? 0) + 16;
    const x = cx + r * Math.cos(-midAngle * RAD);
    const y = cy + r * Math.sin(-midAngle * RAD);
    return (
      <text
        x={x}
        y={y}
        fill="var(--app-text)"
        textAnchor={x >= cx ? "start" : "end"}
        dominantBaseline="central"
        fontSize={13}
        fontWeight={700}
      >
        {p.value?.toLocaleString()} ({Math.round((p.percent ?? 0) * 100)}%)
      </text>
    );
  };

  const empty = (
    <div className="text-[var(--text-muted)] text-sm py-16 text-center">ไม่มีข้อมูลตามเงื่อนไขนี้</div>
  );

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]">
      {/* Top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between px-4 py-2 bg-[var(--panel-2)] border-b border-[var(--border)] text-sm">
        <div className="flex items-center gap-4">
          <span className="font-bold text-blue-400">❄️ AC Master Plan 2026 (AMC)</span>
          <button onClick={() => router.push("/dashboard")} className="text-[var(--text-muted)] hover:text-blue-400">Plan</button>
          <button onClick={() => router.push("/insights")} className="text-[var(--text-muted)] hover:text-blue-400">Insights</button>
          <button onClick={() => router.push("/pm-dashboard")} className="text-[var(--text-muted)] hover:text-blue-400">Dashboard PM</button>
          <span className="text-blue-400 font-semibold">Dashboard CM</span>
          <button onClick={() => router.push("/sheet")} className="text-[var(--text-muted)] hover:text-blue-400">PM Results</button>
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

      <div className="max-w-6xl mx-auto p-6">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">Dashboard CM</h1>
            <p className="text-[var(--text-muted)] text-sm">
              สรุปงานแก้ไข (CM) จากข้อมูล CM Result — ดึงสดจาก Google Sheet
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-[var(--text-muted)]">ปีที่ทำ CM:</span>
            <select
              value={year}
              onChange={e => setYear(e.target.value)}
              className="bg-[var(--panel-2)] border border-[var(--border)] text-[var(--app-text)] rounded px-3 py-1.5 focus:outline-none focus:border-blue-500"
            >
              <option value={ALL_YEARS}>ทุกปี</option>
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
        </div>

        {error ? (
          <div className="p-4 rounded border border-red-500/50 bg-red-500/10 text-red-400 text-sm">
            โหลดข้อมูลไม่สำเร็จ: {error}
          </div>
        ) : (
          <div className="space-y-6">
            <div className={card}>
              <FilterBar filters={filters} />
            </div>

            {/* headline numbers */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={card}>
                <div className="text-[var(--text-muted)] text-sm mb-1">งาน CM ({scopeLabel})</div>
                <div className="text-3xl font-bold">{data.length.toLocaleString()}</div>
              </div>
              <div className={card}>
                <div className="text-[var(--text-muted)] text-sm mb-1">จำนวน Site ที่มีงาน CM</div>
                <div className="text-3xl font-bold">{m.sites.toLocaleString()}</div>
              </div>
              <div className={card}>
                <div className="text-sm font-semibold mb-1" style={{ color: PRECISION_COLOR }}>Precision Air</div>
                <div className="text-3xl font-bold" style={{ color: PRECISION_COLOR }}>{m.precision.toLocaleString()}</div>
              </div>
              <div className={card}>
                <div className="text-sm font-semibold mb-1" style={{ color: COMFORT_COLOR }}>Comfort Air</div>
                <div className="text-3xl font-bold" style={{ color: COMFORT_COLOR }}>{m.comfort.toLocaleString()}</div>
              </div>
            </div>

            {/* year comparison + AC type mix */}
            <div className="grid lg:grid-cols-2 gap-4">
              <div className={card}>
                <h2 className="font-semibold mb-1">เปรียบเทียบรายปี</h2>
                <p className="text-[var(--text-muted)] text-xs mb-3">จำนวนงาน CM ทั้งชีต แยกชนิดแอร์ (ไม่ขึ้นกับตัวกรองด้านบน)</p>
                {m.byYear.length === 0 ? empty : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={m.byYear} margin={{ top: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                      <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 12 }} />
                      <YAxis tick={{ fill: axisColor, fontSize: 11 }} allowDecimals={false} />
                      <Tooltip {...tooltipProps} />
                      <Legend />
                      <Bar dataKey="Precision Air" stackId="ac" fill={PRECISION_COLOR} maxBarSize={72}>
                        <LabelList dataKey="Precision Air" position="inside" fill="#ffffff" fontSize={11} fontWeight={600} />
                      </Bar>
                      <Bar dataKey="Comfort Air" stackId="ac" fill={COMFORT_COLOR} radius={[4, 4, 0, 0]} maxBarSize={72}>
                        <LabelList dataKey="Comfort Air" position="inside" fill="#1f2937" fontSize={11} fontWeight={600} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className={card}>
                <h2 className="font-semibold mb-1">สัดส่วนชนิดแอร์ ({scopeLabel})</h2>
                <p className="text-[var(--text-muted)] text-xs mb-3">Precision Air เทียบกับ Comfort Air</p>
                {m.acDonut.length === 0 ? empty : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart margin={{ top: 10, right: 60, bottom: 10, left: 60 }}>
                      <Pie data={m.acDonut} dataKey="value" nameKey="name" cx="50%" cy="47%" innerRadius={58} outerRadius={88} paddingAngle={2} label={donutLabel} labelLine>
                        {m.acDonut.map((d, i) => <Cell key={i} fill={d.color} stroke="var(--panel)" strokeWidth={2} />)}
                      </Pie>
                      <Tooltip {...tooltipProps} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* monthly trend */}
            <div className={card}>
              <h2 className="font-semibold mb-1">แนวโน้มรายเดือน ({scopeLabel})</h2>
              <p className="text-[var(--text-muted)] text-xs mb-3">นับตามวันที่ทำ CM</p>
              {m.byMonth.length === 0 ? empty : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={m.byMonth} margin={{ top: 20, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 11 }} minTickGap={8} />
                    <YAxis tick={{ fill: axisColor, fontSize: 11 }} allowDecimals={false} />
                    <Tooltip {...tooltipProps} />
                    <Line
                      type="monotone"
                      dataKey="งาน CM"
                      stroke={ACCENT_COLOR}
                      strokeWidth={2}
                      dot={{ r: 4, fill: ACCENT_COLOR, stroke: "var(--panel)", strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    >
                      {/* labels only while they still fit — the tooltip carries the rest */}
                      {m.byMonth.length <= 14 && (
                        <LabelList dataKey="งาน CM" position="top" fill="var(--app-text)" fontSize={11} />
                      )}
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* region + brand */}
            <div className="grid lg:grid-cols-2 gap-4">
              <div className={card}>
                <h2 className="font-semibold mb-1">ตาม Region ({scopeLabel})</h2>
                <p className="text-[var(--text-muted)] text-xs mb-3">จำนวนงาน CM แต่ละภูมิภาค</p>
                {m.byRegion.length === 0 ? empty : (
                  <ResponsiveContainer width="100%" height={Math.max(220, m.byRegion.length * 30 + 40)}>
                    <BarChart data={m.byRegion} layout="vertical" margin={{ top: 4, right: 44, left: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: axisColor, fontSize: 11 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={92} tick={{ fill: axisColor, fontSize: 11 }} />
                      <Tooltip {...tooltipProps} />
                      <Bar dataKey="งาน CM" fill={ACCENT_COLOR} radius={[0, 4, 4, 0]} barSize={14}>
                        <LabelList dataKey="งาน CM" position="right" fill="var(--app-text)" fontSize={11} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className={card}>
                <h2 className="font-semibold mb-1">ตามยี่ห้อ ({scopeLabel})</h2>
                <p className="text-[var(--text-muted)] text-xs mb-3">ยี่ห้อที่มีงาน CM มากที่สุด (สูงสุด 12 อันดับ)</p>
                {m.byBrand.length === 0 ? empty : (
                  <ResponsiveContainer width="100%" height={Math.max(220, m.byBrand.length * 30 + 40)}>
                    <BarChart data={m.byBrand} layout="vertical" margin={{ top: 4, right: 44, left: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: axisColor, fontSize: 11 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={92} tick={{ fill: axisColor, fontSize: 11 }} />
                      <Tooltip {...tooltipProps} />
                      <Bar dataKey="งาน CM" fill={ACCENT_COLOR} radius={[0, 4, 4, 0]} barSize={14}>
                        <LabelList dataKey="งาน CM" position="right" fill="var(--app-text)" fontSize={11} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* per-site detail */}
            <div className={card}>
              <h2 className="font-semibold mb-1">รายละเอียดตาม Site ({scopeLabel})</h2>
              <p className="text-[var(--text-muted)] text-xs mb-3">จำนวนงาน CM แยกตามชนิดแอร์ เรียงจากมากไปน้อย</p>
              {m.bySite.length === 0 ? empty : (
                <div className="overflow-auto max-h-[460px] border border-[var(--border)] rounded-lg">
                  <table className="w-full text-xs border-collapse">
                    <thead className="sticky top-0">
                      <tr className="bg-blue-600 text-white">
                        <th className="text-left px-2 py-1.5">Site</th>
                        <th className="px-2 py-1.5 text-right">Precision</th>
                        <th className="px-2 py-1.5 text-right">Comfort</th>
                        <th className="px-2 py-1.5 text-right">รวม</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.bySite.map(s => (
                        <tr key={s.name} className="border-t border-[var(--border)]">
                          <td className="px-2 py-1 whitespace-nowrap">{s.name}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{s.precision || ""}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{s.comfort || ""}</td>
                          <td className="px-2 py-1 text-right tabular-nums font-semibold">{s.total.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-[var(--border)] bg-[var(--panel-2)] font-semibold">
                        <td className="px-2 py-1.5">รวมทั้งหมด</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{m.precision.toLocaleString()}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{m.comfort.toLocaleString()}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{data.length.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
