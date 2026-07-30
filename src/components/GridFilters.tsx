"use client";

import { useCallback, useMemo, useState } from "react";

export type FilterSpec = {
  /** stable id used as the React key and state key */
  key: string;
  /** dropdown label */
  label: string;
  /** column header to match (whitespace-insensitive) */
  header: string;
  /** column position to use if the sheet ever renames that header */
  fallback: number;
  /** turn the raw cell into the filter value (e.g. a date into a year) */
  derive?: (raw: string) => string;
  /** newest-first ordering for things like years */
  sortDesc?: boolean;
};

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

export type GridFilters = ReturnType<typeof useGridFilters>;

/**
 * Dropdown filters over a header + string-matrix table.
 *
 * `specs` must be a stable reference (declare it at module level), since the
 * filtered rows and option lists are memoised against it.
 */
export function useGridFilters(headers: string[], rows: string[][], specs: FilterSpec[]) {
  const [values, setValues] = useState<Record<string, string>>({});

  const idx = useMemo(() => {
    const map: Record<string, number> = {};
    specs.forEach(s => {
      const i = headers.findIndex(h => norm(h) === norm(s.header));
      map[s.key] = i >= 0 ? i : s.fallback;
    });
    return map;
  }, [headers, specs]);

  // Each dropdown lists only values still reachable under the *other* filters,
  // so no combination can come back empty.
  const { rowsFiltered, options } = useMemo(() => {
    const cellValue = (r: string[], s: FilterSpec) => {
      const raw = (r[idx[s.key]] ?? "").trim();
      return s.derive ? s.derive(raw) : raw;
    };
    const matches = (r: string[], skip?: string) =>
      specs.every(s => {
        const v = values[s.key];
        return s.key === skip || !v || cellValue(r, s) === v;
      });

    const opts: Record<string, string[]> = {};
    specs.forEach(s => {
      opts[s.key] = Array.from(
        new Set(rows.filter(r => matches(r, s.key)).map(r => cellValue(r, s)).filter(Boolean))
      ).sort((a, b) => (s.sortDesc ? b.localeCompare(a) : a.localeCompare(b, "th")));
    });

    return { rowsFiltered: rows.filter(r => matches(r)), options: opts };
  }, [rows, specs, idx, values]);

  const setValue = useCallback(
    (key: string, v: string) => setValues(prev => ({ ...prev, [key]: v })),
    []
  );
  const reset = useCallback(() => setValues({}), []);

  return {
    specs,
    values,
    setValue,
    reset,
    options,
    rowsFiltered,
    total: rows.length,
    hasFilter: specs.some(s => !!values[s.key]),
  };
}

export function FilterBar({ filters }: { filters: GridFilters }) {
  const { specs, values, setValue, reset, options, rowsFiltered, total, hasFilter } = filters;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {specs.map(s => (
        <label key={s.key} className="flex items-center gap-1.5 text-xs">
          <span className="text-[var(--text-muted)]">{s.label}</span>
          <select
            value={values[s.key] ?? ""}
            onChange={e => setValue(s.key, e.target.value)}
            className="bg-[var(--panel-2)] text-[var(--app-text)] border border-[var(--border)] rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400"
          >
            <option value="">ทั้งหมด</option>
            {options[s.key]?.map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </label>
      ))}

      {hasFilter && (
        <button
          onClick={reset}
          className="text-xs text-[var(--text-muted)] hover:text-blue-400 underline"
        >
          ล้างตัวกรอง
        </button>
      )}

      <span className="text-xs text-[var(--text-muted)] ml-auto">
        {rowsFiltered.length.toLocaleString()}
        {hasFilter && ` / ${total.toLocaleString()}`} รายการ
      </span>
    </div>
  );
}
