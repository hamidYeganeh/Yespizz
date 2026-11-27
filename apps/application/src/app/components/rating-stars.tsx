import { Star } from "@repo/icons";

export function RatingStars({ value }: { value: number }) {
  return (
    <span className="rating-stars" role="img" aria-label={`${value} / 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className="rating-star-cell">
          <Star aria-hidden="true" />
          <span className="rating-star-fill" style={{ width: `${Math.min(1, Math.max(0, value - index)) * 100}%` }}>
            <Star aria-hidden="true" />
          </span>
        </span>
      ))}
    </span>
  );
}
