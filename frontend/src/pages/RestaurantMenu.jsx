import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import Alert from "../components/Alert";
import EmptyState from "../components/EmptyState";
import Pagination from "../components/Pagination";
import { SkeletonGrid } from "../components/Skeleton";
import Spinner from "../components/Spinner";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import useFetch from "../hooks/useFetch";
import { coverFor, foodEmoji, money } from "../utils";

export default function RestaurantMenu() {
  const { id } = useParams();
  const { user } = useAuth();
  const { addItem, count, total } = useCart();
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

  const clearFilters = () => {
    const blank = { search: "", min_price: "", max_price: "" };
    setFilters(blank);
    setApplied(blank);
    setPage(1);
  };

  if (restaurant.loading) return <Spinner />;
  if (restaurant.error) return <Alert>{restaurant.error}</Alert>;
  const r = restaurant.data;
  const isCustomer = user?.role === "customer";

  return (
    <>
      <p className="small">
        <Link to="/restaurants">← All restaurants</Link>
      </p>
      <section className="menu-hero" style={{ background: coverFor(r.name) }}>
        <span className="cover-emoji" aria-hidden="true">{foodEmoji(`${r.cuisine} ${r.name}`)}</span>
        <div>
          <h1>{r.name}</h1>
          <p>{r.description}</p>
          <div className="row wrap" style={{ marginTop: "0.6rem" }}>
            {r.cuisine && <span className="tag">{r.cuisine}</span>}
            <span className="rating">{r.avg_rating ? `★ ${r.avg_rating} (${r.review_count} reviews)` : "No reviews yet"}</span>
          </div>
        </div>
      </section>

      <form className="toolbar" onSubmit={apply} role="search">
        <input aria-label="Search dishes" placeholder="🔍  Search dishes" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        <input type="number" inputMode="decimal" min="0" aria-label="Minimum price" placeholder="Min ₹" value={filters.min_price} onChange={(e) => setFilters({ ...filters, min_price: e.target.value })} />
        <input type="number" inputMode="decimal" min="0" aria-label="Maximum price" placeholder="Max ₹" value={filters.max_price} onChange={(e) => setFilters({ ...filters, max_price: e.target.value })} />
        <button className="btn">Apply filters</button>
        {(applied.search || applied.min_price || applied.max_price) && (
          <button type="button" className="btn btn-light" onClick={clearFilters}>
            Clear
          </button>
        )}
      </form>

      <Alert type="success" onClose={() => setNotice("")}>{notice}</Alert>
      <Alert>{menu.error}</Alert>
      {menu.loading && !menu.data && <SkeletonGrid count={6} cover={false} />}
      {menu.data && menu.data.items.length === 0 && (
        <EmptyState icon="🥡" title="No dishes match">
          Try widening your price range or clearing the search.
        </EmptyState>
      )}

      {menu.data && (
        <div className="grid stagger" key={`${JSON.stringify(applied)}-${page}`}>
          {menu.data.items.map((d) => (
            <div key={d.id} className={d.is_available ? "card dish hover-lift" : "card dish unavailable"}>
              <div className="dish-head">
                <div className="row top">
                  <span className="thumb" aria-hidden="true">{foodEmoji(`${d.category} ${d.name}`)}</span>
                  <div>
                    <h3>{d.name}</h3>
                    {d.category && <span className="tag">{d.category}</span>}
                  </div>
                </div>
                <span className="price-tag">{money(d.price)}</span>
              </div>
              <p className="muted small">{d.description}</p>
              <div className="row between">
                {!d.is_available ? (
                  <span className="badge badge-cancelled">Unavailable</span>
                ) : isCustomer ? (
                  <button className="btn btn-block" onClick={() => add(d)}>
                    + Add to cart
                  </button>
                ) : !user ? (
                  <Link to="/login" className="small">
                    Log in as a customer to order →
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
      {menu.data && <Pagination page={menu.data.page} pages={menu.data.pages} onChange={setPage} />}

      {isCustomer && count > 0 && (
        <>
          <div className="fab-spacer" aria-hidden="true" />
          <Link to="/cart" className="cart-fab">
            🛒 View cart <span className="pill" key={count}>{count}</span> · {money(total)}
          </Link>
        </>
      )}
    </>
  );
}
