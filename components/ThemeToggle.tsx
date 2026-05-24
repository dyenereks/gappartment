"use client";
import { useEffect, useState } from "react";
import Icon from "./Icon";

type Theme = "light" | "dark";

/**
 * Reads the current theme from the document on mount (set by the inline
 * script in app/layout.tsx), then keeps localStorage + the html[data-theme]
 * attribute in sync as the user toggles.
 */
export default function ThemeToggle({
  className = "",
}: {
  className?: string;
}) {
  // null = not yet hydrated; prevents server/client mismatch
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const t = document.documentElement.getAttribute("data-theme");
    setTheme(t === "dark" ? "dark" : "light");
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* non-blocking */
    }
  };

  if (theme === null) {
    return (
      <span aria-hidden className={`theme-toggle ${className}`} style={{ visibility: "hidden" }} />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={`theme-toggle ${className}`}
    >
      <Icon name={isDark ? "sun" : "moon"} size={16} />
    </button>
  );
}
