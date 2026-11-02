import { formatDate, money } from "../utils";
import StatusBadge from "./StatusBadge";

// Shared order card; role-specific actions are passed as children.
export default function OrderCard({ order, showCustomer = false, children }) {
  return (
    <article className="card order">
      <header className="order-head">
        <div>
          <h3>
            {order.restaurant_name} <span className="order-id">#{order.id}</span>
          </h3>
          <small className="muted">{formatDate(order.created_at)}</small>
        </div>
        <StatusBadge status={order.status} />
      </header>

      <ul className="lines">
        {order.items.map((i) => (
          <li key={i.id}>
            <span>
              <span className="qty">{i.quantity}×</span>
              {i.name}
            </span>
            <span>{money(i.price * i.quantity)}</span>
          </li>
        ))}
      </ul>

      <div className="order-total">
        <strong>Total {money(order.total_amount)}</strong>
        <span className="row wrap small">
          <span className="tag">💳 {order.payment_status}</span>
          {order.return_request && <span className="tag">↩ Return: {order.return_request.status}</span>}
        </span>
      </div>

      <div className="order-meta">
        <span>
          📍 <b>Deliver to:</b> {order.delivery_address}
        </span>
        {showCustomer && (
          <span>
            👤 <b>Customer:</b> {order.customer_name}
            {order.customer_phone ? ` · ${order.customer_phone}` : ""}
          </span>
        )}
        {order.delivery_partner_name && (
          <span>
            🛵 <b>Delivery partner:</b> {order.delivery_partner_name}
          </span>
        )}
      </div>

      {children}
    </article>
  );
}
