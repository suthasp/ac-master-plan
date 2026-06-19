"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";

interface Site {
  id: string;
  name: string;
  ac_count: number;
  ac_type: string;
  site_type: string | null;
}
interface PlanEntry {
  site_id: string;
  week_number: number;
  status: "P" | "F" | "D";
}

const MONTHS = [
  { name: "Jan", weeks: [1, 2, 3, 4, 5] },
  { name: "Feb", weeks: [6, 7, 8, 9] },
  { name: "Mar", weeks: [10, 11, 12, 13] },
  { name: "Apr", weeks: [14, 15, 16, 17, 18] },
  { name: "May", weeks: [19, 20, 21, 22] },
  { name: "Jun", weeks: [23, 24, 25, 26, 27] },
  { name: "Jul", weeks: [28, 29, 30, 31] },
  { name: "Aug", weeks: [32, 33, 34, 35] },
  { name: "Sep", weeks: [36, 37, 38, 39, 40] },
  { name: "Oct", weeks: [41, 42, 43, 44] },
  { name: "Nov", weeks: [45, 46, 47, 48] },
  { name: "Dec", weeks: [49, 50, 51, 52] },
];

const COLORS = { P: "#9ca3af", F: "#22c55e", D: "#ef4444" };

export default function InsightsClient({
  userEmail,
  isLoggedIn,
}: {
  userEmail: string;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [sites, setSites] = useState<Site[]>([]);
  const [entries, setEntries] = useState<PlanEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [s, e] = await Promise.all([fetch("/api/sites"), fetch("/api/entries")]);
      setSites(await s.json());
      setEntries(await e.json());
      setLoading(false);
    })();
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.refresh();
  }, [supabase, router]);

  const m = useMemo(() => {
    const totalSites = sites.length;
    const totalAC = sites.reduce((s, r) => s + (Number(r.ac_count) || 0), 0);
    const P = entries.filter(e => e.status === "P").length;
    const F = entries.filter(e => e.status === "F").length;
    const D = entries.filter(e => e.status === "D").length;
    const scheduled = P + F + D;
    const pctComplete = scheduled ? Math.round((F / scheduled) * 100) : 0;
    const pctDelayed = scheduled ? Math.round((D / scheduled) * 100) : 0;

    const statusData = [
      { name: "Planned", value: P, color: COLORS.P },
      { name: "Finished", value: F, color: COLORS.F },
      { name: "Delayed", value: D, color: COLORS.D },
    ].filter(d => d.value > 0);

    const byMonth = MONTHS.map(month => {
      const wk = new Set(month.weeks);
      const inMonth = entries.filter(e => wk.has(e.week_number));
      return {
        name: month.name,
        Planned: inMonth.filter(e => e.status === "P").length,
        Finished: inMonth.filter(e => e.status === "F").length,
        Delayed: inMonth.filter(e => e.status === "D").length,
      };
    });

    const acBySiteType = ["Big", "Medium"].map(t => ({
      name: t,
      AC: sites.filter(s => (s.site_type ?? "") === t).reduce((a, s) => a + (Number(s.ac_count) || 0), 0),
    }));
    const acByType = ["Precision", "Comfort"].map(t => ({
      name: t,
      AC: sites.filter(s => s.ac_type === t).reduce((a, s) => a + (Number(s.ac_count) || 0), 0),
    }));

    return { totalSites, totalAC, pctComplete, pctDelayed, statusData, byMonth, acBySiteType, acByType };
  }, [sites, entries]);

  const axisColor = "#94a3b8";
  const card = "bg-[var(--panel)] border border-[var(--border)] rounded-xl p-5";

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--panel-2)] border-b border-[var(--border)] text-sm">
        <div className="flex items-center gap-4">
          <span className="font-bold text-blue-400">❄️ AC Master Plan (AMC)</span>
          <button onClick={() => router.push("/dashboard")} className="text-[var(--text-muted)] hover:text-blue-400">Plan</button>
          <span className="text-blue-400 font-semibold">Insights</span>
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

      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-1">Insights</h1>
        <p className="text-[var(--text-muted)] text-sm mb-6">ภาพรวมแผนติดตั้งแอร์ทั้งหมด — สรุปสถานะ ความคืบหน้า และการกระจายตามประเภท</p>

        {loading ? (
          <div className="text-[var(--text-muted)] py-20 text-center">กำลังโหลดข้อมูล...</div>
        ) : (
          <div className="space-y-6">
            {/* metric cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={card}>
                <div className="text-[var(--text-muted)] text-sm mb-1">จำนวน Site</div>
                <div className="text-3xl font-bold">{m.totalSites}</div>
              </div>
              <div className={card}>
                <div className="text-[var(--text-muted)] text-sm mb-1">จำนวนแอร์ทั้งหมด</div>
                <div className="text-3xl font-bold">{m.totalAC.toLocaleString()}</div>
              </div>
              <div className={card}>
                <div className="text-green-500 text-sm font-semibold mb-1">Percent Complete</div>
                <div className="text-3xl font-bold text-green-500">{m.pctComplete}<span className="text-lg">%</span></div>
              </div>
              <div className={card}>
                <div className="text-red-500 text-sm font-semibold mb-1">Delayed</div>
                <div className="text-3xl font-bold text-red-500">{m.pctDelayed}<span className="text-lg">%</span></div>
              </div>
            </div>

            {/* donut + monthly */}
            <div className="grid lg:grid-cols-2 gap-4">
              <div className={card}>
                <h2 className="font-semibold mb-3">สรุปสถานะ (Status Breakdown)</h2>
                {m.statusData.length === 0 ? (
                  <div className="text-[var(--text-muted)] text-sm py-16 text-center">ยังไม่มีข้อมูลสถานะ</div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={m.statusData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                        {m.statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className={card}>
                <h2 className="font-semibold mb-3">ความคืบหน้ารายเดือน</h2>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={m.byMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 11 }} />
                    <YAxis tick={{ fill: axisColor, fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Planned" fill={COLORS.P} stackId="a" />
                    <Bar dataKey="Finished" fill={COLORS.F} stackId="a" />
                    <Bar dataKey="Delayed" fill={COLORS.D} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* AC by type */}
            <div className="grid lg:grid-cols-2 gap-4">
              <div className={card}>
                <h2 className="font-semibold mb-3">จำนวนแอร์ตาม Site Type</h2>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={m.acBySiteType}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 11 }} />
                    <YAxis tick={{ fill: axisColor, fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="AC" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className={card}>
                <h2 className="font-semibold mb-3">จำนวนแอร์ตาม Type</h2>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={m.acByType}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 11 }} />
                    <YAxis tick={{ fill: axisColor, fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="AC" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
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
