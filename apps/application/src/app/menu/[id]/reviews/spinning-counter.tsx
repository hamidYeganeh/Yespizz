import type { CSSProperties } from "react";
import "./spinning-counter.css";

export function SpinningCounter({ value }: { value: number }) {
  return (
    <span className="t-reel">
      <span className="sr-only">{value}</span>
      {String(value).split("").map((char, column) => {
        if (char === ".") return <span aria-hidden="true" key={column}>.</span>;
        const steps = 20 + Number(char);
        return (
          <span key={column} aria-hidden="true" className="t-reel-col" style={{
            "--steps": steps, "--column": column,
          } as CSSProperties}>
            <span className="t-reel-strip">
              {Array.from({ length: steps + 1 }, (_, n) => (
                <span key={n} className="t-reel-digit">{n % 10}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}
