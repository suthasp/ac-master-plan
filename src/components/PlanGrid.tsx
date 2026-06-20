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
import * as XLSX from "xlsx";
import type ExcelJSType from "exceljs";
import { useTheme } from "./ThemeProvider";

// ── Types ────────────────────────────────────────────────────────────────────

export interface Site {
  id: string;
  name: string;
  ac_count: number;
  ac_type: string;
  site_type: string | null;
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

interface ImportSiteRow {
  name: string;
  ac_count: number;
  ac_type: string;
  site_type: string | null;
  source_1: string | null;
  source_2: string | null;
  source_3: string | null;
  weeks: Record<string, string>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function getCurrentWeek(): number {
  // Weeks start on Monday (ISO-style); week 26 begins Monday 22 June 2026.
  const WEEK26_START = new Date(2026, 5, 22); // month 5 = June
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((today.getTime() - WEEK26_START.getTime()) / 86400000);
  return 26 + Math.floor(diffDays / 7);
}

const STATUS_CYCLE: Record<string, string> = { "": "P", P: "F", F: "" };

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
  const { theme } = useTheme();
  const gridRef = useRef<AgGridReact<RowData>>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rowData, setRowData] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState("");
  const [saving, setSaving] = useState(false);
  const currentWeek = useMemo(() => getCurrentWeek(), []);

  // ── Add-site modal form ───────────────────────────────────────────────────────
  const emptyForm = { name: "", ac_count: "", ac_type: "Precision", site_type: "Big", source_1: "", source_2: "", source_3: "" };
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);

  // ── Import confirmation ───────────────────────────────────────────────────────
  const [pendingImport, setPendingImport] = useState<ImportSiteRow[] | null>(null);

  // ── Toast notifications ───────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const showToast = useCallback((type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }, []);

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
          site_type: form.site_type,
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
      site_type: "",
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

  // ── Export to a styled .xlsx workbook ─────────────────────────────────────────
  const exportExcel = useCallback(async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`AC Plan ${year}`, {
      views: [{ state: "frozen", xSplit: 7, ySplit: 3 }],
    });

    const leftHeaders = ["Site", "จำนวนทั้งหมด", "Type", "Site Type", "รอบที่ 1", "รอบที่ 2", "รอบที่ 3"];
    const totalCols = leftHeaders.length + 52;

    const thin: Partial<ExcelJSType.Borders> = {
      top: { style: "thin", color: { argb: "FFBFBFBF" } },
      left: { style: "thin", color: { argb: "FFBFBFBF" } },
      bottom: { style: "thin", color: { argb: "FFBFBFBF" } },
      right: { style: "thin", color: { argb: "FFBFBFBF" } },
    };
    const styleHeader = (c: ExcelJSType.Cell) => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A6E" } };
      c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      c.border = thin;
    };

    // Row 1: title banner
    ws.mergeCells(1, 1, 1, totalCols);
    const title = ws.getCell(1, 1);
    title.value = `AC Master Plan ${year} (AMC)`;
    title.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
    title.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F3460" } };
    ws.getRow(1).height = 24;

    // Row 2: month groups over the week columns
    let cur = leftHeaders.length + 1;
    MONTHS.forEach(month => {
      const start = cur;
      month.weeks.forEach(w => {
        const c = ws.getCell(3, cur);
        c.value = w;
        styleHeader(c);
        if (w === currentWeek) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3B82F6" } };
        cur++;
      });
      ws.mergeCells(2, start, 2, cur - 1);
      const m = ws.getCell(2, start);
      m.value = month.name;
      styleHeader(m);
    });

    // Row 3: field headers (week numbers already filled above)
    leftHeaders.forEach((h, i) => {
      const c = ws.getCell(3, i + 1);
      c.value = h;
      styleHeader(c);
    });

    const writeRow = (excelRow: ExcelJSType.Row, r: RowData, isSummary: boolean) => {
      excelRow.getCell(1).value = String(r.name ?? "");
      excelRow.getCell(2).value = Number(r.ac_count) || (isSummary ? 0 : 0);
      excelRow.getCell(3).value = String(r.ac_type ?? "");
      excelRow.getCell(4).value = String(r.site_type ?? "");
      excelRow.getCell(5).value = String(r.source_1 ?? "");
      excelRow.getCell(6).value = String(r.source_2 ?? "");
      excelRow.getCell(7).value = String(r.source_3 ?? "");
      let col = leftHeaders.length + 1;
      MONTHS.forEach(month => month.weeks.forEach(w => {
        const v = String(r[`wk_${w}`] ?? "");
        const c = excelRow.getCell(col);
        c.value = v;
        c.alignment = { horizontal: "center", vertical: "middle" };
        c.border = thin;
        if (!isSummary) {
          if (v === "F") { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF22C55E" } }; c.font = { bold: true, color: { argb: "FF000000" } }; }
          else if (v === "D") { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEF4444" } }; c.font = { bold: true, color: { argb: "FFFFFFFF" } }; }
          else if (v === "P") { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1D5DB" } }; c.font = { bold: true, color: { argb: "FF000000" } }; }
        }
        col++;
      }));
      // left columns formatting + borders
      for (let i = 1; i <= leftHeaders.length; i++) {
        const c = excelRow.getCell(i);
        c.border = thin;
        c.alignment = { horizontal: i === 2 ? "right" : "left", vertical: "middle" };
      }
      if (isSummary) {
        for (let i = 1; i <= totalCols; i++) {
          const c = excelRow.getCell(i);
          c.font = { bold: true, color: { argb: "FFFFFFFF" } };
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F3460" } };
        }
      }
    };

    rowData.forEach((r, i) => writeRow(ws.getRow(4 + i), r, false));
    writeRow(ws.getRow(4 + rowData.length), pinnedBottomRowData[0], true);

    // column widths
    ws.getColumn(1).width = 22;
    ws.getColumn(2).width = 12;
    ws.getColumn(3).width = 11;
    ws.getColumn(4).width = 11;
    [5, 6, 7].forEach(i => (ws.getColumn(i).width = 10));
    for (let i = 8; i <= totalCols; i++) ws.getColumn(i).width = 4.5;

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ac-plan-${year}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [year, rowData, pinnedBottomRowData, currentWeek]);

  // ── Import from Excel/CSV (admin) ─────────────────────────────────────────────
  // Expected columns (same as Export CSV): Site, จำนวนทั้งหมด, Type,
  // รอบที่ 1/2/3, and numeric week columns 1..52 with P/F/D values.
  const importExcel = useCallback(async (file: File) => {
    const norm = (s: string) => String(s).toLowerCase().replace(/\s+/g, " ").trim();
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "" });
      if (aoa.length < 2) { showToast("error", "ไฟล์ว่างหรือไม่มีข้อมูล"); return; }

      // find the header row (skips any title / month-group rows above it)
      const headerRowIdx = aoa.findIndex(row =>
        (row as unknown[]).some(c => norm(String(c)) === "site")
      );
      if (headerRowIdx < 0) { showToast("error", "ไม่พบแถวหัวตาราง (ต้องมีคอลัมน์ 'Site')"); return; }

      const headers = (aoa[headerRowIdx] as unknown[]).map(h => String(h).trim());
      const find = (cands: string[]) => headers.findIndex(h => cands.includes(norm(h)));

      const idxName  = find(["site", "name", "ชื่อ", "ชื่อ site"]);
      const idxCount = find(["จำนวนทั้งหมด", "ac_count", "# ac", "จำนวน"]);
      const idxType  = find(["type", "ac_type", "ประเภท"]);
      const idxSiteType = find(["site type", "site_type", "ขนาด"]);
      const idxS1    = find(["รอบที่ 1", "source_1", "รอบ 1"]);
      const idxS2    = find(["รอบที่ 2", "source_2", "รอบ 2"]);
      const idxS3    = find(["รอบที่ 3", "source_3", "รอบ 3"]);

      if (idxName < 0) { showToast("error", "ไม่พบคอลัมน์ชื่อ Site (หัวคอลัมน์ต้องมี 'Site')"); return; }

      const weekCols: { idx: number; week: number }[] = [];
      headers.forEach((h, i) => {
        const n = Number(h);
        if (Number.isInteger(n) && n >= 1 && n <= 53) weekCols.push({ idx: i, week: n });
      });

      const rows = (aoa.slice(headerRowIdx + 1) as unknown[][])
        .map(r => {
          const name = String(r[idxName] ?? "").trim();
          if (!name || name.toUpperCase() === "SUMMARY") return null;
          const weeks: Record<string, string> = {};
          weekCols.forEach(({ idx, week }) => {
            const v = String(r[idx] ?? "").trim();
            if (v) weeks[week] = v;
          });
          return {
            name,
            ac_count: idxCount >= 0 ? Number(r[idxCount]) || 0 : 0,
            ac_type: idxType >= 0 ? String(r[idxType] ?? "").trim() || "Precision" : "Precision",
            site_type: idxSiteType >= 0 ? String(r[idxSiteType] ?? "").trim() || null : null,
            source_1: idxS1 >= 0 ? String(r[idxS1] ?? "").trim() || null : null,
            source_2: idxS2 >= 0 ? String(r[idxS2] ?? "").trim() || null : null,
            source_3: idxS3 >= 0 ? String(r[idxS3] ?? "").trim() || null : null,
            weeks,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      if (rows.length === 0) { showToast("error", "ไม่พบข้อมูลที่นำเข้าได้"); return; }
      setPendingImport(rows); // open styled confirmation modal
    } catch (err) {
      showToast("error", "อ่านไฟล์ไม่สำเร็จ: " + (err as Error).message);
    }
  }, [showToast]);

  // confirm + run the import
  const doImport = useCallback(async () => {
    if (!pendingImport) return;
    setSaving(true);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, rows: pendingImport }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "import failed");
      }
      const result = await res.json();
      setPendingImport(null);
      await fetchData();
      showToast("success", `นำเข้าสำเร็จ — เพิ่มใหม่ ${result.inserted}, อัปเดต ${result.updated} site (${result.entries} สถานะ)`);
    } catch (err) {
      showToast("error", "นำเข้าไม่สำเร็จ: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [pendingImport, year, fetchData, showToast]);

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
      { field: "site_type", headerName: "Site Type", pinned: "left", width: 100, editable: siteEditable,
        cellEditor: "agSelectCellEditor", cellEditorParams: { values: ["Big", "Medium"] } },
      { field: "source_1", headerName: "รอบที่ 1", pinned: "left", width: 100, editable: siteEditable },
      { field: "source_2", headerName: "รอบที่ 2", pinned: "left", width: 100, editable: siteEditable },
      { field: "source_3", headerName: "รอบที่ 3", pinned: "left", width: 100, editable: siteEditable },
    ];

    const monthGroups: ColGroupDef[] = MONTHS.map(month => ({
      headerName: month.name,
      headerClass: "text-center font-bold",
      children: month.weeks.map((w, wi) => ({
        field: `wk_${w}`,
        headerName: `${w}`,
        width: 38,
        headerClass: ["wk-header", w === currentWeek ? "current-week-header" : "", wi === 0 ? "month-start" : ""],
        cellStyle: { padding: "0", textAlign: "center", fontSize: "11px" },
        cellClass: (params: { value: string }) =>
          cellClass(params.value, w, currentWeek) + (wi === 0 ? " month-start" : ""),
        suppressMenu: true,
        sortable: false,
      } as ColDef)),
    }));

    return [...pinned, ...monthGroups];
  }, [currentWeek, deleteRow, isAdmin]);

  const getRowId = useCallback((p: GetRowIdParams<RowData>) => p.data.id as string, []);

  // duplicate site name + Type in the pending import (upsert will merge them);
  // same name with a different Type is allowed and not flagged
  const importDupNames = (() => {
    if (!pendingImport) return [] as string[];
    const counts: Record<string, number> = {};
    pendingImport.forEach(r => {
      const key = `${r.name}|${r.ac_type}`;
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return Object.keys(counts)
      .filter(k => counts[k] > 1)
      .map(k => k.replace("|", " · "));
  })();

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[var(--app-bg)] text-[var(--app-text)]">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-[var(--panel)] border-b border-[var(--border)] flex-shrink-0">
        <input
          type="text"
          placeholder="Filter site..."
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          className="bg-[var(--panel-2)] border border-[var(--border)] text-[var(--app-text)] text-sm rounded px-3 py-1 w-48 focus:outline-none focus:border-blue-500"
        />

        {isAdmin && (
          <button
            onClick={openAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded transition-colors"
          >
            + Add Site
          </button>
        )}

        {isAdmin && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) importExcel(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-emerald-700 hover:bg-emerald-600 text-white text-sm px-3 py-1 rounded transition-colors"
            >
              Import Excel
            </button>
          </>
        )}

        <button
          onClick={exportExcel}
          className="bg-green-700 hover:bg-green-600 text-white text-sm px-3 py-1 rounded transition-colors"
        >
          Export Excel
        </button>

        {saving && <span className="text-yellow-400 text-xs animate-pulse">Saving...</span>}

        {/* Legend */}
        <div className="ml-auto flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="inline-block w-5 h-5 bg-gray-300 text-black font-bold flex items-center justify-center rounded-sm">P</span>
            Planned
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-5 h-5 bg-green-500 text-black font-bold flex items-center justify-center rounded-sm">F</span>
            Finished
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-5 h-5 bg-blue-400/30 border border-blue-400 rounded-sm"></span>
            Current Wk
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className={`${theme === "light" ? "ag-theme-alpine" : "ag-theme-alpine-dark"} flex-1 min-h-0`}>
        {loading ? (
          <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
            Loading data...
          </div>
        ) : (
          <AgGridReact<RowData>
            ref={gridRef}
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
                ? { background: "var(--panel-2)", fontWeight: "bold", borderTop: "2px solid var(--border)" }
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
            className="bg-[var(--panel)] border border-[var(--border)] rounded-lg w-[360px] p-5 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-blue-400 mb-4">+ เพิ่ม Site ใหม่</h2>

            <div className="space-y-3 text-sm">
              <label className="block">
                <span className="text-[var(--app-text)]">ชื่อ Site <span className="text-red-400">*</span></span>
                <input
                  autoFocus
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter") submitAdd(); }}
                  className="mt-1 w-full bg-[var(--panel-2)] border border-[var(--border)] text-[var(--app-text)] rounded px-3 py-1.5 focus:outline-none focus:border-blue-500"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[var(--app-text)]">จำนวนทั้งหมด</span>
                  <input
                    type="number"
                    value={form.ac_count}
                    onChange={e => setForm(f => ({ ...f, ac_count: e.target.value }))}
                    className="mt-1 w-full bg-[var(--panel-2)] border border-[var(--border)] text-[var(--app-text)] rounded px-3 py-1.5 focus:outline-none focus:border-blue-500"
                  />
                </label>
                <label className="block">
                  <span className="text-[var(--app-text)]">Type</span>
                  <select
                    value={form.ac_type}
                    onChange={e => setForm(f => ({ ...f, ac_type: e.target.value }))}
                    className="mt-1 w-full bg-[var(--panel-2)] border border-[var(--border)] text-[var(--app-text)] rounded px-3 py-1.5 focus:outline-none focus:border-blue-500"
                  >
                    <option value="Precision">Precision</option>
                    <option value="Comfort">Comfort</option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-[var(--app-text)]">Site Type</span>
                <select
                  value={form.site_type}
                  onChange={e => setForm(f => ({ ...f, site_type: e.target.value }))}
                  className="mt-1 w-full bg-[var(--panel-2)] border border-[var(--border)] text-[var(--app-text)] rounded px-3 py-1.5 focus:outline-none focus:border-blue-500"
                >
                  <option value="Big">Big</option>
                  <option value="Medium">Medium</option>
                </select>
              </label>

              <div className="grid grid-cols-3 gap-3">
                {([1, 2, 3] as const).map(n => (
                  <label key={n} className="block">
                    <span className="text-[var(--app-text)]">รอบที่ {n}</span>
                    <input
                      type="text"
                      value={form[`source_${n}` as "source_1" | "source_2" | "source_3"]}
                      onChange={e =>
                        setForm(f => ({ ...f, [`source_${n}`]: e.target.value }))
                      }
                      className="mt-1 w-full bg-[var(--panel-2)] border border-[var(--border)] text-[var(--app-text)] rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowAdd(false)}
                className="px-4 py-1.5 text-sm rounded border border-[var(--border)] text-[var(--app-text)] hover:bg-[var(--panel-2)]"
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

      {/* Import confirmation modal */}
      {pendingImport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => !saving && setPendingImport(null)}
        >
          <div
            className="bg-[var(--panel)] border border-[var(--border)] rounded-lg w-[400px] p-5 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-blue-400 mb-1">ยืนยันการนำเข้า</h2>
            <p className="text-sm text-[var(--app-text)] mb-1">
              พบ <span className="font-bold text-blue-400">{pendingImport.length}</span> site ในไฟล์
            </p>
            <p className="text-xs text-[var(--text-muted)] mb-3">
              ชื่อซ้ำ = อัปเดตของเดิม · ชื่อใหม่ = เพิ่มเข้าไป
            </p>

            {importDupNames.length > 0 && (
              <p className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/40 rounded px-2 py-1.5 mb-3">
                ⚠️ พบชื่อ+Type ซ้ำในไฟล์ ({importDupNames.join(", ")}) — แถวเหล่านี้จะถูกรวมเป็น site เดียว (ค่าจากแถวล่างสุดมีผล) · ชื่อซ้ำได้ถ้า Type ต่างกัน
              </p>
            )}

            <div className="max-h-44 overflow-auto rounded border border-[var(--border)] bg-[var(--panel-2)] text-sm">
              {pendingImport.map((r, i) => (
                <div
                  key={i}
                  className="flex justify-between px-3 py-1 border-b border-[var(--border)] last:border-0"
                >
                  <span className="text-[var(--app-text)]">{r.name}</span>
                  <span className="text-[var(--text-muted)] text-xs">
                    {r.ac_count} · {r.ac_type}{r.site_type ? ` · ${r.site_type}` : ""}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setPendingImport(null)}
                disabled={saving}
                className="px-4 py-1.5 text-sm rounded border border-[var(--border)] text-[var(--app-text)] hover:bg-[var(--panel-2)] disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={doImport}
                disabled={saving}
                className="px-4 py-1.5 text-sm rounded bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-50"
              >
                {saving ? "กำลังนำเข้า..." : "นำเข้า"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-3 right-3 z-[60] max-w-sm px-4 py-2.5 rounded-lg shadow-lg text-sm text-white flex items-center gap-2 ${
            toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          <span>{toast.type === "success" ? "✓" : "⚠"}</span>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
