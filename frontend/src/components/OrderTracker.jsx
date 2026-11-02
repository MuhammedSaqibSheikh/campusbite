import { STATUS_FLOW } from "../utils";

export default function OrderTracker({ status }) {
  if (status === "CANCELLED" || status === "REFUNDED") return null;
  const current = STATUS_FLOW.indexOf(status);
  return (
    <ol className="tracker" aria-label="Order progress">
      {STATUS_FLOW.map((s, i) => (
        <li key={s} className={i < current ? "done" : i === current ? "current" : ""}>
          <span className="dot" />
          <span className="tracker-label">{s.replaceAll("_", " ")}</span>
        </li>
      ))}
    </ol>
  );
}
