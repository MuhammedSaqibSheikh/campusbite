import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { roleHome, roleName } from "../utils";
import Avatar from "./Avatar";

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
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <nav className="navbar" aria-label="Main">
      <div className="nav-inner">
        <Link to={user ? roleHome(user.role) : "/restaurants"} className="brand" aria-label="CampusBite home">
          <span className="brand-mark" aria-hidden="true">🍔</span>
          <span className="brand-text">
            Campus<b>Bite</b>
          </span>
        </Link>

        <button
          type="button"
          className="nav-toggle"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="nav-menu"
          onClick={() => setOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>

        <div id="nav-menu" className={open ? "nav-menu open" : "nav-menu"}>
          <div className="nav-links">
            {!user && <NavLink to="/restaurants">Restaurants</NavLink>}
            {user &&
              LINKS[user.role].map(([to, text]) => (
                <NavLink key={to} to={to} end={to === "/owner"}>
                  {text}
                </NavLink>
              ))}
            {user?.role === "customer" && (
              <NavLink to="/cart" aria-label={`Cart, ${count} item(s)`}>
                Cart {count > 0 && <span className="pill" key={count}>{count}</span>}
              </NavLink>
            )}
            {user && <NavLink to="/profile">Profile</NavLink>}
          </div>

          <div className="nav-user">
            {user ? (
              <>
                <Link to="/profile" className="row nav-profile" title="My profile">
                  <Avatar user={user} />
                  <span className="user-meta">
                    <b className="small">{user.name}</b>
                    <small>{roleName(user.role)}</small>
                  </span>
                </Link>
                <button
                  type="button"
                  className="btn btn-light btn-sm"
                  onClick={() => {
                    logout();
                    navigate("/login");
                  }}
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link className="btn btn-light btn-sm" to="/login">
                  Log in
                </Link>
                <Link className="btn btn-sm" to="/register">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
