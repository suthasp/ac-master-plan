"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  /** let several values be ticked at once, as a checkbox dropdown */
  multi?: boolean;
  /** show the value differently from how it sorts (e.g. "2026-06" → "มิ.ย. 26") */
  format?: (value: string) => string;
};

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

export type GridFilters = ReturnType<typeof useGridFilters>;

/**
 * Dropdown filters over a header + string-matrix table.
 *
 * `specs` must be a stable reference (declare it at module level), since the
 * filtered rows and option lists are memoised against it.
 *
 * Every selection is held as a list. Single-select specs simply never hold more
 * than one value, so a spec with no `multi` flag behaves exactly as before.
 */
export function useGridFilters(headers: string[], rows: string[][], specs: FilterSpec[]) {
  const [values, setValues] = useState<Record<string, string[]>>({});

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
        return s.key === skip || !v?.length || v.includes(cellValue(r, s));
      });

    const opts: Record<string, string[]> = {};
    specs.forEach(s => {
      opts[s.key] = Array.from(
        new Set(rows.filter(r => matches(r, s.key)).map(r => cellValue(r, s)).filter(Boolean))
      ).sort((a, b) => (s.sortDesc ? b.localeCompare(a) : a.localeCompare(b, "th")));
    });

    return { rowsFiltered: rows.filter(r => matches(r)), options: opts };
  }, [rows, specs, idx, values]);

  /** replace a spec's selection outright — the single-select path */
  const setValue = useCallback(
    (key: string, v: string) => setValues(prev => ({ ...prev, [key]: v ? [v] : [] })),
    []
  );
  /** add or remove one value from a multi-select spec */
  const toggleValue = useCallback(
    (key: string, v: string) =>
      setValues(prev => {
        const cur = prev[key] ?? [];
        return { ...prev, [key]: cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v] };
      }),
    []
  );
  const setSelection = useCallback(
    (key: string, vs: string[]) => setValues(prev => ({ ...prev, [key]: vs })),
    []
  );
  const reset = useCallback(() => setValues({}), []);

  return {
    specs,
    values,
    setValue,
    toggleValue,
    setSelection,
    reset,
    options,
    rowsFiltered,
    total: rows.length,
    hasFilter: specs.some(s => !!values[s.key]?.length),
  };
}

/** Checkbox dropdown for a `multi` spec — closes on outside click or Escape. */
function MultiSelect({
  spec,
  selected,
  options,
  onToggle,
  onSet,
}: {
  spec: FilterSpec;
  selected: string[];
  options: string[];
  onToggle: (v: string) => void;
  onSet: (vs: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const show = spec.format ?? ((v: string) => v);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const summary =
    selected.length === 0 ? "ทั้งหมด"
    : selected.length === 1 ? show(selected[0])
    : `เลือก ${selected.length} รายการ`;

  return (
    <div ref={ref} className="relative flex items-center gap-1.5 text-xs">
      <span className="text-[var(--text-muted)]">{spec.label}</span>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex items-center gap-1 bg-[var(--panel-2)] text-[var(--app-text)] border border-[var(--border)] rounded px-2 py-1 text-xs hover:border-blue-400 focus:outline-none focus:border-blue-400"
      >
        <span className={selected.length ? "text-blue-400 font-semibold" : ""}>{summary}</span>
        <span className="text-[var(--text-muted)]">▾</span>
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 min-w-[190px] max-h-72 overflow-auto rounded border border-[var(--border)] bg-[var(--panel)] shadow-lg">
          <div className="sticky top-0 flex gap-3 border-b border-[var(--border)] bg-[var(--panel)] px-2 py-1.5">
            <button
              type="button"
              onClick={() => onSet(options)}
              className="text-[var(--text-muted)] hover:text-blue-400 underline"
            >
              เลือกทั้งหมด
            </button>
            <button
              type="button"
              onClick={() => onSet([])}
              className="text-[var(--text-muted)] hover:text-blue-400 underline"
            >
              ล้าง
            </button>
          </div>
          {options.length === 0 ? (
            <div className="px-2 py-2 text-[var(--text-muted)]">ไม่มีตัวเลือก</div>
          ) : (
            options.map(o => (
              <label
                key={o}
                className="flex cursor-pointer items-center gap-2 px-2 py-1 hover:bg-[var(--panel-2)]"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(o)}
                  onChange={() => onToggle(o)}
                  className="accent-blue-500"
                />
                <span className="whitespace-nowrap">{show(o)}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function FilterBar({ filters }: { filters: GridFilters }) {
  const {
    specs, values, setValue, toggleValue, setSelection, reset,
    options, rowsFiltered, total, hasFilter,
  } = filters;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {specs.map(s =>
        s.multi ? (
          <MultiSelect
            key={s.key}
            spec={s}
            selected={values[s.key] ?? []}
            options={options[s.key] ?? []}
            onToggle={v => toggleValue(s.key, v)}
            onSet={vs => setSelection(s.key, vs)}
          />
        ) : (
          <label key={s.key} className="flex items-center gap-1.5 text-xs">
            <span className="text-[var(--text-muted)]">{s.label}</span>
            <select
              value={values[s.key]?.[0] ?? ""}
              onChange={e => setValue(s.key, e.target.value)}
              className="bg-[var(--panel-2)] text-[var(--app-text)] border border-[var(--border)] rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400"
            >
              <option value="">ทั้งหมด</option>
              {options[s.key]?.map(o => (
                <option key={o} value={o}>{s.format ? s.format(o) : o}</option>
              ))}
            </select>
          </label>
        )
      )}

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
