import { useEffect, useRef, useState } from "react";
import api, { errorMessage } from "../api/client";
import Alert from "../components/Alert";
import Avatar from "../components/Avatar";
import PageHeader from "../components/PageHeader";
import Spinner from "../components/Spinner";
import { useAuth } from "../context/AuthContext";
import useFetch from "../hooks/useFetch";
import { coverFor, formatDate, mediaUrl, roleName } from "../utils";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_MB = 5;
const VEHICLES = [
  ["bicycle", "🚲 Bicycle"],
  ["scooter", "🛵 Scooter"],
  ["motorbike", "🏍️ Motorbike"],
  ["car", "🚗 Car"],
  ["on_foot", "🚶 On foot"],
];

const today = () => new Date().toISOString().slice(0, 10);

export function checkImage(file) {
  if (!IMAGE_TYPES.includes(file.type)) return "Please choose a JPG, PNG, WEBP or GIF image.";
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) return `Images must be ${MAX_IMAGE_MB} MB or smaller.`;
  return "";
}

const upload = (url, file) => {
  const body = new FormData();
  body.append("file", file);
  return api.post(url, body);
};

// Turns "" into null so optional fields can be cleared.
const clean = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === "" ? null : v]));

/* ---------------- Personal details ---------------- */
function PersonalTab() {
  const { user, updateUser } = useAuth();
  const profile = useFetch("/profile");
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileRef = useRef(null);
  const isDriver = user.role === "delivery_partner";

  useEffect(() => {
    const p = profile.data;
    if (p) {
      setForm({
        name: p.name || "",
        phone: p.phone || "",
        date_of_birth: p.date_of_birth || "",
        bio: p.bio || "",
        address: p.address || "",
        vehicle_type: p.vehicle_type || "",
        vehicle_number: p.vehicle_number || "",
      });
    }
  }, [profile.data]);

  if (profile.loading && !profile.data) return <Spinner />;
  if (!form) return <Alert>{profile.error}</Alert>;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = { ...form };
    if (!isDriver) {
      delete body.vehicle_type;
      delete body.vehicle_number;
    }
    try {
      const res = await api.put("/profile", clean(body));
      updateUser(res.data);
      setNotice("Profile saved");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onAvatar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const problem = checkImage(file);
    if (problem) return setError(problem);
    setUploading(true);
    setError("");
    try {
      const res = await upload("/profile/avatar", file);
      updateUser(res.data);
      setNotice("Profile picture updated");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    try {
      updateUser((await api.delete("/profile/avatar")).data);
      setNotice("Profile picture removed");
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <>
      <Alert onClose={() => setError("")}>{error}</Alert>
      <Alert type="success" onClose={() => setNotice("")}>{notice}</Alert>

      <section className="card profile-hero">
        <Avatar user={user} size={96} className="avatar-lg" />
        <div className="grow">
          <h2 style={{ margin: 0 }}>{user.name}</h2>
          <p className="muted small" style={{ margin: "0.15rem 0 0.6rem" }}>
            {roleName(user.role)} · {user.email}
            {profile.data?.created_at && <> · Member since {formatDate(profile.data.created_at).split(",")[0]}</>}
          </p>
          <div className="row wrap">
            <input ref={fileRef} type="file" accept={IMAGE_TYPES.join(",")} hidden onChange={onAvatar} />
            <button type="button" className="btn btn-sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? "Uploading..." : "📷 Change photo"}
            </button>
            {user.avatar_url && (
              <button type="button" className="btn btn-light btn-sm" onClick={removeAvatar}>
                Remove
              </button>
            )}
            <span className="hint">JPG, PNG, WEBP or GIF · up to {MAX_IMAGE_MB} MB</span>
          </div>
        </div>
      </section>

      <form className="card form" onSubmit={save}>
        <h3>Personal details</h3>
        <div className="form-grid wide">
          <label>
            Full name
            <input required minLength={2} maxLength={100} autoComplete="name" value={form.name} onChange={set("name")} />
          </label>
          <label>
            Email
            <input value={user.email} disabled />
          </label>
          <label>
            Phone
            <input type="tel" autoComplete="tel" placeholder="+91 98765 43210" value={form.phone} onChange={set("phone")} />
          </label>
          <label>
            Date of birth
            <input type="date" max={today()} autoComplete="bday" value={form.date_of_birth} onChange={set("date_of_birth")} />
          </label>
        </div>
        {user.role === "customer" && (
          <label>
            Default delivery address
            <input autoComplete="street-address" maxLength={255} value={form.address} onChange={set("address")} />
          </label>
        )}
        {isDriver && (
          <div className="form-grid wide">
            <label>
              Vehicle
              <select value={form.vehicle_type} onChange={set("vehicle_type")}>
                <option value="">Select vehicle</option>
                {VEHICLES.map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Vehicle number
              <input maxLength={20} placeholder="KA 01 AB 1234" value={form.vehicle_number} onChange={set("vehicle_number")} />
            </label>
          </div>
        )}
        <label>
          About me
          <textarea rows={3} maxLength={300} placeholder="A line or two about you" value={form.bio} onChange={set("bio")} />
          <span className="hint">{form.bio.length}/300</span>
        </label>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn" disabled={busy}>
            {busy ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </>
  );
}

/* ---------------- Restaurant (owners) ---------------- */
function RestaurantTab() {
  const restaurant = useFetch("/owner/restaurant");
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const r = restaurant.data;

  useEffect(() => {
    if (r) {
      setForm({
        name: r.name || "",
        cuisine: r.cuisine || "",
        description: r.description || "",
        address: r.address || "",
        phone: r.phone || "",
        opening_hours: r.opening_hours || "",
      });
    }
  }, [r]);

  if (restaurant.loading && !r) return <Spinner />;
  if (!form) return <Alert>{restaurant.error}</Alert>;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.put("/owner/restaurant", clean(form));
      setNotice("Restaurant details saved");
      restaurant.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onCover = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const problem = checkImage(file);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      await upload("/owner/restaurant/image", file);
      setNotice("Cover photo updated");
      restaurant.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const removeCover = async () => {
    try {
      await api.delete("/owner/restaurant/image");
      restaurant.reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <>
      <Alert onClose={() => setError("")}>{error}</Alert>
      <Alert type="success" onClose={() => setNotice("")}>{notice}</Alert>
      <section className="card cover-editor" style={r.image_url ? undefined : { background: coverFor(r.name) }}>
        {r.image_url && <img src={mediaUrl(r.image_url)} alt={`${r.name} cover`} />}
        <div className="cover-actions">
          <input ref={fileRef} type="file" accept={IMAGE_TYPES.join(",")} hidden onChange={onCover} />
          <button type="button" className="btn btn-light btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
            📷 {r.image_url ? "Change cover" : "Add cover photo"}
          </button>
          {r.image_url && (
            <button type="button" className="btn btn-light btn-sm" onClick={removeCover}>
              Remove
            </button>
          )}
        </div>
      </section>
      <form className="card form" onSubmit={save}>
        <h3>Restaurant details</h3>
        <div className="form-grid wide">
          <label>
            Restaurant name
            <input required minLength={2} maxLength={150} value={form.name} onChange={set("name")} />
          </label>
          <label>
            Cuisine
            <input maxLength={80} placeholder="e.g. Indian" value={form.cuisine} onChange={set("cuisine")} />
          </label>
          <label>
            Phone
            <input type="tel" maxLength={30} value={form.phone} onChange={set("phone")} />
          </label>
          <label>
            Opening hours
            <input maxLength={100} placeholder="10:00 – 22:00, Mon–Sat" value={form.opening_hours} onChange={set("opening_hours")} />
          </label>
        </div>
        <label>
          Address
          <input maxLength={255} value={form.address} onChange={set("address")} />
        </label>
        <label>
          Description
          <textarea rows={3} maxLength={2000} value={form.description} onChange={set("description")} />
        </label>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn" disabled={busy}>
            {busy ? "Saving..." : "Save restaurant"}
          </button>
        </div>
      </form>
    </>
  );
}

/* ---------------- Dummy payment cards ---------------- */
const BRAND_LABEL = { visa: "VISA", mastercard: "Mastercard", amex: "AMEX", rupay: "RuPay", discover: "Discover", card: "Card" };

export function detectBrand(digits) {
  const n2 = Number(digits.slice(0, 2));
  const n3 = Number(digits.slice(0, 3));
  const n4 = Number(digits.slice(0, 4));
  if (/^3[47]/.test(digits)) return "amex";
  if (/^4/.test(digits)) return "visa";
  if ((n2 >= 51 && n2 <= 55) || (n4 >= 2221 && n4 <= 2720)) return "mastercard";
  if (/^(6011|65)/.test(digits) || (n3 >= 644 && n3 <= 649)) return "discover";
  if (/^(60|81|82|508)/.test(digits)) return "rupay";
  return "card";
}

function luhn(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return digits.length >= 12 && sum % 10 === 0;
}

function CardFace({ brand, last4, name, month, year, isDefault, preview }) {
  return (
    <div className={`credit-card brand-${brand}${preview ? " preview" : ""}`}>
      <div className="row between">
        <span className="chip-icon" aria-hidden="true" />
        <b className="brand-name">{BRAND_LABEL[brand] || "Card"}</b>
      </div>
      <div className="card-number">•••• •••• •••• {last4 || "••••"}</div>
      <div className="row between small">
        <span className="card-name">{name || "CARDHOLDER NAME"}</span>
        <span>
          {String(month || "MM").padStart(2, "0")}/{String(year || "YY").slice(-2)}
        </span>
      </div>
      {isDefault && <span className="default-flag">Default</span>}
    </div>
  );
}

function CardsTab() {
  const cards = useFetch("/profile/cards");
  const [form, setForm] = useState({ cardholder_name: "", number: "", exp_month: "", exp_year: "", cvv: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const digits = form.number.replace(/\D/g, "");
  const brand = detectBrand(digits);
  const year = new Date().getFullYear();

  const setNumber = (e) => {
    const d = e.target.value.replace(/\D/g, "").slice(0, 19);
    setForm({ ...form, number: d.replace(/(.{4})/g, "$1 ").trim() });
  };

  const add = async (e) => {
    e.preventDefault();
    if (!luhn(digits)) return setError("That card number doesn't look valid. Try the demo number 4111 1111 1111 1111.");
    setBusy(true);
    setError("");
    try {
      await api.post("/profile/cards", { ...form, exp_month: Number(form.exp_month), exp_year: Number(form.exp_year) });
      setForm({ cardholder_name: "", number: "", exp_month: "", exp_year: "", cvv: "" });
      setNotice("Card saved. Only the last 4 digits are stored.");
      cards.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const act = async (request, msg) => {
    try {
      await request();
      setNotice(msg);
      cards.reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <>
      <Alert onClose={() => setError("")}>{error}</Alert>
      <Alert type="success" onClose={() => setNotice("")}>{notice}</Alert>
      <p className="muted small">
        🔒 Demo only. No real payment is made. CampusBite never stores your full card number or CVV, only the brand, the last 4 digits and the expiry date.
      </p>

      {cards.loading && !cards.data && <Spinner />}
      {cards.data?.length > 0 && (
        <div className="card-grid stagger">
          {cards.data.map((c) => (
            <div key={c.id} className="saved-card">
              <CardFace brand={c.brand} last4={c.last4} name={c.cardholder_name} month={c.exp_month} year={c.exp_year} isDefault={c.is_default} />
              <div className="row wrap">
                {!c.is_default && (
                  <button type="button" className="btn btn-light btn-sm" onClick={() => act(() => api.post(`/profile/cards/${c.id}/default`), "Default card updated")}>
                    Make default
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => window.confirm(`Remove card ending ${c.last4}?`) && act(() => api.delete(`/profile/cards/${c.id}`), "Card removed")}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form className="card form add-card" onSubmit={add}>
        <h3>Add a card</h3>
        <div className="add-card-layout">
          <CardFace brand={brand} last4={digits.slice(-4)} name={form.cardholder_name.toUpperCase()} month={form.exp_month} year={form.exp_year} preview />
          <div className="form">
            <label>
              Card number
              <input inputMode="numeric" autoComplete="cc-number" required placeholder="4111 1111 1111 1111" value={form.number} onChange={setNumber} />
            </label>
            <label>
              Name on card
              <input autoComplete="cc-name" required minLength={2} maxLength={100} value={form.cardholder_name} onChange={(e) => setForm({ ...form, cardholder_name: e.target.value })} />
            </label>
            <div className="form-grid three">
              <label>
                Month
                <select required autoComplete="cc-exp-month" value={form.exp_month} onChange={(e) => setForm({ ...form, exp_month: e.target.value })}>
                  <option value="">MM</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {String(i + 1).padStart(2, "0")}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Year
                <select required autoComplete="cc-exp-year" value={form.exp_year} onChange={(e) => setForm({ ...form, exp_year: e.target.value })}>
                  <option value="">YYYY</option>
                  {Array.from({ length: 15 }, (_, i) => (
                    <option key={year + i} value={year + i}>
                      {year + i}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                CVV
                <input type="password" inputMode="numeric" autoComplete="cc-csc" required pattern="\d{3,4}" maxLength={4} value={form.cvv} onChange={(e) => setForm({ ...form, cvv: e.target.value.replace(/\D/g, "") })} />
              </label>
            </div>
            <button className="btn" disabled={busy}>
              {busy ? "Saving..." : "Save card"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

/* ---------------- Security ---------------- */
function SecurityTab() {
  const [form, setForm] = useState({ current_password: "", new_password: "", confirm: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.new_password !== form.confirm) return setError("The new passwords don't match.");
    setBusy(true);
    setError("");
    try {
      await api.post("/profile/password", { current_password: form.current_password, new_password: form.new_password });
      setForm({ current_password: "", new_password: "", confirm: "" });
      setNotice("Password changed");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form" onSubmit={submit} style={{ maxWidth: 520 }}>
      <h3>Change password</h3>
      <Alert onClose={() => setError("")}>{error}</Alert>
      <Alert type="success" onClose={() => setNotice("")}>{notice}</Alert>
      <label>
        Current password
        <input type="password" autoComplete="current-password" required value={form.current_password} onChange={(e) => setForm({ ...form, current_password: e.target.value })} />
      </label>
      <label>
        New password
        <input type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={form.new_password} onChange={(e) => setForm({ ...form, new_password: e.target.value })} />
        <span className="hint">At least 8 characters</span>
      </label>
      <label>
        Confirm new password
        <input type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
      </label>
      <button className="btn" disabled={busy}>
        {busy ? "Saving..." : "Update password"}
      </button>
    </form>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const tabs = [
    ["personal", "👤 Personal"],
    ...(user.role === "restaurant_owner" ? [["restaurant", "🏪 Restaurant"]] : []),
    ["cards", user.role === "delivery_partner" ? "💳 Payout cards" : "💳 Payment cards"],
    ["security", "🔒 Security"],
  ];
  const [tab, setTab] = useState("personal");

  return (
    <>
      <PageHeader eyebrow="Account" title="My profile" subtitle="Manage your personal details, photo, cards and password." />
      <div className="segmented fill" role="tablist" aria-label="Profile sections">
        {tabs.map(([value, text]) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>
            {text}
          </button>
        ))}
      </div>
      <div key={tab} className="page">
        {tab === "personal" && <PersonalTab />}
        {tab === "restaurant" && <RestaurantTab />}
        {tab === "cards" && <CardsTab />}
        {tab === "security" && <SecurityTab />}
      </div>
    </>
  );
}
