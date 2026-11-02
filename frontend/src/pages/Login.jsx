import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { errorMessage } from "../api/client";
import Alert from "../components/Alert";
import { useAuth } from "../context/AuthContext";
import { roleHome } from "../utils";

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
    <form className="card form narrow" onSubmit={submit}>
      <h2>Log in</h2>
      <Alert onClose={() => setError("")}>{error}</Alert>
      <label>
        Email
        <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </label>
      <label>
        Password
        <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      </label>
      <button className="btn" disabled={busy}>
        {busy ? "Signing in..." : "Log in"}
      </button>
      <p className="muted small">
        New here? <Link to="/register">Create an account</Link>
      </p>
      <details className="small muted">
        <summary>Demo accounts (password: Password@123)</summary>
        customer@campusbite.dev · owner1@campusbite.dev · owner2@campusbite.dev · driver1@campusbite.dev · driver2@campusbite.dev
      </details>
    </form>
  );
}
