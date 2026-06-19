"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";

interface Site {
  id: string;
  name: string;
  ac_count: number;
  ac_type: string;
  site_type: string | null;
  source_1: string | null;
  source_2: string | null;
  source_3: string | null;
}

type Round = 1 | 2 | 3;
const ROUND_COLORS = ["#3b82f6", "#22c55e", "#8b5cf6"];
const DONE_COLOR = "#22c55e";
const REMAIN_COLOR = "#9ca3af";

export default function InsightsClient({
  userEmail,
  isLoggedIn,
  isAdmin,
}: {
  userEmail: string;
  isLoggedIn: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [round, setRound] = useState<Round>(1);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/sites");
      setSites(await res.json());
      setLoading(false);
    })();
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.refresh();
  }, [supabase, router]);

  const m = useMemo(() => {
    const field = `source_${round}` as "source_1" | "source_2" | "source_3";
    const doneOf = (s: Site) => Number(s[field]) || 0;

    const totalAC = sites.reduce((a, s) => a + (Number(s.ac_count) || 0), 0);
    const doneAC = sites.reduce((a, s) => a + doneOf(s), 0);
    const remaining = Math.max(totalAC - doneAC, 0);
    const pct = totalAC ? Math.round((doneAC / totalAC) * 100) : 0;

    const donut = [
      { name: "ทำแล้ว", value: doneAC, color: DONE_COLOR },
      { name: "คงเหลือ", value: remaining, color: REMAIN_COLOR },
    ].filter(d => d.value > 0);

    // overview across all rounds
    const allRounds = ([1, 2, 3] as Round[]).map(r => {
      const f = `source_${r}` as "source_1" | "source_2" | "source_3";
      return {
        name: `รอบ ${r}`,
        "ทำแล้ว": sites.reduce((a, s) => a + (Number(s[f]) || 0), 0),
      };
    });

    const group = (key: "site_type" | "ac_type", values: string[]) =>
      values.map(v => {
        const inGroup = sites.filter(s => (key === "site_type" ? (s.site_type ?? "") : s.ac_type) === v);
        return {
          name: v,
          "ทั้งหมด": inGroup.reduce((a, s) => a + (Number(s.ac_count) || 0), 0),
          "ทำแล้ว": inGroup.reduce((a, s) => a + doneOf(s), 0),
        };
      });

    return {
      totalAC, doneAC, remaining, pct, donut, allRounds,
      bySiteType: group("site_type", ["Big", "Medium"]),
      byAcType: group("ac_type", ["Precision", "Comfort"]),
    };
  }, [sites, round]);

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

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]">
      {/* Top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between px-4 py-2 bg-[var(--panel-2)] border-b border-[var(--border)] text-sm">
        <div className="flex items-center gap-4">
          <span className="font-bold text-blue-400">❄️ AC Master Plan 2026 (AMC)</span>
          <button onClick={() => router.push("/dashboard")} className="text-[var(--text-muted)] hover:text-blue-400">Plan</button>
          <span className="text-blue-400 font-semibold">Insights</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {isLoggedIn ? (
            <>
              <span className="text-[var(--text-muted)] text-xs hidden sm:inline">
                {userEmail} <span className="text-blue-400">({isAdmin ? "admin" : "viewer"})</span>
              </span>
              <button onClick={handleLogout} className="text-red-400 hover:text-red-300">Logout</button>
            </>
          ) : (
            <button onClick={() => router.push("/login")} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-0.5 rounded">Login</button>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-1">Insights</h1>
            <p className="text-[var(--text-muted)] text-sm">ความคืบหน้า PM ตามจำนวนแอร์ — แอร์ทั้งหมดเทียบกับที่ทำแล้วในแต่ละรอบ</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-[var(--text-muted)]">ดูรอบ PM:</span>
            <select
              value={round}
              onChange={e => setRound(Number(e.target.value) as Round)}
              className="bg-[var(--panel-2)] border border-[var(--border)] text-[var(--app-text)] rounded px-3 py-1.5 focus:outline-none focus:border-blue-500"
            >
              <option value={1}>รอบที่ 1</option>
              <option value={2}>รอบที่ 2</option>
              <option value={3}>รอบที่ 3</option>
            </select>
          </label>
        </div>

        {loading ? (
          <div className="text-[var(--text-muted)] py-20 text-center">กำลังโหลดข้อมูล...</div>
        ) : (
          <div className="space-y-6">
            {/* metric cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <div className={card}>
                <div className="text-[var(--text-muted)] text-sm mb-1">จำนวนแอร์ทั้งหมด</div>
                <div className="text-3xl font-bold">{m.totalAC.toLocaleString()}</div>
              </div>
              <div className={card}>
                <div className="text-green-500 text-sm font-semibold mb-1">ทำแล้ว (รอบที่ {round})</div>
                <div className="text-3xl font-bold text-green-500">
                  {m.doneAC.toLocaleString()}
                  <span className="text-base text-[var(--text-muted)] font-normal"> / {m.totalAC.toLocaleString()}</span>
                </div>
              </div>
              <div className={card}>
                <div className="text-blue-500 text-sm font-semibold mb-1">Percent Complete (รอบที่ {round})</div>
                <div className="text-3xl font-bold text-blue-500">{m.pct}<span className="text-lg">%</span></div>
              </div>
            </div>

            {/* donut + all rounds overview */}
            <div className="grid lg:grid-cols-2 gap-4">
              <div className={card}>
                <h2 className="font-semibold mb-3">ทำแล้ว vs คงเหลือ (รอบที่ {round})</h2>
                {m.donut.length === 0 ? (
                  <div className="text-[var(--text-muted)] text-sm py-16 text-center">ยังไม่มีข้อมูล</div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={m.donut} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                        {m.donut.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip {...tooltipProps} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className={card}>
                <h2 className="font-semibold mb-3">ภาพรวมทุกรอบ (จำนวนแอร์ที่ทำแล้ว)</h2>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={m.allRounds}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 12 }} />
                    <YAxis tick={{ fill: axisColor, fontSize: 11 }} allowDecimals={false} />
                    <Tooltip {...tooltipProps} />
                    <Bar dataKey="ทำแล้ว" radius={[4, 4, 0, 0]}>
                      {m.allRounds.map((_, i) => <Cell key={i} fill={ROUND_COLORS[i]} />)}
                      <LabelList dataKey="ทำแล้ว" position="top" fill="var(--app-text)" fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* by type (done vs total for selected round) */}
            <div className="grid lg:grid-cols-2 gap-4">
              <div className={card}>
                <h2 className="font-semibold mb-3">ตาม Site Type (รอบที่ {round})</h2>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={m.bySiteType}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 12 }} />
                    <YAxis tick={{ fill: axisColor, fontSize: 11 }} allowDecimals={false} />
                    <Tooltip {...tooltipProps} />
                    <Legend />
                    <Bar dataKey="ทั้งหมด" fill={REMAIN_COLOR} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="ทั้งหมด" position="top" fill="var(--app-text)" fontSize={11} />
                    </Bar>
                    <Bar dataKey="ทำแล้ว" fill={DONE_COLOR} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="ทำแล้ว" position="top" fill="var(--app-text)" fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className={card}>
                <h2 className="font-semibold mb-3">ตาม Type (รอบที่ {round})</h2>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={m.byAcType}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 12 }} />
                    <YAxis tick={{ fill: axisColor, fontSize: 11 }} allowDecimals={false} />
                    <Tooltip {...tooltipProps} />
                    <Legend />
                    <Bar dataKey="ทั้งหมด" fill={REMAIN_COLOR} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="ทั้งหมด" position="top" fill="var(--app-text)" fontSize={11} />
                    </Bar>
                    <Bar dataKey="ทำแล้ว" fill={DONE_COLOR} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="ทำแล้ว" position="top" fill="var(--app-text)" fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
