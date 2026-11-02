import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { roleHome } from "../utils";

const LINKS = {
  customer: [
    ["/restaurants", "Restaurants"],
    ["/orders", "My Orders"],
    ["/insights", "AI Insights"],
  ],
  restaurant_owner: [
    ["/owner", "Dashboard"],
    ["/owner/orders", "Orders"],
    ["/owner/menu", "Menu"],
    ["/owner/returns", "Returns"],
  ],
  delivery_partner: [["/delivery", "Deliveries"]],
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();

  return (
    <nav className="navbar">
      <Link to={user ? roleHome(user.role) : "/restaurants"} className="brand">
        CampusBite
      </Link>
      <div className="nav-links">
        {!user && <NavLink to="/restaurants">Restaurants</NavLink>}
        {user && LINKS[user.role].map(([to, text]) => (
          <NavLink key={to} to={to} end={to === "/owner"}>
            {text}
          </NavLink>
        ))}
        {user?.role === "customer" && (
          <NavLink to="/cart">
            Cart{count > 0 && <span className="pill">{count}</span>}
          </NavLink>
        )}
      </div>
      <div className="nav-user">
        {user ? (
          <>
            <span className="muted small">{user.name}</span>
            <button
              className="btn btn-light"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link className="btn btn-light" to="/login">
              Login
            </Link>
            <Link className="btn" to="/register">
              Sign up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
