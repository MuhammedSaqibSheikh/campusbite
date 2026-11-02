import { useState } from "react";
import api, { errorMessage } from "../api/client";
import Alert from "../components/Alert";
import EmptyState from "../components/EmptyState";
import OrderCard from "../components/OrderCard";
import OrderTracker from "../components/OrderTracker";
import PageHeader from "../components/PageHeader";
import Pagination from "../components/Pagination";
import { SkeletonList } from "../components/Skeleton";
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
      <PageHeader
        eyebrow="Delivery partner"
        title="My deliveries"
        subtitle="Pick up, deliver and keep customers in the loop."
        actions={
          <button className="btn btn-light" onClick={orders.reload} disabled={orders.loading}>
            ↻ Refresh
          </button>
        }
      />

      <div className="row wrap between">
        <div className="segmented" role="tablist" aria-label="Deliveries">
          <button type="button" role="tab" aria-selected={active} className={active ? "active" : ""} onClick={() => switchTab("active")}>
            🛵 Assigned
          </button>
          <button type="button" role="tab" aria-selected={!active} className={!active ? "active" : ""} onClick={() => switchTab("history")}>
            📜 History
          </button>
        </div>
        {active && (
          <select
            style={{ marginBottom: "1rem" }}
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
      </div>

      <Alert onClose={() => setError("")}>{error || orders.error}</Alert>
      {orders.loading && !orders.data && <SkeletonList />}
      {orders.data && orders.data.items.length === 0 && (
        <EmptyState icon={active ? "🛵" : "📜"} title={active ? "No active deliveries" : "No deliveries yet"}>
          {active ? "New assignments from restaurants will appear here." : "Completed deliveries will be listed here."}
        </EmptyState>
      )}

      <div className="stagger" key={`${tab}-${status}-${page}`}>
        {orders.data?.items.map((o) => (
          <OrderCard key={o.id} order={o} showCustomer>
            <OrderTracker status={o.status} />
            {o.status === "ASSIGNED" && (
              <div className="order-actions">
                <button className="btn btn-lg" onClick={() => update(o, "OUT_FOR_DELIVERY")}>
                  🛵 Mark out for delivery
                </button>
              </div>
            )}
            {o.status === "OUT_FOR_DELIVERY" && (
              <div className="order-actions">
                <button className="btn btn-success btn-lg" onClick={() => update(o, "DELIVERED")}>
                  ✓ Mark delivered
                </button>
              </div>
            )}
          </OrderCard>
        ))}
      </div>
      {orders.data && <Pagination page={orders.data.page} pages={orders.data.pages} onChange={setPage} />}
    </>
  );
}
