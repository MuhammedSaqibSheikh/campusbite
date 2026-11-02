export default function Pagination({ page, pages, onChange }) {
  if (!pages || pages <= 1) return null;
  const go = (p) => {
    onChange(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return (
    <nav className="pagination" aria-label="Pagination">
      <button type="button" className="btn btn-light btn-sm" disabled={page <= 1} onClick={() => go(page - 1)}>
        ← Previous
      </button>
      <span className="page-indicator">
        Page <b>{page}</b> of {pages}
      </span>
      <button type="button" className="btn btn-light btn-sm" disabled={page >= pages} onClick={() => go(page + 1)}>
        Next →
      </button>
    </nav>
  );
}
