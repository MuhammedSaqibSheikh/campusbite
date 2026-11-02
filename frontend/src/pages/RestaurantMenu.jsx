import { useState } from "react";
import { useParams } from "react-router-dom";
import Alert from "../components/Alert";
import Pagination from "../components/Pagination";
import Spinner from "../components/Spinner";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import useFetch from "../hooks/useFetch";
import { money } from "../utils";

export default function RestaurantMenu() {
  const { id } = useParams();
  const { user } = useAuth();
  const { addItem } = useCart();
  const [filters, setFilters] = useState({ search: "", min_price: "", max_price: "" });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");

  const restaurant = useFetch(`/restaurants/${id}`);
  const menu = useFetch(`/restaurants/${id}/menu`, { ...applied, page, page_size: 12 });

  const add = (dish) => {
    if (!addItem(restaurant.data, dish)) {
      if (window.confirm("Your cart has dishes from another restaurant. Start a new cart?")) {
        addItem(restaurant.data, dish, true);
      } else return;
    }
    setNotice(`${dish.name} added to cart`);
  };

  const apply = (e) => {
    e.preventDefault();
    setPage(1);
    setApplied(filters);
  };

  if (restaurant.loading) return <Spinner />;
  if (restaurant.error) return <Alert>{restaurant.error}</Alert>;
  const r = restaurant.data;

  return (
    <>
      <h2>{r.name}</h2>
      <p className="muted">
        {r.cuisine} · {r.avg_rating ? `★ ${r.avg_rating} (${r.review_count} reviews)` : "No reviews yet"}
      </p>

      <form className="row wrap filters" onSubmit={apply}>
        <input placeholder="Search dishes" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        <input type="number" min="0" placeholder="Min price" value={filters.min_price} onChange={(e) => setFilters({ ...filters, min_price: e.target.value })} />
        <input type="number" min="0" placeholder="Max price" value={filters.max_price} onChange={(e) => setFilters({ ...filters, max_price: e.target.value })} />
        <button className="btn">Filter</button>
      </form>

      <Alert type="success" onClose={() => setNotice("")}>{notice}</Alert>
      <Alert>{menu.error}</Alert>
      {menu.loading && <Spinner />}
      {menu.data && !menu.loading && menu.data.items.length === 0 && <p className="center muted">No dishes match.</p>}

      <div className="grid">
        {menu.data?.items.map((d) => (
          <div key={d.id} className="card dish">
            <div className="row between">
              <h3>{d.name}</h3>
              <strong>{money(d.price)}</strong>
            </div>
            <p className="muted small">{d.description}</p>
            <div className="row between">
              <span className="muted small">{d.category}</span>
              {!d.is_available ? (
                <span className="badge badge-cancelled">Unavailable</span>
              ) : user?.role === "customer" ? (
                <button className="btn" onClick={() => add(d)}>
                  Add to cart
                </button>
              ) : !user ? (
                <span className="muted small">Log in as a customer to order</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {menu.data && <Pagination page={menu.data.page} pages={menu.data.pages} onChange={setPage} />}
    </>
  );
}
