import { formatDate, money } from "../utils";
import StatusBadge from "./StatusBadge";

// Shared order card; role-specific actions are passed as children.
export default function OrderCard({ order, showCustomer = false, children }) {
  return (
    <article className="card order">
      <header className="row between wrap">
        <div>
          <h3>
            Order #{order.id} · {order.restaurant_name}
          </h3>
          <small className="muted">{formatDate(order.created_at)}</small>
        </div>
        <StatusBadge status={order.status} />
      </header>

      <ul className="lines">
        {order.items.map((i) => (
          <li key={i.id} className="row between">
            <span>
              {i.quantity} × {i.name}
            </span>
            <span>{money(i.price * i.quantity)}</span>
          </li>
        ))}
      </ul>

      <div className="row between wrap">
        <strong>Total {money(order.total_amount)}</strong>
        <span className="muted">
          Payment: <b>{order.payment_status}</b>
          {order.return_request && (
            <>
              {" "}
              · Return: <b>{order.return_request.status}</b>
            </>
          )}
        </span>
      </div>

      <p className="muted small">
        Deliver to: {order.delivery_address}
        {showCustomer && (
          <>
            <br />
            Customer: {order.customer_name}
            {order.customer_phone ? ` · ${order.customer_phone}` : ""}
          </>
        )}
        {order.delivery_partner_name && (
          <>
            <br />
            Delivery partner: {order.delivery_partner_name}
          </>
        )}
      </p>

      {children}
    </article>
  );
}
