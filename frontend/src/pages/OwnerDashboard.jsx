import { useState } from "react";
import api, { errorMessage } from "../api/client";
import Alert from "../components/Alert";
import Spinner from "../components/Spinner";
import useFetch from "../hooks/useFetch";
import { formatDate, money, label } from "../utils";

export default function OwnerDashboard() {
  const stats = useFetch("/owner/stats");
  const reminders = useFetch("/owner/reminders", { page_size: 20 });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const scan = async () => {
    try {
      const res = await api.post("/owner/reminders/scan");
      setNotice(`${res.data.created} new reminder(s) created`);
      reminders.reload();
      stats.reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const s = stats.data;
  return (
    <>
      <h2>Restaurant dashboard</h2>
      <Alert>{stats.error || error}</Alert>
      <Alert type="success" onClose={() => setNotice("")}>{notice}</Alert>
      {stats.loading && <Spinner />}

      {s && (
        <div className="stats">
          <div className="card stat"><b>{s.total_orders}</b><span>Total orders</span></div>
          <div className="card stat"><b>{s.active_orders}</b><span>Active orders</span></div>
          <div className="card stat"><b>{s.delivered_orders}</b><span>Delivered</span></div>
          <div className="card stat"><b>{money(s.revenue)}</b><span>Revenue (delivered)</span></div>
          <div className="card stat">
            <b>{s.average_rating ?? "–"}</b>
            <span>Avg rating ({s.review_count})</span>
          </div>
          <div className="card stat"><b>{s.pending_returns}</b><span>Pending returns</span></div>
        </div>
      )}

      <div className="row wrap top">
        <section className="card grow">
          <div className="row between">
            <h3>Reminders</h3>
            <button className="btn btn-light" onClick={scan}>
              Check now
            </button>
          </div>
          <p className="muted small">Orders left in PLACED or ACCEPTED without an update.</p>
          {reminders.loading && <Spinner />}
          {reminders.data?.items.length === 0 && <p className="muted">No reminders. Nice work!</p>}
          <ul className="plain">
            {reminders.data?.items.map((r) => (
              <li key={r.id} className="reminder">
                {r.message} <small className="muted">({formatDate(r.created_at)})</small>
              </li>
            ))}
          </ul>
        </section>

        {s && (
          <section className="card grow">
            <h3>Orders by status</h3>
            <ul className="plain">
              {Object.entries(s.orders_by_status).map(([k, v]) => (
                <li key={k} className="row between">
                  <span>{label(k)}</span>
                  <b>{v}</b>
                </li>
              ))}
            </ul>
            <h3>Top dishes</h3>
            {s.top_items.length === 0 && <p className="muted">No orders yet.</p>}
            <ul className="plain">
              {s.top_items.map((t) => (
                <li key={t.name} className="row between">
                  <span>{t.name}</span>
                  <b>{t.quantity}</b>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
