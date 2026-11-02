import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { errorMessage } from "../api/client";
import Alert from "../components/Alert";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { money } from "../utils";

export default function Cart() {
  const { cart, setQuantity, removeItem, clear, total } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [address, setAddress] = useState(user?.address || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (cart.items.length === 0) {
    return (
      <p className="center muted">
        Your cart is empty. <Link to="/restaurants">Browse restaurants</Link>
      </p>
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
      <h2>Cart · {cart.restaurantName}</h2>
      <div className="card">
        {cart.items.map((i) => (
          <div key={i.id} className="row between wrap cart-line">
            <span>{i.name}</span>
            <span className="row">
              <button className="btn btn-light" aria-label="Decrease" onClick={() => setQuantity(i.id, i.quantity - 1)}>
                −
              </button>
              <b>{i.quantity}</b>
              <button className="btn btn-light" aria-label="Increase" onClick={() => setQuantity(i.id, i.quantity + 1)}>
                +
              </button>
              <span className="price">{money(i.price * i.quantity)}</span>
              <button className="btn btn-danger" onClick={() => removeItem(i.id)}>
                Remove
              </button>
            </span>
          </div>
        ))}
        <hr />
        <div className="row between">
          <strong>Total</strong>
          <strong>{money(total)}</strong>
        </div>
      </div>

      <form className="card form" onSubmit={checkout}>
        <h3>Checkout</h3>
        <Alert onClose={() => setError("")}>{error}</Alert>
        <label>
          Delivery address
          <input required minLength={5} value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <p className="muted small">Payment is simulated: the order is marked as paid (mock_paid) when placed.</p>
        <button className="btn" disabled={busy}>
          {busy ? "Placing order..." : `Place order · ${money(total)}`}
        </button>
      </form>
    </>
  );
}
