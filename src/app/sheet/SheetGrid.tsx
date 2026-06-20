"use client";

import { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { useTheme } from "@/components/ThemeProvider";

export default function SheetGrid({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  const { theme } = useTheme();

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

  return (
    <div className={`${theme === "light" ? "ag-theme-alpine" : "ag-theme-alpine-dark"} h-full w-full`}>
      <AgGridReact
        columnDefs={columnDefs}
        rowData={rowData}
        defaultColDef={{ sortable: true, filter: true, resizable: true, minWidth: 120 }}
        pagination={true}
        paginationPageSize={50}
      />
    </div>
  );
}
