import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { errorMessage } from "../api/client";
import Alert from "../components/Alert";
import { useAuth } from "../context/AuthContext";
import { roleHome } from "../utils";
import { AuthAside } from "./Login";

const ROLES = [
  ["customer", "🍽️", "Customer"],
  ["restaurant_owner", "🏪", "Restaurant owner"],
  ["delivery_partner", "🛵", "Delivery partner"],
];

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
    <div className="auth">
      <AuthAside title="Join CampusBite" text="Create an account in seconds and start ordering, cooking or delivering." />
      <form className="auth-form form" onSubmit={submit}>
        <div>
          <span className="eyebrow">Sign up</span>
          <h1>Create your account</h1>
          <p className="muted small">
            Already registered? <Link to="/login">Log in</Link>
          </p>
        </div>
        <Alert onClose={() => setError("")}>{error}</Alert>

        <fieldset className="form">
          <legend className="small" style={{ fontWeight: 600, color: "var(--text-2)", marginBottom: "0.35rem" }}>
            I am a
          </legend>
          <div className="role-picker" role="radiogroup" aria-label="Account type">
            {ROLES.map(([value, icon, text]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={form.role === value}
                className={form.role === value ? "role-option active" : "role-option"}
                onClick={() => setForm({ ...form, role: value })}
              >
                <span aria-hidden="true">{icon}</span>
                {text}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="form-grid compact">
          <label>
            Full name
            <input autoComplete="name" required minLength={2} value={form.name} onChange={set("name")} />
          </label>
          <label>
            Phone
            <input type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} />
          </label>
        </div>
        <label>
          Email
          <input type="email" autoComplete="email" required value={form.email} onChange={set("email")} />
        </label>
        <label>
          Password
          <input type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={form.password} onChange={set("password")} />
          <span className="hint">At least 8 characters</span>
        </label>
        {form.role === "customer" && (
          <label>
            Default delivery address
            <input autoComplete="street-address" value={form.address} onChange={set("address")} />
          </label>
        )}
        {form.role === "restaurant_owner" && (
          <div className="form-grid compact">
            <label>
              Restaurant name
              <input required minLength={2} value={form.restaurant_name} onChange={set("restaurant_name")} />
            </label>
            <label>
              Cuisine
              <input value={form.cuisine} onChange={set("cuisine")} />
            </label>
          </div>
        )}
        <button className="btn btn-lg btn-block" disabled={busy}>
          {busy ? "Creating..." : "Create account"}
        </button>
      </form>
    </div>
  );
}
