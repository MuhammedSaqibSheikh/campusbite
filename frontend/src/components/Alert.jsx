export default function Alert({ type = "error", children, onClose }) {
  if (!children) return null;
  return (
    <div className={`alert alert-${type}`} role={type === "error" ? "alert" : "status"}>
      <span className="alert-icon" aria-hidden="true">{type === "success" ? "✓" : "!"}</span>
      <span>{children}</span>
      {onClose && (
        <button type="button" className="link" onClick={onClose} aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}
