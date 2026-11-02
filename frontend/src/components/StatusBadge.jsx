import { label } from "../utils";

export default function StatusBadge({ status }) {
  return <span className={`badge badge-${String(status).toLowerCase()}`}>{label(String(status))}</span>;
}
