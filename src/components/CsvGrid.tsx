"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams, IRowNode } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { useTheme } from "@/components/ThemeProvider";
import { exportTableToXlsx, stampedFileName } from "@/lib/xlsx";

// render URL values as clickable links (open in a new tab)
function cellRenderer(p: ICellRendererParams) {
  const v = p.value;
  if (typeof v === "string" && /^https?:\/\//i.test(v.trim())) {
    return (
      <a
        href={v.trim()}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-500 hover:text-blue-400 underline"
      >
        เปิดลิงก์
      </a>
    );
  }
  return v;
}

export default function CsvGrid({
  headers,
  rows,
  sheetName,
  fileBaseName,
}: {
  headers: string[];
  rows: string[][];
  sheetName: string;
  fileBaseName: string;
}) {
  const { theme } = useTheme();
  const gridRef = useRef<AgGridReact>(null);
  const [exporting, setExporting] = useState(false);

  const columnDefs = useMemo<ColDef[]>(
    () =>
      headers.map((h, i) => ({
        headerName: h || `Col ${i + 1}`,
        field: `c${i}`,
      })),
    [headers]
  );

  const rowData = useMemo(
    () =>
      rows.map(r => {
        const o: Record<string, string> = {};
        headers.forEach((_, i) => { o[`c${i}`] = r[i] ?? ""; });
        return o;
      }),
    [rows, headers]
  );

  // Exports what the grid currently shows — page filters, grid filters and the
  // active sort all apply, across every page (not just the visible one).
  const handleExport = useCallback(async () => {
    const api = gridRef.current?.api;
    if (!api || exporting) return;
    setExporting(true);
    try {
      const visible: string[][] = [];
      api.forEachNodeAfterFilterAndSort((node: IRowNode) => {
        const d = (node.data ?? {}) as Record<string, string>;
        visible.push(headers.map((_, i) => d[`c${i}`] ?? ""));
      });
      await exportTableToXlsx({
        headers,
        rows: visible,
        sheetName,
        fileName: stampedFileName(fileBaseName),
      });
    } finally {
      setExporting(false);
    }
  }, [headers, sheetName, fileBaseName, exporting]);

  return (
    <div className="flex flex-col h-full w-full gap-2">
      <div className="flex-shrink-0">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="bg-green-700 hover:bg-green-600 disabled:opacity-60 text-white text-sm px-3 py-1 rounded transition-colors"
        >
          {exporting ? "กำลังสร้างไฟล์..." : "Export Excel"}
        </button>
      </div>

      <div className={`${theme === "light" ? "ag-theme-alpine" : "ag-theme-alpine-dark"} flex-1 min-h-0 w-full`}>
        <AgGridReact
          ref={gridRef}
          columnDefs={columnDefs}
          rowData={rowData}
          defaultColDef={{ sortable: true, filter: true, resizable: true, minWidth: 120, cellRenderer }}
          pagination={true}
          paginationPageSize={50}
        />
      </div>
    </div>
  );
}
