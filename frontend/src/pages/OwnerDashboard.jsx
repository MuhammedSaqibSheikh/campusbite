import { useState } from "react";
import { Link } from "react-router-dom";
import api, { errorMessage } from "../api/client";
import Alert from "../components/Alert";
import PageHeader from "../components/PageHeader";
import Spinner from "../components/Spinner";
import useFetch from "../hooks/useFetch";
import { formatDate, money, label } from "../utils";

export default function OwnerDashboard() {
  const stats = useFetch("/owner/stats");
  const reminders = useFetch("/owner/reminders", { page_size: 20 });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);

  const scan = async () => {
    setScanning(true);
    try {
      const res = await api.post("/owner/reminders/scan");
      setNotice(`${res.data.created} new reminder(s) created`);
      reminders.reload();
      stats.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setScanning(false);
    }
  };

  const s = stats.data;
  const statusEntries = s ? Object.entries(s.orders_by_status) : [];
  const maxStatus = Math.max(1, ...statusEntries.map(([, v]) => v));

  return (
    <>
      <PageHeader
        eyebrow="Restaurant owner"
        title="Dashboard"
        subtitle="A quick look at how your kitchen is doing today."
        actions={
          <Link className="btn" to="/owner/orders">
            View incoming orders →
          </Link>
        }
      />
      <Alert onClose={error ? () => setError("") : undefined}>{stats.error || error}</Alert>
      <Alert type="success" onClose={() => setNotice("")}>{notice}</Alert>
      {stats.loading && !s && <Spinner />}

      {s && (
        <div className="stats stagger">
          <div className="card stat"><span className="stat-icon" aria-hidden="true">🧾</span><b>{s.total_orders}</b><span>Total orders</span></div>
          <div className="card stat"><span className="stat-icon" aria-hidden="true">🔥</span><b>{s.active_orders}</b><span>Active orders</span></div>
          <div className="card stat"><span className="stat-icon" aria-hidden="true">✅</span><b>{s.delivered_orders}</b><span>Delivered</span></div>
          <div className="card stat"><span className="stat-icon" aria-hidden="true">💰</span><b>{money(s.revenue)}</b><span>Revenue (delivered)</span></div>
          <div className="card stat">
            <span className="stat-icon" aria-hidden="true">⭐</span>
            <b>{s.average_rating ?? "–"}</b>
            <span>Avg rating ({s.review_count})</span>
          </div>
          <div className="card stat"><span className="stat-icon" aria-hidden="true">↩️</span><b>{s.pending_returns}</b><span>Pending returns</span></div>
        </div>
      )}

      <div className="dash-grid">
        <section className="card">
          <div className="card-title">
            <h3>⏰ Reminders</h3>
            <button className="btn btn-light btn-sm" onClick={scan} disabled={scanning}>
              {scanning ? "Checking..." : "Check now"}
            </button>
          </div>
          <p className="muted small">Orders left in PLACED or ACCEPTED without an update.</p>
          {reminders.loading && !reminders.data && <Spinner />}
          {reminders.data?.items.length === 0 && <p className="muted">🎉 No reminders. Nice work!</p>}
          <ul className="plain stagger">
            {reminders.data?.items.map((r) => (
              <li key={r.id} className="reminder">
                <span>
                  {r.message}
                  <br />
                  <small className="muted">{formatDate(r.created_at)}</small>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {s && (
          <section className="card">
            <h3>Orders by status</h3>
            <div style={{ margin: "0.5rem 0 1.25rem" }}>
              {statusEntries.map(([k, v]) => (
                <div key={k} className="bar-row">
                  <span className="small">{label(k)}</span>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${(v / maxStatus) * 100}%` }} />
                  </div>
                  <b>{v}</b>
                </div>
              ))}
            </div>
            <h3>Top dishes</h3>
            {s.top_items.length === 0 && <p className="muted">No orders yet.</p>}
            <ul className="plain">
              {s.top_items.map((t, i) => (
                <li key={t.name} className="row between">
                  <span>
                    <span className="rank">{i + 1}</span>
                    {t.name}
                  </span>
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
