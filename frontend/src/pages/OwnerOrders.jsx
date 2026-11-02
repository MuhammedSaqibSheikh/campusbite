import { useState } from "react";
import api, { errorMessage } from "../api/client";
import Alert from "../components/Alert";
import OrderCard from "../components/OrderCard";
import Pagination from "../components/Pagination";
import Spinner from "../components/Spinner";
import useFetch from "../hooks/useFetch";
import { ALL_STATUSES, label } from "../utils";

const NEXT = { PLACED: "ACCEPTED", ACCEPTED: "PREPARING", PREPARING: "READY" };
const NEXT_LABEL = { PLACED: "Accept order", ACCEPTED: "Start preparing", PREPARING: "Mark ready" };

function AssignForm({ orderId, partners, onDone, onError }) {
  const [partnerId, setPartnerId] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/owner/orders/${orderId}/assign`, { delivery_partner_id: Number(partnerId) });
      onDone();
    } catch (err) {
      onError(errorMessage(err));
    }
  };
  return (
    <form className="row wrap inline-form" onSubmit={submit}>
      <select required value={partnerId} onChange={(e) => setPartnerId(e.target.value)} aria-label="Delivery partner">
        <option value="">Select delivery partner</option>
        {partners.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button className="btn">Assign</button>
    </form>
  );
}

export default function OwnerOrders() {
  const [filters, setFilters] = useState({ status: "", date_from: "", date_to: "" });
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const orders = useFetch("/owner/orders", { ...filters, page, page_size: 5 });
  const partners = useFetch("/owner/delivery-partners");

  const advance = async (order) => {
    try {
      await api.patch(`/owner/orders/${order.id}/status`, { status: NEXT[order.status] });
      setError("");
      orders.reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const change = (k) => (e) => {
    setPage(1);
    setFilters({ ...filters, [k]: e.target.value });
  };

  return (
    <>
      <div className="row between wrap">
        <h2>Incoming orders</h2>
        <button className="btn btn-light" onClick={orders.reload}>
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

      <Alert onClose={() => setError("")}>{error || orders.error}</Alert>
      {orders.loading && <Spinner />}
      {orders.data && !orders.loading && orders.data.items.length === 0 && <p className="center muted">No orders found.</p>}

      {orders.data?.items.map((o) => (
        <OrderCard key={o.id} order={o} showCustomer>
          {NEXT[o.status] && (
            <button className="btn" onClick={() => advance(o)}>
              {NEXT_LABEL[o.status]}
            </button>
          )}
          {o.status === "READY" && (
            <AssignForm
              orderId={o.id}
              partners={partners.data || []}
              onError={setError}
              onDone={() => {
                setError("");
                orders.reload();
              }}
            />
          )}
        </OrderCard>
      ))}
      {orders.data && <Pagination page={orders.data.page} pages={orders.data.pages} onChange={setPage} />}
    </>
  );
}
