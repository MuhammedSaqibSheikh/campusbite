import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { errorMessage } from "../api/client";
import Alert from "../components/Alert";
import { useAuth } from "../context/AuthContext";
import { roleHome } from "../utils";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "customer",
    phone: "",
    address: "",
    restaurant_name: "",
    cuisine: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ""));
    try {
      const user = await register(payload);
      navigate(roleHome(user.role), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form narrow" onSubmit={submit}>
      <h2>Create account</h2>
      <Alert onClose={() => setError("")}>{error}</Alert>
      <label>
        I am a
        <select value={form.role} onChange={set("role")}>
          <option value="customer">Customer</option>
          <option value="restaurant_owner">Restaurant owner</option>
          <option value="delivery_partner">Delivery partner</option>
        </select>
      </label>
      <label>
        Full name
        <input required minLength={2} value={form.name} onChange={set("name")} />
      </label>
      <label>
        Email
        <input type="email" required value={form.email} onChange={set("email")} />
      </label>
      <label>
        Password (min 8 characters)
        <input type="password" required minLength={8} maxLength={72} value={form.password} onChange={set("password")} />
      </label>
      <label>
        Phone
        <input value={form.phone} onChange={set("phone")} />
      </label>
      {form.role === "customer" && (
        <label>
          Default delivery address
          <input value={form.address} onChange={set("address")} />
        </label>
      )}
      {form.role === "restaurant_owner" && (
        <>
          <label>
            Restaurant name
            <input required minLength={2} value={form.restaurant_name} onChange={set("restaurant_name")} />
          </label>
          <label>
            Cuisine
            <input value={form.cuisine} onChange={set("cuisine")} />
          </label>
        </>
      )}
      <button className="btn" disabled={busy}>
        {busy ? "Creating..." : "Sign up"}
      </button>
      <p className="muted small">
        Already registered? <Link to="/login">Log in</Link>
      </p>
    </form>
  );
}
