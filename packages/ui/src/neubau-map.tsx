export function NeubauMap() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 800 400"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <defs>
        <pattern
          id="blocks"
          width="83"
          height="57"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-19)"
        >
          <rect width="83" height="57" fill="var(--surface)" />
          <rect
            x="4"
            y="4"
            width="73"
            height="47"
            rx="4"
            fill="var(--border)"
          />
          <rect
            x="16"
            y="12"
            width="49"
            height="29"
            rx="3"
            fill="var(--surface-secondary)"
          />
        </pattern>
      </defs>
      <rect width="800" height="400" fill="url(#blocks)" />
      <g fill="var(--success)" opacity=".35">
        <path d="M70 80l98 -34 21 58-101 33z" />
        <path d="M530 170l100 -32 30 83-103 34z" />
      </g>
      <g fill="none" stroke="var(--surface)" strokeWidth="15">
        <path d="M0 270 Q220 165 400 200T820 100" />
        <path d="M80 -40L215 420" />
        <path d="M500 -10Q440 190 590 410" />
      </g>
      <path
        d="M175 210L330 183 427 193 486 188 533 306"
        fill="none"
        stroke="var(--success)"
        strokeWidth="4"
        strokeDasharray="7 4"
      />
      <g fill="var(--muted)" fontSize="11" letterSpacing="2">
        <text x="275" y="150">
          BURGGASSE
        </text>
        <text x="590" y="295">
          JOSEFSTADT
        </text>
        <text x="119" y="323">
          WESTBAHNSTRASSE
        </text>
      </g>
    </svg>
  );
}
