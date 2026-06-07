"use client";
import { formatCurrency } from "@/lib/utils";

export interface EnergyPoint {
  day: string; // "YYYY-MM-DD" (Philippine calendar day)
  kwh: number;
}

const BAR_AREA = 150; // px height of the plot area

/**
 * Lightweight CSS bar chart for daily energy. One bar per day, height scaled to
 * the period peak. Hover a bar for its date, kWh, and (if a rate is given) an
 * estimated cost. No charting dependency — just flexbox + div heights.
 */
export default function EnergyBarChart({
  points,
  ratePerKwh,
}: {
  points: EnergyPoint[];
  ratePerKwh?: number;
}) {
  const max = Math.max(0.0001, ...points.map((p) => p.kwh));

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 6,
        overflowX: "auto",
      }}
    >
      {points.map((p) => {
        const h = Math.round((p.kwh / max) * BAR_AREA);
        const dayNum = String(Number(p.day.slice(8, 10)));
        const cost = ratePerKwh ? p.kwh * ratePerKwh : null;
        const title =
          `${p.day} · ${p.kwh.toFixed(2)} kWh` +
          (cost != null ? ` · ≈ ${formatCurrency(cost)}` : "");
        return (
          <div
            key={p.day}
            title={title}
            style={{
              flex: "1 0 16px",
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
            }}
          >
            <div
              style={{
                height: BAR_AREA,
                width: "100%",
                display: "flex",
                alignItems: "flex-end",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: p.kwh > 0 ? Math.max(h, 3) : 1,
                  background: p.kwh > 0 ? "var(--accent)" : "var(--line)",
                  borderRadius: "4px 4px 0 0",
                  transition: "height 200ms ease",
                }}
              />
            </div>
            <div className="muted tnum" style={{ fontSize: 10 }}>
              {dayNum}
            </div>
          </div>
        );
      })}
    </div>
  );
}
