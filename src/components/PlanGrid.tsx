"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type {
  ColDef,
  ColGroupDef,
  CellClickedEvent,
  GridReadyEvent,
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
}

export default function PlanGrid({ year = 2026 }: Props) {
  const gridRef = useRef<AgGridReact<RowData>>(null);
  const [rowData, setRowData] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState("");
  const [saving, setSaving] = useState(false);
  const currentWeek = useMemo(() => getCurrentWeek(), []);

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
  }, [year]);

  // ── Add row ─────────────────────────────────────────────────────────────────
  const addRow = useCallback(async () => {
    const name = prompt("Site name:");
    if (!name) return;
    const acCount = parseInt(prompt("Number of AC:") ?? "1");
    const acType = prompt("Type (Precision/Split):") ?? "Precision";

    const res = await fetch("/api/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ac_count: acCount, ac_type: acType }),
    });
    const newSite: Site = await res.json();
    const newRow: RowData = { ...newSite };
    for (let w = 1; w <= 52; w++) newRow[`wk_${w}`] = "";
    setRowData(prev => [...prev, newRow]);
  }, []);

  // ── Export ──────────────────────────────────────────────────────────────────
  const exportCsv = useCallback(() => {
    gridRef.current?.api.exportDataAsCsv({ fileName: `ac-plan-${year}.csv` });
  }, [year]);

  // ── Column definitions ──────────────────────────────────────────────────────
  const columnDefs = useMemo<(ColDef | ColGroupDef)[]>(() => {
    const pinned: ColDef[] = [
      { field: "name", headerName: "Site", pinned: "left", width: 160, cellStyle: { fontWeight: 600 } },
      { field: "ac_count", headerName: "# AC", pinned: "left", width: 55, type: "numericColumn" },
      { field: "ac_type", headerName: "Type", pinned: "left", width: 80 },
      { field: "source_1", headerName: "Src 1", pinned: "left", width: 65 },
      { field: "source_2", headerName: "Src 2", pinned: "left", width: 65 },
      { field: "source_3", headerName: "Src 3", pinned: "left", width: 65 },
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
  }, [currentWeek]);

  // ── Summary pinned bottom row ───────────────────────────────────────────────
  const pinnedBottomRowData = useMemo<RowData[]>(() => {
    const summary: RowData = {
      id: "__summary__",
      name: "SUMMARY",
      ac_count: 0,
      ac_type: "",
      source_1: null,
      source_2: null,
      source_3: null,
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

  const onGridReady = useCallback((e: GridReadyEvent) => {
    e.api.sizeColumnsToFit();
  }, []);

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

        <button
          onClick={addRow}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded transition-colors"
        >
          + Add Site
        </button>

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
            onGridReady={onGridReady}
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
    </div>
  );
}
