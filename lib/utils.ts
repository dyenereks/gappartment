import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** ₱1,234.56 — peso w/ 2 decimals */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}

/** Alias matching the design's helper name */
export const peso = formatCurrency;

/** ₱1,234 — peso w/o decimals (for compact display) */
export function pesoShort(amount: number): string {
  return "₱" + Math.round(amount).toLocaleString("en-PH");
}

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(parseInt(year), parseInt(m) - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function getMonthOptions(count = 6): { value: string; label: string }[] {
  const options = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    options.push({ value, label: formatMonth(value) });
  }
  return options;
}

/** Shift a "YYYY-MM" string by N months (positive or negative). */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, (m - 1) + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "May 8" */
export function formatDate(d: string | number | Date): string {
  const dt = typeof d === "string" || typeof d === "number" ? new Date(d) : d;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "May 8, 2026" */
export function formatLongDate(d: string | number | Date): string {
  const dt = typeof d === "string" || typeof d === "number" ? new Date(d) : d;
  return dt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** "3m ago", "5h ago", "2d ago", or short date. */
export function relTime(d: string | number | Date): string {
  const dt = typeof d === "string" || typeof d === "number" ? new Date(d) : d;
  const diff = (Date.now() - dt.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  if (diff < 86400 * 7) return Math.floor(diff / 86400) + "d ago";
  return formatDate(dt);
}

/** Whole-day delta from today. Negative when in the past. */
export function daysUntil(d: string | number | Date): number {
  const dt = typeof d === "string" || typeof d === "number" ? new Date(d) : d;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dt);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export const BILL_TYPES = ["RENT", "ELECTRIC", "WATER"] as const;
export type BillType = (typeof BILL_TYPES)[number];

export const BILL_TYPE_LABELS: Record<string, string> = {
  RENT: "Rent",
  ELECTRIC: "Electric",
  WATER: "Water",
};

/** Maps a bill type to an Icon name in components/Icon.tsx */
export const BILL_TYPE_ICON: Record<string, string> = {
  RENT: "home",
  ELECTRIC: "bolt",
  WATER: "water",
};

export function displayName(user: { name: string; nickname?: string | null }): string {
  return user.nickname?.trim() || user.name;
}

/** First letter(s) used as avatar fallback. Prefers initials of two-word names. */
export function initials(user: { name: string; nickname?: string | null }): string {
  const n = displayName(user).trim();
  if (!n) return "?";
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const TENANT_COLOR_VARS = [
  "var(--t-1)",
  "var(--t-2)",
  "var(--t-3)",
  "var(--t-4)",
  "var(--t-5)",
] as const;

/** Deterministic color per user — hashed to one of 5 palette slots. */
export function tenantColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return TENANT_COLOR_VARS[Math.abs(h) % TENANT_COLOR_VARS.length];
}

/**
 * Downloads a remote image to the user's device. Uses fetch+blob so cross-origin
 * images don't get rendered inline by the browser.
 */
export async function downloadImage(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to download image");
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

export const PAYMENT_PROVIDERS = ["GCash", "Maya", "BDO"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number] | string;
