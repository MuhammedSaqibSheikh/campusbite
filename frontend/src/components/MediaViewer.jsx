import { useEffect, useRef, useState } from "react";
import { mediaUrl } from "../utils";

// Full-screen gallery for dish photos and videos.
export default function MediaViewer({ items, start = 0, title, onClose }) {
  const [index, setIndex] = useState(start);
  const closeRef = useRef(null);
  const count = items.length;
  const current = items[index];

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % count);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + count) % count);
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [count, onClose]);

  if (!current) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="viewer" onClick={(e) => e.stopPropagation()}>
        <div className="viewer-head">
          <b>{title}</b>
          <span className="muted small">
            {index + 1} / {count}
          </span>
          <button ref={closeRef} type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="viewer-stage">
          {current.kind === "video" ? (
            <video key={current.id} src={mediaUrl(current.url)} controls playsInline autoPlay muted />
          ) : (
            <img key={current.id} src={mediaUrl(current.url)} alt={title} />
          )}
          {count > 1 && (
            <>
              <button type="button" className="viewer-nav prev" aria-label="Previous" onClick={() => setIndex((index - 1 + count) % count)}>
                ‹
              </button>
              <button type="button" className="viewer-nav next" aria-label="Next" onClick={() => setIndex((index + 1) % count)}>
                ›
              </button>
            </>
          )}
        </div>
        {count > 1 && (
          <div className="viewer-thumbs">
            {items.map((m, i) => (
              <button
                key={m.id}
                type="button"
                className={i === index ? "thumb-btn active" : "thumb-btn"}
                aria-label={`Show ${m.kind} ${i + 1}`}
                onClick={() => setIndex(i)}
              >
                {m.kind === "video" ? <span className="thumb-video">▶</span> : <img src={mediaUrl(m.url)} alt="" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
