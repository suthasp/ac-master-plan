"use client";

import { useTheme } from "./ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      title={theme === "dark" ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด"}
      aria-label="Toggle theme"
      className="text-base leading-none hover:opacity-70 transition-opacity"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
