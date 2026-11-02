import { useState } from "react";
import api, { errorMessage } from "../api/client";
import Alert from "../components/Alert";
import PageHeader from "../components/PageHeader";
import Pagination from "../components/Pagination";
import Spinner from "../components/Spinner";
import useFetch from "../hooks/useFetch";
import { foodEmoji, money } from "../utils";

const BLANK = { name: "", description: "", price: "", category: "", is_available: true };

export default function OwnerMenu() {
  const [page, setPage] = useState(1);
  const menu = useFetch("/owner/menu", { page, page_size: 10 });
  const [form, setForm] = useState(BLANK);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const reset = () => {
    setForm(BLANK);
    setEditingId(null);
  };

  const save = async (e) => {
    e.preventDefault();
    const body = { ...form, price: Number(form.price), description: form.description || null, category: form.category || null };
    try {
      if (editingId) await api.put(`/owner/menu/${editingId}`, body);
      else await api.post("/owner/menu", body);
      setNotice(editingId ? "Dish updated" : "Dish added");
      setError("");
      reset();
      menu.reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const toggle = async (d) => {
    try {
      await api.patch(`/owner/menu/${d.id}/availability`, { is_available: !d.is_available });
      menu.reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remove = async (d) => {
    if (!window.confirm(`Delete ${d.name}?`)) return;
    try {
      await api.delete(`/owner/menu/${d.id}`);
      if (editingId === d.id) reset();
      menu.reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const edit = (d) => {
    setEditingId(d.id);
    setForm({ name: d.name, description: d.description || "", price: d.price, category: d.category || "", is_available: d.is_available });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <PageHeader eyebrow="Restaurant owner" title="Menu management" subtitle="Add dishes, update prices and control availability." />
      <Alert onClose={() => setError("")}>{error || menu.error}</Alert>
      <Alert type="success" onClose={() => setNotice("")}>{notice}</Alert>

      <form className="card form" onSubmit={save} key={editingId || "new"}>
        <div className="card-title">
          <h3>{editingId ? "✏️ Edit dish" : "➕ Add a dish"}</h3>
          {editingId && <span className="tag">Editing #{editingId}</span>}
        </div>
        <div className="form-grid compact">
          <label>
            Name
            <input required minLength={2} value={form.name} onChange={set("name")} placeholder="e.g. Paneer Tikka" />
          </label>
          <label>
            Price (₹)
            <input required type="number" inputMode="decimal" min="0.01" step="0.01" value={form.price} onChange={set("price")} />
          </label>
          <label>
            Category
            <input value={form.category} onChange={set("category")} placeholder="e.g. Starters" />
          </label>
          <label>
            Description
            <input value={form.description} onChange={set("description")} placeholder="Short and tasty" />
          </label>
        </div>
        <div className="row wrap between">
          <label className="inline">
            <input type="checkbox" checked={form.is_available} onChange={set("is_available")} /> Available to order
          </label>
          <div className="row">
            {editingId && (
              <button type="button" className="btn btn-light" onClick={reset}>
                Cancel
              </button>
            )}
            <button className="btn">{editingId ? "Save changes" : "Add dish"}</button>
          </div>
        </div>
      </form>

      {menu.loading && !menu.data && <Spinner />}
      <div className="card table-wrap">
        <table className="responsive-table">
          <thead>
            <tr>
              <th>Dish</th>
              <th>Category</th>
              <th>Price</th>
              <th>Availability</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {menu.data?.items.map((d) => (
              <tr key={d.id}>
                <td className="primary">
                  <div className="row top">
                    <span className="thumb" aria-hidden="true">{foodEmoji(`${d.category} ${d.name}`)}</span>
                    <div>
                      <b>{d.name}</b>
                      <br />
                      <small className="muted">{d.description}</small>
                    </div>
                  </div>
                </td>
                <td data-label="Category">{d.category || "—"}</td>
                <td data-label="Price"><b>{money(d.price)}</b></td>
                <td data-label="Availability">
                  <button type="button" role="switch" aria-checked={d.is_available} className="switch" onClick={() => toggle(d)}>
                    <span className="switch-track" aria-hidden="true" />
                    {d.is_available ? "Available" : "Unavailable"}
                  </button>
                </td>
                <td className="actions">
                  <button className="btn btn-light btn-sm" onClick={() => edit(d)}>Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(d)}>Delete</button>
                </td>
              </tr>
            ))}
            {menu.data?.items.length === 0 && (
              <tr>
                <td colSpan="5" className="center muted primary">No dishes yet. Add your first one above.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {menu.data && <Pagination page={menu.data.page} pages={menu.data.pages} onChange={setPage} />}
    </>
  );
}
