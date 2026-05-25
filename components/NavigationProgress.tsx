"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type State = "idle" | "loading" | "done";

export default function NavigationProgress() {
  const pathname = usePathname();
  const [state, setState] = useState<State>("idle");
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start the bar when an internal link is clicked (Link renders an <a>).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      const anchor = (e.target as HTMLElement)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      const target = anchor.getAttribute("target");
      if (!href || !href.startsWith("/") || target === "_blank") return;
      // Only meaningful if we're actually changing path.
      if (href.split(/[?#]/)[0] === pathname) return;
      if (safety.current) clearTimeout(safety.current);
      // Force-resolve if navigation stalls.
      safety.current = setTimeout(() => setState("done"), 8000);
      setState("loading");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname]);

  // pathname changed → navigation finished.
  useEffect(() => {
    if (safety.current) clearTimeout(safety.current);
    setState((prev) => (prev === "loading" ? "done" : prev));
  }, [pathname]);

  // After completing, reset so the next navigation animates from zero.
  useEffect(() => {
    if (state !== "done") return;
    const t = setTimeout(() => setState("idle"), 400);
    return () => clearTimeout(t);
  }, [state]);

  return <div className="nav-progress" data-state={state} aria-hidden />;
}
