import type ExcelJSType from "exceljs";

const isUrl = (v: string) => /^https?:\/\//i.test(v.trim());

/**
 * Write a header + string-matrix table to a styled .xlsx and trigger a download.
 * Values stay strings so dates/IDs from the source sheet aren't re-interpreted
 * by Excel; URLs become clickable cells.
 */
export async function exportTableToXlsx({
  headers,
  rows,
  sheetName,
  fileName,
}: {
  headers: string[];
  rows: string[][];
  sheetName: string;
  fileName: string;
}) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  // Excel rejects []:*?/\ in sheet names and caps them at 31 chars
  const ws = wb.addWorksheet(sheetName.replace(/[[\]:*?/\\]/g, " ").slice(0, 31), {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  ws.addRow(headers);
  const head = ws.getRow(1);
  head.height = 26;
  head.eachCell((c: ExcelJSType.Cell) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F3460" } };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });

  rows.forEach(r => {
    const row = ws.addRow(headers.map((_, i) => r[i] ?? ""));
    row.eachCell((c: ExcelJSType.Cell) => {
      const v = String(c.value ?? "");
      if (isUrl(v)) {
        c.value = { text: v.trim(), hyperlink: v.trim() };
        c.font = { color: { argb: "FF1155CC" }, underline: true };
      }
      c.alignment = { vertical: "top" };
    });
  });

  if (headers.length > 0) {
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };
  }

  // width from the widest value in each column, within sane bounds
  headers.forEach((h, i) => {
    const longest = rows.reduce(
      (max, r) => Math.max(max, (r[i] ?? "").length),
      h.length
    );
    ws.getColumn(i + 1).width = Math.min(45, Math.max(10, longest + 2));
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** `cm-results-20260730.xlsx` */
export function stampedFileName(base: string) {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${base}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.xlsx`;
}
