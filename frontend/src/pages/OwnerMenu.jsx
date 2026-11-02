import { useState } from "react";
import api, { errorMessage } from "../api/client";
import Alert from "../components/Alert";
import Pagination from "../components/Pagination";
import Spinner from "../components/Spinner";
import useFetch from "../hooks/useFetch";
import { money } from "../utils";

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
      <h2>Menu management</h2>
      <Alert onClose={() => setError("")}>{error || menu.error}</Alert>
      <Alert type="success" onClose={() => setNotice("")}>{notice}</Alert>

      <form className="card form" onSubmit={save}>
        <h3>{editingId ? "Edit dish" : "Add a dish"}</h3>
        <div className="form-grid">
          <label>
            Name
            <input required minLength={2} value={form.name} onChange={set("name")} />
          </label>
          <label>
            Price
            <input required type="number" min="0.01" step="0.01" value={form.price} onChange={set("price")} />
          </label>
          <label>
            Category
            <input value={form.category} onChange={set("category")} />
          </label>
          <label>
            Description
            <input value={form.description} onChange={set("description")} />
          </label>
        </div>
        <label className="inline">
          <input type="checkbox" checked={form.is_available} onChange={set("is_available")} /> Available
        </label>
        <div className="row">
          <button className="btn">{editingId ? "Save changes" : "Add dish"}</button>
          {editingId && (
            <button type="button" className="btn btn-light" onClick={reset}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {menu.loading && <Spinner />}
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Dish</th>
              <th>Category</th>
              <th>Price</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {menu.data?.items.map((d) => (
              <tr key={d.id}>
                <td>
                  {d.name}
                  <br />
                  <small className="muted">{d.description}</small>
                </td>
                <td>{d.category}</td>
                <td>{money(d.price)}</td>
                <td>
                  <button className={`badge ${d.is_available ? "badge-delivered" : "badge-cancelled"} clickable`} onClick={() => toggle(d)}>
                    {d.is_available ? "Available" : "Unavailable"}
                  </button>
                </td>
                <td className="actions">
                  <button className="btn btn-light" onClick={() => edit(d)}>Edit</button>
                  <button className="btn btn-danger" onClick={() => remove(d)}>Delete</button>
                </td>
              </tr>
            ))}
            {menu.data?.items.length === 0 && (
              <tr>
                <td colSpan="5" className="center muted">No dishes yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {menu.data && <Pagination page={menu.data.page} pages={menu.data.pages} onChange={setPage} />}
    </>
  );
}
