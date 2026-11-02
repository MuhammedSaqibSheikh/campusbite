import { useState } from "react";
import api, { errorMessage } from "../api/client";
import Alert from "../components/Alert";
import Pagination from "../components/Pagination";
import Spinner from "../components/Spinner";
import useFetch from "../hooks/useFetch";
import { formatDate, money } from "../utils";

export default function OwnerReturns() {
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [notes, setNotes] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const returns = useFetch("/owner/returns", { status, page, page_size: 10 });

  const decide = async (r, action) => {
    try {
      await api.post(`/owner/returns/${r.id}/${action}`, { note: notes[r.id] || null });
      setNotice(`Return for order #${r.order_id} ${action === "approve" ? "approved and refunded" : "rejected"}.`);
      setError("");
      returns.reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <>
      <div className="row between wrap">
        <h2>Return &amp; refund requests</h2>
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          aria-label="Status"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="">All</option>
        </select>
      </div>
      <Alert onClose={() => setError("")}>{error || returns.error}</Alert>
      <Alert type="success" onClose={() => setNotice("")}>{notice}</Alert>
      {returns.loading && <Spinner />}
      {returns.data?.items.length === 0 && <p className="center muted">No requests.</p>}

      {returns.data?.items.map((r) => (
        <article key={r.id} className="card">
          <div className="row between wrap">
            <h3>
              Order #{r.order_id} · {r.customer_name}
            </h3>
            <span className={`badge badge-${r.status === "approved" ? "delivered" : r.status === "rejected" ? "cancelled" : "placed"}`}>{r.status}</span>
          </div>
          <p>“{r.reason}”</p>
          <p className="muted small">
            {money(r.order_total)} · requested {formatDate(r.created_at)}
            {r.owner_note && <> · Your note: {r.owner_note}</>}
          </p>
          {r.status === "pending" && (
            <div className="row wrap inline-form">
              <input placeholder="Note to customer (optional)" maxLength={500} value={notes[r.id] || ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
              <button className="btn" onClick={() => decide(r, "approve")}>Approve &amp; refund</button>
              <button className="btn btn-danger" onClick={() => decide(r, "reject")}>Reject</button>
            </div>
          )}
        </article>
      ))}
      {returns.data && <Pagination page={returns.data.page} pages={returns.data.pages} onChange={setPage} />}
    </>
  );
}
