import { useState } from "react";
import { Link } from "react-router-dom";
import api, { errorMessage } from "../api/client";
import Alert from "../components/Alert";
import EmptyState from "../components/EmptyState";
import OrderCard from "../components/OrderCard";
import OrderTracker from "../components/OrderTracker";
import PageHeader from "../components/PageHeader";
import Pagination from "../components/Pagination";
import { SkeletonList } from "../components/Skeleton";
import useFetch from "../hooks/useFetch";
import { ALL_STATUSES, label } from "../utils";

function ReviewForm({ order, onDone, onError }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/orders/${order.id}/review`, { rating: Number(rating), comment: comment || null });
      onDone("Thanks for your review!");
    } catch (err) {
      onError(errorMessage(err));
    }
  };
  return (
    <form className="inline-form" onSubmit={submit}>
      <select value={rating} onChange={(e) => setRating(e.target.value)} aria-label="Rating">
        {[5, 4, 3, 2, 1].map((n) => (
          <option key={n} value={n}>
            {"★".repeat(n)} {n}
          </option>
        ))}
      </select>
      <input placeholder="How was your food? (optional)" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
      <button className="btn">Submit review</button>
    </form>
  );
}

function ReturnForm({ order, onDone, onError }) {
  const [reason, setReason] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/orders/${order.id}/return`, { reason });
      onDone("Return request sent to the restaurant.");
    } catch (err) {
      onError(errorMessage(err));
    }
  };
  return (
    <form className="inline-form" onSubmit={submit}>
      <input required minLength={5} maxLength={500} placeholder="Reason for return / refund" value={reason} onChange={(e) => setReason(e.target.value)} />
      <button className="btn btn-light">Request return</button>
    </form>
  );
}

export default function CustomerDashboard() {
  const [filters, setFilters] = useState({ status: "", date_from: "", date_to: "" });
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const { data, loading, error, reload } = useFetch("/orders", { ...filters, page, page_size: 5 });

  const done = (msg) => {
    setNotice(msg);
    setActionError("");
    reload();
  };

  const cancel = async (id) => {
    if (!window.confirm("Cancel this order?")) return;
    try {
      await api.post(`/orders/${id}/cancel`);
      done("Order cancelled and payment refunded.");
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const change = (k) => (e) => {
    setPage(1);
    setFilters({ ...filters, [k]: e.target.value });
  };

  return (
    <>
      <PageHeader
        eyebrow="Customer"
        title="My orders"
        subtitle="Track current orders, review past ones and request returns."
        actions={
          <button className="btn btn-light" onClick={reload} disabled={loading}>
            ↻ Refresh
          </button>
        }
      />

      <div className="toolbar">
        <select value={filters.status} onChange={change("status")} aria-label="Status">
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
        <label className="field-inline">
          From <input type="date" value={filters.date_from} onChange={change("date_from")} />
        </label>
        <label className="field-inline">
          To <input type="date" value={filters.date_to} onChange={change("date_to")} />
        </label>
      </div>

      <Alert type="success" onClose={() => setNotice("")}>{notice}</Alert>
      <Alert onClose={() => setActionError("")}>{actionError || error}</Alert>
      {loading && !data && <SkeletonList />}
      {data && data.items.length === 0 && (
        <EmptyState
          icon="🧾"
          title="No orders found"
          action={
            <Link className="btn" to="/restaurants">
              Order something tasty
            </Link>
          }
        >
          Orders you place will show up here.
        </EmptyState>
      )}

      <div className="stagger" key={`${JSON.stringify(filters)}-${page}`}>
        {data?.items.map((o) => (
          <OrderCard key={o.id} order={o}>
            <OrderTracker status={o.status} />
            {o.status === "PLACED" && (
              <div className="order-actions">
                <button className="btn btn-danger" onClick={() => cancel(o.id)}>
                  Cancel order
                </button>
              </div>
            )}
            {["DELIVERED", "REFUNDED"].includes(o.status) && (
              <>
                {o.review ? (
                  <p className="review-note">
                    Your review: <b style={{ color: "#b45309" }}>{"★".repeat(o.review.rating)}</b> {o.review.comment}
                  </p>
                ) : (
                  <ReviewForm order={o} onDone={done} onError={setActionError} />
                )}
                {o.status === "DELIVERED" && !o.return_request && <ReturnForm order={o} onDone={done} onError={setActionError} />}
                {o.return_request?.owner_note && <p className="small muted">Restaurant note: {o.return_request.owner_note}</p>}
              </>
            )}
          </OrderCard>
        ))}
      </div>
      {data && <Pagination page={data.page} pages={data.pages} onChange={setPage} />}
    </>
  );
}
