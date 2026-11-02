import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { errorMessage } from "../api/client";
import Alert from "../components/Alert";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { foodEmoji, money } from "../utils";

export default function Cart() {
  const { cart, setQuantity, removeItem, clear, total, count } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [address, setAddress] = useState(user?.address || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (cart.items.length === 0) {
    return (
      <EmptyState
        icon="🛒"
        title="Your cart is empty"
        action={
          <Link className="btn" to="/restaurants">
            Browse restaurants
          </Link>
        }
      >
        Add some delicious dishes to get started.
      </EmptyState>
    );
  }

  const checkout = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/orders", {
        restaurant_id: cart.restaurantId,
        delivery_address: address,
        items: cart.items.map((i) => ({ menu_item_id: i.id, quantity: i.quantity })),
      });
      clear();
      navigate("/orders");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Checkout"
        title="Your cart"
        subtitle={
          <>
            {count} item(s) from <Link to={`/restaurants/${cart.restaurantId}`}>{cart.restaurantName}</Link>
          </>
        }
      />

      <div className="cart-layout">
        <section className="card">
          {cart.items.map((i) => (
            <div key={i.id} className="cart-line">
              <span className="thumb" aria-hidden="true">{foodEmoji(i.name)}</span>
              <div className="info">
                <b>{i.name}</b>
                <span className="muted small">{money(i.price)} each</span>
              </div>
              <div className="controls row">
                <div className="stepper">
                  <button type="button" aria-label={`Decrease ${i.name}`} onClick={() => setQuantity(i.id, i.quantity - 1)}>
                    −
                  </button>
                  <output aria-live="polite">{i.quantity}</output>
                  <button type="button" aria-label={`Increase ${i.name}`} onClick={() => setQuantity(i.id, i.quantity + 1)}>
                    +
                  </button>
                </div>
                <span className="price">{money(i.price * i.quantity)}</span>
                <button type="button" className="icon-btn danger" aria-label={`Remove ${i.name}`} title="Remove" onClick={() => removeItem(i.id)}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </section>

        <form className="card form summary" onSubmit={checkout}>
          <h3>Order summary</h3>
          <div>
            <div className="summary-row">
              <span className="muted">Subtotal</span>
              <span>{money(total)}</span>
            </div>
            <div className="summary-row">
              <span className="muted">Delivery</span>
              <span style={{ color: "var(--success)", fontWeight: 600 }}>Free</span>
            </div>
            <div className="summary-row total">
              <span>Total</span>
              <span>{money(total)}</span>
            </div>
          </div>
          <Alert onClose={() => setError("")}>{error}</Alert>
          <label>
            Delivery address
            <textarea required minLength={5} rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Hostel block, room number..." />
          </label>
          <p className="muted small">💳 Payment is simulated: your order is marked as paid (mock_paid) when placed.</p>
          <button className="btn btn-lg btn-block" disabled={busy}>
            {busy ? "Placing order..." : `Place order · ${money(total)}`}
          </button>
        </form>
      </div>
    </>
  );
}
