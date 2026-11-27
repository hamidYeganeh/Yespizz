export function ProgressRing({ value, total }: { value: number; total: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const pct = value / total;
  const track = "var(--border)";
  return (
    <div style={{ position: "relative", width: 78, height: 78, flexShrink: 0 }}>
      <svg width="78" height="78" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="39" cy="39" r={r} fill="none" stroke={track} strokeWidth="7" />
        <circle
          cx="39"
          cy="39"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontSize: 19, fontWeight: 700, lineHeight: 1, color: "var(--foreground)" }}>
          {value}<span style={{ fontSize: 12, color: "var(--muted)" }}>/{total}</span>
        </div>
        <div style={{ fontSize: 8.5, letterSpacing: 0.5, color: "var(--muted)" }}>STOPS</div>
      </div>
    </div>
  );
}
