import { useState } from "react";
import api, { errorMessage } from "../api/client";
import Alert from "../components/Alert";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import Pagination from "../components/Pagination";
import { SkeletonList } from "../components/Skeleton";
import useFetch from "../hooks/useFetch";
import { formatDate, money } from "../utils";

const TABS = [
  ["pending", "Pending"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
  ["", "All"],
];

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
      <PageHeader eyebrow="Restaurant owner" title="Returns & refunds" subtitle="Review customer return requests and issue refunds." />

      <div className="segmented" role="tablist" aria-label="Filter by status">
        {TABS.map(([value, text]) => (
          <button
            key={value || "all"}
            type="button"
            role="tab"
            aria-selected={status === value}
            className={status === value ? "active" : ""}
            onClick={() => {
              setPage(1);
              setStatus(value);
            }}
          >
            {text}
          </button>
        ))}
      </div>

      <Alert onClose={() => setError("")}>{error || returns.error}</Alert>
      <Alert type="success" onClose={() => setNotice("")}>{notice}</Alert>
      {returns.loading && !returns.data && <SkeletonList count={2} />}
      {returns.data?.items.length === 0 && (
        <EmptyState icon="📦" title="No requests here">
          Return requests from customers will appear in this list.
        </EmptyState>
      )}

      <div className="stagger" key={`${status}-${page}`}>
        {returns.data?.items.map((r) => (
          <article key={r.id} className="card order">
            <div className="order-head">
              <div>
                <h3>
                  {r.customer_name} <span className="order-id">· Order #{r.order_id}</span>
                </h3>
                <small className="muted">Requested {formatDate(r.created_at)}</small>
              </div>
              <span className={`badge badge-${r.status}`}>{r.status}</span>
            </div>
            <blockquote className="review-note" style={{ margin: "0.9rem 0" }}>
              “{r.reason}”
            </blockquote>
            <div className="row wrap small">
              <span className="tag">💰 {money(r.order_total)}</span>
              {r.owner_note && <span className="tag">📝 Your note: {r.owner_note}</span>}
            </div>
            {r.status === "pending" && (
              <div className="inline-form">
                <input
                  placeholder="Note to customer (optional)"
                  aria-label="Note to customer"
                  maxLength={500}
                  value={notes[r.id] || ""}
                  onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                />
                <button className="btn btn-success" onClick={() => decide(r, "approve")}>
                  ✓ Approve &amp; refund
                </button>
                <button className="btn btn-danger" onClick={() => decide(r, "reject")}>
                  Reject
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      {returns.data && <Pagination page={returns.data.page} pages={returns.data.pages} onChange={setPage} />}
    </>
  );
}
