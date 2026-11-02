import { STATUS_FLOW, label } from "../utils";

export default function OrderTracker({ status }) {
  if (status === "CANCELLED" || status === "REFUNDED") return null;
  const current = STATUS_FLOW.indexOf(status);
  return (
    <>
      <ol className="tracker" aria-label="Order progress">
        {STATUS_FLOW.map((s, i) => (
          <li key={s} className={i < current ? "done" : i === current ? "current" : ""} aria-current={i === current ? "step" : undefined}>
            <span className="dot" />
            <span className="tracker-label">{label(s)}</span>
          </li>
        ))}
      </ol>
      {current >= 0 && (
        <p className="tracker-caption" aria-hidden="true">
          Step {current + 1} of {STATUS_FLOW.length} · <b>{label(status)}</b>
        </p>
      )}
    </>
  );
}
