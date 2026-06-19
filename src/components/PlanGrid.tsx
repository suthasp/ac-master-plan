"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type {
  ColDef,
  ColGroupDef,
  CellClickedEvent,
  CellValueChangedEvent,
  GetRowIdParams,
} from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

// ── Types ────────────────────────────────────────────────────────────────────

export interface Site {
  id: string;
  name: string;
  ac_count: number;
  ac_type: string;
  source_1: string | null;
  source_2: string | null;
  source_3: string | null;
}

export interface PlanEntry {
  site_id: string;
  year: number;
  week_number: number;
  status: "P" | "F" | "D";
}

interface RowData extends Site {
  [key: string]: unknown; // week columns like "wk_1", "wk_2" ...
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = [
  { name: "Jan", weeks: [1, 2, 3, 4] },
  { name: "Feb", weeks: [5, 6, 7, 8] },
  { name: "Mar", weeks: [9, 10, 11, 12, 13] },
  { name: "Apr", weeks: [14, 15, 16, 17] },
  { name: "May", weeks: [18, 19, 20, 21, 22] },
  { name: "Jun", weeks: [23, 24, 25, 26, 27] },
  { name: "Jul", weeks: [28, 29, 30, 31] },
  { name: "Aug", weeks: [32, 33, 34, 35] },
  { name: "Sep", weeks: [36, 37, 38, 39, 40] },
  { name: "Oct", weeks: [41, 42, 43, 44] },
  { name: "Nov", weeks: [45, 46, 47, 48] },
  { name: "Dec", weeks: [49, 50, 51, 52] },
];

function getCurrentWeek(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7);
}

const STATUS_CYCLE: Record<string, string> = { "": "P", P: "F", F: "D", D: "" };

function cellClass(status: string, week: number, currentWeek: number) {
  const classes: string[] = [];
  if (status === "P") classes.push("cell-planned");
  else if (status === "F") classes.push("cell-finished");
  else if (status === "D") classes.push("cell-delayed");
  if (week === currentWeek) classes.push("cell-current-week");
  return classes.join(" ");
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  year?: number;
  isAdmin?: boolean;
  isLoggedIn?: boolean;
}

export default function PlanGrid({ year = 2026, isAdmin = false, isLoggedIn = false }: Props) {
  const gridRef = useRef<AgGridReact<RowData>>(null);
  const [rowData, setRowData] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState("");
  const [saving, setSaving] = useState(false);
  const currentWeek = useMemo(() => getCurrentWeek(), []);

  // ── Add-site modal form ───────────────────────────────────────────────────────
  const emptyForm = { name: "", ac_count: "", ac_type: "Precision", source_1: "", source_2: "", source_3: "" };
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);

  // ── Fetch data ──────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    const [sitesRes, entriesRes] = await Promise.all([
      fetch("/api/sites"),
      fetch("/api/entries"),
    ]);
    const sites: Site[] = await sitesRes.json();
    const entries: PlanEntry[] = await entriesRes.json();

    const entryMap: Record<string, string> = {};
    entries.forEach(e => {
      entryMap[`${e.site_id}_${e.week_number}`] = e.status;
    });

    const rows: RowData[] = sites.map(site => {
      const row: RowData = { ...site };
      for (let w = 1; w <= 52; w++) {
        row[`wk_${w}`] = entryMap[`${site.id}_${w}`] ?? "";
      }
      return row;
    });

    setRowData(rows);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Cell click cycle ────────────────────────────────────────────────────────
  const onCellClicked = useCallback(async (e: CellClickedEvent<RowData>) => {
    if (!isLoggedIn) return; // view-only for anonymous visitors
    const field = e.colDef.field;
    if (!field?.startsWith("wk_")) return;

    const week = parseInt(field.replace("wk_", ""));
    const current = (e.value as string) ?? "";
    const next = STATUS_CYCLE[current] ?? "";
    const siteId = (e.data as RowData).id as string;

    // optimistic update
    const node = e.node;
    node.setDataValue(field, next);

    setSaving(true);
    try {
      await fetch("/api/entries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_id: siteId, year, week_number: week, status: next }),
      });
    } catch {
      node.setDataValue(field, current); // rollback
    } finally {
      setSaving(false);
    }
  }, [year, isLoggedIn]);

  // ── Edit site field (admin inline edit) ──────────────────────────────────────
  const onCellValueChanged = useCallback(async (e: CellValueChangedEvent<RowData>) => {
    const field = e.colDef.field;
    if (!field || field.startsWith("wk_")) return; // week status handled by onCellClicked
    const row = e.data;
    if (row.id === "__summary__" || e.oldValue === e.newValue) return;

    setSaving(true);
    try {
      const res = await fetch("/api/sites", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, [field]: e.newValue }),
      });
      if (!res.ok) throw new Error("update failed");
    } catch {
      e.node.setDataValue(field, e.oldValue); // rollback
    } finally {
      setSaving(false);
    }
  }, []);

  // ── Add row (modal form) ──────────────────────────────────────────────────────
  const openAdd = useCallback(() => {
    setForm(emptyForm);
    setShowAdd(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submitAdd = useCallback(async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          ac_count: parseInt(form.ac_count, 10) || 0,
          ac_type: form.ac_type,
          source_1: form.source_1.trim() || null,
          source_2: form.source_2.trim() || null,
          source_3: form.source_3.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("add failed");
      const newSite: Site = await res.json();
      const newRow: RowData = { ...newSite };
      for (let w = 1; w <= 52; w++) newRow[`wk_${w}`] = "";
      setRowData(prev => [...prev, newRow]);
      setShowAdd(false);
    } catch {
      alert("Failed to add site");
    } finally {
      setSaving(false);
    }
  }, [form]);

  // ── Delete row ──────────────────────────────────────────────────────────────
  const deleteRow = useCallback(async (id: string, name: string) => {
    if (!confirm(`Delete site "${name}"? This also removes all its plan entries.`)) return;

    // optimistic removal
    setRowData(prev => prev.filter(r => r.id !== id));
    try {
      const res = await fetch("/api/sites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("delete failed");
    } catch {
      fetchData(); // reload to restore on failure
    }
  }, [fetchData]);

  // ── Export ──────────────────────────────────────────────────────────────────
  const exportCsv = useCallback(() => {
    gridRef.current?.api.exportDataAsCsv({ fileName: `ac-plan-${year}.csv` });
  }, [year]);

  // ── Column definitions ──────────────────────────────────────────────────────
  const columnDefs = useMemo<(ColDef | ColGroupDef)[]>(() => {
    // site fields are editable only for admins (never the SUMMARY row)
    const siteEditable = (p: { data?: RowData }) =>
      isAdmin && p.data?.id !== "__summary__";

    const pinned: ColDef[] = [
      ...(isAdmin
        ? [{
            headerName: "",
            colId: "__delete__",
            pinned: "left" as const,
            width: 36,
            sortable: false,
            filter: false,
            resizable: false,
            suppressMenu: true,
            cellStyle: { padding: "0", textAlign: "center" },
            cellRenderer: (p: { data?: RowData }) =>
              p.data && p.data.id !== "__summary__" ? (
                <button
                  onClick={() => deleteRow(p.data!.id as string, p.data!.name)}
                  title="Delete site"
                  className="text-red-400 hover:text-red-600 leading-none"
                >
                  ✕
                </button>
              ) : null,
          } as ColDef]
        : []),
      { field: "name", headerName: "Site", pinned: "left", width: 160, cellStyle: { fontWeight: 600 }, editable: siteEditable },
      { field: "ac_count", headerName: "จำนวนทั้งหมด", pinned: "left", width: 100, type: "numericColumn", editable: siteEditable,
        valueParser: p => parseInt(p.newValue, 10) || 0 },
      { field: "ac_type", headerName: "Type", pinned: "left", width: 100, editable: siteEditable,
        cellEditor: "agSelectCellEditor", cellEditorParams: { values: ["Precision", "Comfort"] } },
      { field: "source_1", headerName: "รอบที่ 1", pinned: "left", width: 100, editable: siteEditable },
      { field: "source_2", headerName: "รอบที่ 2", pinned: "left", width: 100, editable: siteEditable },
      { field: "source_3", headerName: "รอบที่ 3", pinned: "left", width: 100, editable: siteEditable },
    ];

    const monthGroups: ColGroupDef[] = MONTHS.map(month => ({
      headerName: month.name,
      headerClass: "text-center font-bold",
      children: month.weeks.map(w => ({
        field: `wk_${w}`,
        headerName: `${w}`,
        width: 38,
        headerClass: ["wk-header", w === currentWeek ? "current-week-header" : ""],
        cellStyle: { padding: "0", textAlign: "center", fontSize: "11px" },
        cellClass: (params: { value: string }) =>
          cellClass(params.value, w, currentWeek),
        suppressMenu: true,
        sortable: false,
      } as ColDef)),
    }));

    return [...pinned, ...monthGroups];
  }, [currentWeek, deleteRow, isAdmin]);

  // ── Summary pinned bottom row ───────────────────────────────────────────────
  const pinnedBottomRowData = useMemo<RowData[]>(() => {
    const sumSource = (field: string) => {
      const total = rowData.reduce((sum, r) => sum + (Number(r[field]) || 0), 0);
      return total ? String(total) : "";
    };

    const summary: RowData = {
      id: "__summary__",
      name: "SUMMARY",
      ac_count: rowData.reduce((sum, r) => sum + (Number(r.ac_count) || 0), 0),
      ac_type: "",
      source_1: sumSource("source_1"),
      source_2: sumSource("source_2"),
      source_3: sumSource("source_3"),
    };
    for (let w = 1; w <= 52; w++) {
      const p = rowData.filter(r => r[`wk_${w}`] === "P").length;
      const f = rowData.filter(r => r[`wk_${w}`] === "F").length;
      const total = p + f;
      summary[`wk_${w}`] = total ? String(total) : "";
    }
    return [summary];
  }, [rowData]);

  const getRowId = useCallback((p: GetRowIdParams<RowData>) => p.data.id as string, []);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-[#0d0d1a] text-white">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-[#1a1a2e] border-b border-[#2d3561] flex-shrink-0">
        <h1 className="text-lg font-bold text-blue-300 mr-2">
          🌡️ AC Master Plan {year}
        </h1>

        <input
          type="text"
          placeholder="Filter site..."
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          className="bg-[#0f3460] border border-[#2d3561] text-white text-sm rounded px-3 py-1 w-48 focus:outline-none focus:border-blue-500"
        />

        {isAdmin && (
          <button
            onClick={openAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded transition-colors"
          >
            + Add Site
          </button>
        )}

        <button
          onClick={exportCsv}
          className="bg-green-700 hover:bg-green-600 text-white text-sm px-3 py-1 rounded transition-colors"
        >
          Export CSV
        </button>

        {saving && <span className="text-yellow-400 text-xs animate-pulse">Saving...</span>}

        {/* Legend */}
        <div className="ml-auto flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="inline-block w-5 h-5 bg-white text-black font-bold flex items-center justify-center rounded-sm">P</span>
            Planned
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-5 h-5 bg-green-500 text-black font-bold flex items-center justify-center rounded-sm">F</span>
            Finished
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-5 h-5 bg-red-500 text-white font-bold flex items-center justify-center rounded-sm">D</span>
            Delayed
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-5 h-5 bg-yellow-400/30 border border-yellow-400 rounded-sm"></span>
            Current Wk
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className="ag-theme-alpine-dark flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            Loading data...
          </div>
        ) : (
          <AgGridReact<RowData>
            ref={gridRef}
            domLayout="autoHeight"
            rowData={rowData}
            columnDefs={columnDefs}
            pinnedBottomRowData={pinnedBottomRowData}
            getRowId={getRowId}
            quickFilterText={filterText}
            onCellClicked={onCellClicked}
            onCellValueChanged={onCellValueChanged}
            rowHeight={28}
            headerHeight={32}
            groupHeaderHeight={28}
            suppressCellFocus={true}
            enableCellTextSelection={false}
            animateRows={true}
            defaultColDef={{
              resizable: true,
              sortable: true,
            }}
            getRowStyle={params =>
              params.data?.id === "__summary__"
                ? { background: "#0f3460", fontWeight: "bold", borderTop: "2px solid #2d3561" }
                : undefined
            }
          />
        )}
      </div>

      {/* Add Site modal */}
      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowAdd(false)}
        >
          <div
            className="bg-[#1a1a2e] border border-[#2d3561] rounded-lg w-[360px] p-5 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-blue-300 mb-4">+ เพิ่ม Site ใหม่</h2>

            <div className="space-y-3 text-sm">
              <label className="block">
                <span className="text-gray-300">ชื่อ Site <span className="text-red-400">*</span></span>
                <input
                  autoFocus
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter") submitAdd(); }}
                  className="mt-1 w-full bg-[#0f3460] border border-[#2d3561] text-white rounded px-3 py-1.5 focus:outline-none focus:border-blue-500"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-gray-300">จำนวนทั้งหมด</span>
                  <input
                    type="number"
                    value={form.ac_count}
                    onChange={e => setForm(f => ({ ...f, ac_count: e.target.value }))}
                    className="mt-1 w-full bg-[#0f3460] border border-[#2d3561] text-white rounded px-3 py-1.5 focus:outline-none focus:border-blue-500"
                  />
                </label>
                <label className="block">
                  <span className="text-gray-300">Type</span>
                  <select
                    value={form.ac_type}
                    onChange={e => setForm(f => ({ ...f, ac_type: e.target.value }))}
                    className="mt-1 w-full bg-[#0f3460] border border-[#2d3561] text-white rounded px-3 py-1.5 focus:outline-none focus:border-blue-500"
                  >
                    <option value="Precision">Precision</option>
                    <option value="Comfort">Comfort</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {([1, 2, 3] as const).map(n => (
                  <label key={n} className="block">
                    <span className="text-gray-300">รอบที่ {n}</span>
                    <input
                      type="text"
                      value={form[`source_${n}` as "source_1" | "source_2" | "source_3"]}
                      onChange={e =>
                        setForm(f => ({ ...f, [`source_${n}`]: e.target.value }))
                      }
                      className="mt-1 w-full bg-[#0f3460] border border-[#2d3561] text-white rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowAdd(false)}
                className="px-4 py-1.5 text-sm rounded border border-[#2d3561] text-gray-300 hover:bg-[#0f3460]"
              >
                ยกเลิก
              </button>
              <button
                onClick={submitAdd}
                disabled={!form.name.trim() || saving}
                className="px-4 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
              >
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
