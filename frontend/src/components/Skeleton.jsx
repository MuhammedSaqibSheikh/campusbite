// Shimmering placeholders shown while lists load.
export function SkeletonGrid({ count = 6, cover = true }) {
  return (
    <div className="grid" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card skeleton-card">
          {cover && <div className="skeleton cover-sk" />}
          <div className="lines-sk">
            <div className="skeleton sk-line w-60" />
            <div className="skeleton sk-line w-40" />
            <div className="skeleton sk-line w-80" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({ count = 3 }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card skeleton-card">
          <div className="lines-sk">
            <div className="skeleton sk-line w-40" />
            <div className="skeleton sk-line w-80" />
            <div className="skeleton sk-line w-60" />
          </div>
        </div>
      ))}
    </div>
  );
}
