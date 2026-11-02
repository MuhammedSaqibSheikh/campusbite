import { useState } from "react";
import api, { errorMessage } from "../api/client";
import Alert from "../components/Alert";
import OrderCard from "../components/OrderCard";
import Pagination from "../components/Pagination";
import Spinner from "../components/Spinner";
import useFetch from "../hooks/useFetch";

export default function DeliveryDashboard() {
  const [tab, setTab] = useState("active");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const active = tab === "active";
  const orders = useFetch(active ? "/delivery/orders" : "/delivery/history", {
    ...(active ? { status } : {}),
    page,
    page_size: 5,
  });

  const update = async (order, next) => {
    try {
      await api.patch(`/delivery/orders/${order.id}/status`, { status: next });
      setError("");
      orders.reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const switchTab = (t) => {
    setTab(t);
    setPage(1);
    setStatus("");
  };

  return (
    <>
      <div className="row between wrap">
        <h2>My deliveries</h2>
        <button className="btn btn-light" onClick={orders.reload}>
          Refresh
        </button>
      </div>
      <div className="tabs">
        <button className={active ? "tab active" : "tab"} onClick={() => switchTab("active")}>
          Assigned
        </button>
        <button className={!active ? "tab active" : "tab"} onClick={() => switchTab("history")}>
          History
        </button>
      </div>
      {active && (
        <select
          className="filters"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          aria-label="Status"
        >
          <option value="">All active</option>
          <option value="ASSIGNED">Assigned</option>
          <option value="OUT_FOR_DELIVERY">Out for delivery</option>
        </select>
      )}

      <Alert onClose={() => setError("")}>{error || orders.error}</Alert>
      {orders.loading && <Spinner />}
      {orders.data && !orders.loading && orders.data.items.length === 0 && <p className="center muted">Nothing here.</p>}

      {orders.data?.items.map((o) => (
        <OrderCard key={o.id} order={o} showCustomer>
          {o.status === "ASSIGNED" && (
            <button className="btn" onClick={() => update(o, "OUT_FOR_DELIVERY")}>
              Mark out for delivery
            </button>
          )}
          {o.status === "OUT_FOR_DELIVERY" && (
            <button className="btn" onClick={() => update(o, "DELIVERED")}>
              Mark delivered
            </button>
          )}
        </OrderCard>
      ))}
      {orders.data && <Pagination page={orders.data.page} pages={orders.data.pages} onChange={setPage} />}
    </>
  );
}
