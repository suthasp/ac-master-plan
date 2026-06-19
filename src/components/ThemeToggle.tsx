"use client";

import { useTheme } from "./ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      title={theme === "dark" ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด"}
      aria-label="Toggle theme"
      className="px-2 py-0.5 rounded border border-[var(--border)] hover:bg-[var(--panel)] transition-colors text-base leading-none"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
