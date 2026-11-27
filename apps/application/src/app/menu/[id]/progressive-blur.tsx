import "./progressive-blur.css";

export function ProgressiveBlur({ direction }: { direction: "top" | "bottom" }) {
  const layers = 8;
  return (
    <div aria-hidden="true" className={`edge-blur edge-blur-${direction}`}>
      {Array.from({ length: layers }, (_, index) => {
        const stops = [0, 1, 2, 3].map((offset) => {
          const reachesEdge = index === layers - 1;
          const color =
            offset === 1 || offset === 2 || (reachesEdge && offset === 3)
              ? "black"
              : "transparent";
          return `${color} ${((index + offset) / (layers + 1)) * 100}%`;
        });
        const mask = `linear-gradient(to ${direction}, ${stops.join(", ")})`;
        const blurStep = 0.8;
        const filter = `blur(${index * blurStep}px)`;
        return (
          <div
            key={index}
            style={{
              maskImage: mask,
              WebkitMaskImage: mask,
              backdropFilter: filter,
              WebkitBackdropFilter: filter,
            }}
          />
        );
      })}
    </div>
  );
}
