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

type Round = 1 | 2 | 3;

const YEAR = "2026";
const ROUNDS: Round[] = [1, 2, 3];

/** รอบที่ 3 ทำเฉพาะสองไซต์นี้ — รอบอื่นครอบคลุมทุกไซต์ */
const ROUND3_SITES = ["TOC-RST", "TOC-SNK"];

const ROUND_COLORS = ["#3b82f6", "#22c55e", "#8b5cf6"];
const PRECISION_COLOR = "#3b82f6";
const COMFORT_COLOR = "#f59e0b";

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/** Column position by header name, falling back to a fixed index if renamed. */
function colIndex(headers: string[], header: string, fallback: number) {
  const i = headers.findIndex(h => norm(h) === norm(header));
  return i >= 0 ? i : fallback;
}

const HEADER = {
  site: "Site",
  round: "แบบบันทึกผลการบำรุงรักษาเครื่องปรับอากาศ (Precision Air) ครั้งที่",
  date: "วันที่ทำ PM",
  acType: "แอร์ชนิด",
  region: "Region1",
};

const FILTERS: FilterSpec[] = [
  { key: "site", label: "Site", header: HEADER.site, fallback: 1 },
  { key: "region1", label: "Region1", header: HEADER.region, fallback: 39 },
  { key: "acType", label: "แอร์ชนิด", header: HEADER.acType, fallback: 38 },
];

/** "PM ครั้งที่ 2/2026" → 2 (null for any other year or an unparsable cell). */
function roundOf(raw: string): number | null {
  const m = raw.match(/(\d+)\s*\/\s*(\d{4})/);
  return m && m[2] === YEAR ? Number(m[1]) : null;
}

/** "25/6/2026" → "2026-06" (dates arrive as d/m/yyyy). */
function monthKeyOf(raw: string): string {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${String(Number(m[2])).padStart(2, "0")}` : "";
}

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const monthLabel = (key: string) => {
  const [y, mm] = key.split("-");
  return `${TH_MONTHS[Number(mm) - 1]} ${y.slice(2)}`;
};

export default function PmDashboardClient({
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
  const [round, setRound] = useState<Round>(1);

  const idx = useMemo(
    () => ({
      site: colIndex(headers, HEADER.site, 1),
      round: colIndex(headers, HEADER.round, 2),
      date: colIndex(headers, HEADER.date, 7),
      acType: colIndex(headers, HEADER.acType, 38),
      region: colIndex(headers, HEADER.region, 39),
    }),
    [headers]
  );

  // rows for the selected round, narrowed to that round's site scope
  const roundRows = useMemo(() => {
    const scope = round === 3 ? ROUND3_SITES : null;
    return rows.filter(r => {
      if (roundOf(r[idx.round] ?? "") !== round) return false;
      return !scope || scope.includes((r[idx.site] ?? "").trim());
    });
  }, [rows, idx, round]);

  const filters = useGridFilters(headers, roundRows, FILTERS);
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
    const sitesDone = new Set(data.map(siteOf).filter(Boolean)).size;
    const scopeSites =
      round === 3 ? ROUND3_SITES.length : new Set(rows.map(siteOf).filter(Boolean)).size;

    // the round comparison is deliberately over the whole sheet, so it stays a
    // stable reference point while the dimension filters move
    const byRound = ROUNDS.map(rd => ({
      name: `ครั้งที่ ${rd}/${YEAR}`,
      "รายการ PM": rows.filter(r => roundOf(r[idx.round] ?? "") === rd).length,
    }));

    const acDonut = [
      { name: "Precision Air", value: precision, color: PRECISION_COLOR },
      { name: "Comfort Air", value: comfort, color: COMFORT_COLOR },
    ].filter(d => d.value > 0);

    const regionMap = new Map<string, number>();
    for (const r of data) {
      const k = (r[idx.region] ?? "").trim() || "ไม่ระบุ";
      regionMap.set(k, (regionMap.get(k) ?? 0) + 1);
    }
    const byRegion = Array.from(regionMap, ([name, value]) => ({ name, "รายการ PM": value }))
      .sort((a, b) => b["รายการ PM"] - a["รายการ PM"]);

    const monthMap = new Map<string, number>();
    for (const r of data) {
      const k = monthKeyOf(r[idx.date] ?? "");
      if (k) monthMap.set(k, (monthMap.get(k) ?? 0) + 1);
    }
    const byMonth = Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => ({ name: monthLabel(k), "รายการ PM": v }));

    // sites in scope always appear, so a round with no results yet still lists them
    const siteMap = new Map<string, { precision: number; comfort: number }>();
    if (round === 3) ROUND3_SITES.forEach(s => siteMap.set(s, { precision: 0, comfort: 0 }));
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

    return { precision, comfort, sitesDone, scopeSites, byRound, acDonut, byRegion, byMonth, bySite };
  }, [data, rows, idx, round]);

  const axisColor = "#94a3b8";
  const card = "bg-[var(--panel)] border border-[var(--border)] rounded-xl p-5";

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
    <div className="text-[var(--text-muted)] text-sm py-16 text-center">ยังไม่มีข้อมูลในรอบนี้</div>
  );

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]">
      {/* Top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between px-4 py-2 bg-[var(--panel-2)] border-b border-[var(--border)] text-sm">
        <div className="flex items-center gap-4">
          <span className="font-bold text-blue-400">❄️ AC Master Plan 2026 (AMC)</span>
          <button onClick={() => router.push("/dashboard")} className="text-[var(--text-muted)] hover:text-blue-400">Plan</button>
          <button onClick={() => router.push("/insights")} className="text-[var(--text-muted)] hover:text-blue-400">Insights</button>
          <span className="text-blue-400 font-semibold">Dashboard PM</span>
          <button onClick={() => router.push("/cm-dashboard")} className="text-[var(--text-muted)] hover:text-blue-400">Dashboard CM</button>
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
            <h1 className="text-2xl font-bold mb-1">Dashboard PM</h1>
            <p className="text-[var(--text-muted)] text-sm">
              สรุปผลการบำรุงรักษา (PM) จากข้อมูล PM Result — ดึงสดจาก Google Sheet
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-[var(--text-muted)]">รอบ PM:</span>
            <select
              value={round}
              onChange={e => setRound(Number(e.target.value) as Round)}
              className="bg-[var(--panel-2)] border border-[var(--border)] text-[var(--app-text)] rounded px-3 py-1.5 focus:outline-none focus:border-blue-500"
            >
              {ROUNDS.map(r => (
                <option key={r} value={r}>PM ครั้งที่ {r}/{YEAR}</option>
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
            {round === 3 && (
              <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm text-blue-400">
                รอบที่ 3/{YEAR} มีเฉพาะไซต์ {ROUND3_SITES.join(" และ ")} เท่านั้น
              </div>
            )}

            <div className={card}>
              <FilterBar filters={filters} />
            </div>

            {/* headline numbers */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={card}>
                <div className="text-[var(--text-muted)] text-sm mb-1">รายการ PM (ครั้งที่ {round}/{YEAR})</div>
                <div className="text-3xl font-bold">{data.length.toLocaleString()}</div>
              </div>
              <div className={card}>
                <div className="text-[var(--text-muted)] text-sm mb-1">จำนวน Site ที่มีผล PM</div>
                <div className="text-3xl font-bold">
                  {m.sitesDone.toLocaleString()}
                  <span className="text-base text-[var(--text-muted)] font-normal"> / {m.scopeSites.toLocaleString()}</span>
                </div>
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

            {/* round comparison + AC type mix */}
            <div className="grid lg:grid-cols-2 gap-4">
              <div className={card}>
                <h2 className="font-semibold mb-1">เปรียบเทียบทุกรอบ</h2>
                <p className="text-[var(--text-muted)] text-xs mb-3">จำนวนรายการ PM ทั้งชีต (ไม่ขึ้นกับตัวกรองด้านบน)</p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={m.byRound} margin={{ top: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 12 }} />
                    <YAxis tick={{ fill: axisColor, fontSize: 11 }} allowDecimals={false} />
                    <Tooltip {...tooltipProps} />
                    <Bar dataKey="รายการ PM" radius={[4, 4, 0, 0]} maxBarSize={80}>
                      {m.byRound.map((_, i) => <Cell key={i} fill={ROUND_COLORS[i]} />)}
                      <LabelList dataKey="รายการ PM" position="top" fill="var(--app-text)" fontSize={12} fontWeight={600} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className={card}>
                <h2 className="font-semibold mb-1">สัดส่วนชนิดแอร์ (ครั้งที่ {round}/{YEAR})</h2>
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
              <h2 className="font-semibold mb-1">แนวโน้มรายเดือน (ครั้งที่ {round}/{YEAR})</h2>
              <p className="text-[var(--text-muted)] text-xs mb-3">นับตามวันที่ทำ PM</p>
              {m.byMonth.length === 0 ? empty : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={m.byMonth} margin={{ top: 20, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 11 }} />
                    <YAxis tick={{ fill: axisColor, fontSize: 11 }} allowDecimals={false} />
                    <Tooltip {...tooltipProps} />
                    <Line
                      type="monotone"
                      dataKey="รายการ PM"
                      stroke={ROUND_COLORS[round - 1]}
                      strokeWidth={2}
                      dot={{ r: 4, fill: ROUND_COLORS[round - 1], stroke: "var(--panel)", strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    >
                      <LabelList dataKey="รายการ PM" position="top" fill="var(--app-text)" fontSize={11} />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* region + per-site detail */}
            <div className="grid lg:grid-cols-2 gap-4">
              <div className={card}>
                <h2 className="font-semibold mb-1">ตาม Region (ครั้งที่ {round}/{YEAR})</h2>
                <p className="text-[var(--text-muted)] text-xs mb-3">จำนวนรายการ PM แต่ละภูมิภาค</p>
                {m.byRegion.length === 0 ? empty : (
                  <ResponsiveContainer width="100%" height={Math.max(240, m.byRegion.length * 28 + 40)}>
                    <BarChart data={m.byRegion} layout="vertical" margin={{ top: 4, right: 40, left: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: axisColor, fontSize: 11 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={132} tick={{ fill: axisColor, fontSize: 11 }} />
                      <Tooltip {...tooltipProps} />
                      <Bar dataKey="รายการ PM" fill={PRECISION_COLOR} radius={[0, 4, 4, 0]} barSize={14}>
                        <LabelList dataKey="รายการ PM" position="right" fill="var(--app-text)" fontSize={11} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className={card}>
                <h2 className="font-semibold mb-1">รายละเอียดตาม Site (ครั้งที่ {round}/{YEAR})</h2>
                <p className="text-[var(--text-muted)] text-xs mb-3">จำนวนรายการ PM แยกตามชนิดแอร์</p>
                {m.bySite.length === 0 ? empty : (
                  <div className="overflow-auto max-h-[420px] border border-[var(--border)] rounded-lg">
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
          </div>
        )}
      </div>
    </div>
  );
}
