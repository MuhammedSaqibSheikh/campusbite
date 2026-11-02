import { useState } from "react";
import api, { errorMessage } from "../api/client";
import Alert from "../components/Alert";
import OrderCard from "../components/OrderCard";
import OrderTracker from "../components/OrderTracker";
import Pagination from "../components/Pagination";
import Spinner from "../components/Spinner";
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
    <form className="row wrap inline-form" onSubmit={submit}>
      <select value={rating} onChange={(e) => setRating(e.target.value)} aria-label="Rating">
        {[5, 4, 3, 2, 1].map((n) => (
          <option key={n} value={n}>
            {"★".repeat(n)}
          </option>
        ))}
      </select>
      <input placeholder="Comment (optional)" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
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
    <form className="row wrap inline-form" onSubmit={submit}>
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
      <div className="row between wrap">
        <h2>My orders</h2>
        <button className="btn btn-light" onClick={reload}>
          Refresh
        </button>
      </div>

      <div className="row wrap filters">
        <select value={filters.status} onChange={change("status")} aria-label="Status">
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
        <label className="inline">
          From <input type="date" value={filters.date_from} onChange={change("date_from")} />
        </label>
        <label className="inline">
          To <input type="date" value={filters.date_to} onChange={change("date_to")} />
        </label>
      </div>

      <Alert type="success" onClose={() => setNotice("")}>{notice}</Alert>
      <Alert onClose={() => setActionError("")}>{actionError || error}</Alert>
      {loading && <Spinner />}
      {data && !loading && data.items.length === 0 && <p className="center muted">No orders found.</p>}

      {data?.items.map((o) => (
        <OrderCard key={o.id} order={o}>
          <OrderTracker status={o.status} />
          {o.status === "PLACED" && (
            <button className="btn btn-danger" onClick={() => cancel(o.id)}>
              Cancel order
            </button>
          )}
          {["DELIVERED", "REFUNDED"].includes(o.status) && (
            <>
              {o.review ? (
                <p className="small">
                  Your review: {"★".repeat(o.review.rating)} {o.review.comment}
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
      {data && <Pagination page={data.page} pages={data.pages} onChange={setPage} />}
    </>
  );
}
