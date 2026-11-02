import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { errorMessage } from "../api/client";
import Alert from "../components/Alert";
import { useAuth } from "../context/AuthContext";
import { roleHome } from "../utils";

const DEMO = [
  ["Customer", "customer@campusbite.dev"],
  ["Owner", "owner1@campusbite.dev"],
  ["Driver", "driver1@campusbite.dev"],
];
const DEMO_PASSWORD = "Password@123";

export function AuthAside({ title, text }) {
  return (
    <aside className="auth-aside">
      <div>
        <span className="brand-mark" aria-hidden="true">🍔</span>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      <ul>
        <li><span>🍕</span> Order from campus favourites</li>
        <li><span>📍</span> Track every step to your door</li>
        <li><span>✨</span> AI insights on your orders</li>
      </ul>
    </aside>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const user = await login(form.email, form.password);
      navigate(location.state?.from || roleHome(user.role), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <AuthAside title="Welcome back!" text="Log in to order food, manage your restaurant or handle deliveries." />
      <form className="auth-form form" onSubmit={submit}>
        <div>
          <span className="eyebrow">Sign in</span>
          <h1>Log in to CampusBite</h1>
          <p className="muted small">
            New here? <Link to="/register">Create an account</Link>
          </p>
        </div>
        <Alert onClose={() => setError("")}>{error}</Alert>
        <label>
          Email
          <input type="email" autoComplete="email" required placeholder="you@campus.edu" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label>
          Password
          <input type="password" autoComplete="current-password" required placeholder="••••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        <button className="btn btn-lg btn-block" disabled={busy}>
          {busy ? "Signing in..." : "Log in"}
        </button>
        <div className="demo-accounts">
          <span className="small muted">Try a demo account (password {DEMO_PASSWORD}):</span>
          <div className="chips">
            {DEMO.map(([name, email]) => (
              <button key={email} type="button" className="chip" onClick={() => setForm({ email, password: DEMO_PASSWORD })}>
                {name}
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}
