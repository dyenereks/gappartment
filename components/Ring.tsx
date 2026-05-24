interface RingProps {
  pct: number; // 0..1
  size?: number;
  label?: string;
  /** Use the terracotta accent color instead of ink. */
  accent?: boolean;
}

export default function Ring({ pct, size = 64, label, accent = false }: RingProps) {
  const safe = Math.max(0, Math.min(1, pct));
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      <svg width={size} height={size} className="progress-ring">
        <circle className="track" cx={size / 2} cy={size / 2} r={r} />
        <circle
          className="fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={accent ? "var(--accent)" : "var(--ink)"}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - safe)}
        />
      </svg>
      <div style={{ position: "absolute", textAlign: "center" }}>
        <div style={{ fontWeight: 600, fontSize: size >= 96 ? 20 : 14 }}>
          {Math.round(safe * 100)}%
        </div>
        {label && (
          <div className="muted" style={{ fontSize: 10 }}>
            {label}
          </div>
        )}
      </div>
    </div>
  );
}
