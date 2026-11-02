import { useState } from "react";
import { Link } from "react-router-dom";
import Alert from "../components/Alert";
import EmptyState from "../components/EmptyState";
import Pagination from "../components/Pagination";
import { SkeletonGrid } from "../components/Skeleton";
import { useAuth } from "../context/AuthContext";
import useFetch from "../hooks/useFetch";
import { coverFor, foodEmoji } from "../utils";

export default function Restaurants() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const { data, loading, error } = useFetch("/restaurants", { search: query, page, page_size: 9 });
  const firstName = user?.name?.split(" ")[0];

  return (
    <>
      <section className="hero">
        <span className="eyebrow">{firstName ? `Hi ${firstName} 👋` : "Welcome to CampusBite"}</span>
        <h1>Hungry? Your campus favourites are a tap away.</h1>
        <p>Browse restaurants, build your cart and track your order right to your door.</p>
        <form
          className="search-bar"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQuery(search.trim());
          }}
        >
          <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="search" aria-label="Search restaurants" placeholder="Search restaurants" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn">Search</button>
        </form>
        <span className="hero-emoji" aria-hidden="true">🍜</span>
      </section>

      <div className="page-header">
        <div>
          <h2>{query ? `Results for “${query}”` : "All restaurants"}</h2>
          {data && <p className="muted small">{data.total ?? data.items.length} place(s) open for orders</p>}
        </div>
      </div>

      <Alert>{error}</Alert>
      {loading && !data && <SkeletonGrid count={6} />}
      {data && data.items.length === 0 && (
        <EmptyState icon="🔍" title="No restaurants found">
          Try a different search term.
        </EmptyState>
      )}

      {data && (
        <div className="grid stagger" key={`${query}-${page}`}>
          {data.items.map((r) => (
            <Link key={r.id} to={`/restaurants/${r.id}`} className="card restaurant-card hover-lift">
              <div className="cover" style={{ background: coverFor(r.name) }}>
                <span aria-hidden="true">{foodEmoji(`${r.cuisine} ${r.name}`)}</span>
              </div>
              <div className="card-body">
                <h3>{r.name}</h3>
                <span className="muted small">{r.cuisine || "Multi-cuisine"}</span>
                <p className="small muted">{r.description}</p>
                <div className="meta-row">
                  {r.avg_rating ? (
                    <span className="rating">★ {r.avg_rating} <span className="muted">({r.review_count})</span></span>
                  ) : (
                    <span className="tag">New</span>
                  )}
                  <span className="link-arrow">View menu →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      {data && <Pagination page={data.page} pages={data.pages} onChange={setPage} />}
    </>
  );
}
