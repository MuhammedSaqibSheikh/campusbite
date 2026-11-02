import { useState } from "react";
import { Link } from "react-router-dom";
import Alert from "../components/Alert";
import Pagination from "../components/Pagination";
import Spinner from "../components/Spinner";
import useFetch from "../hooks/useFetch";

export default function Restaurants() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const { data, loading, error } = useFetch("/restaurants", { search: query, page, page_size: 9 });

  return (
    <>
      <div className="row between wrap">
        <h2>Restaurants</h2>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQuery(search.trim());
          }}
        >
          <input placeholder="Search restaurants" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn">Search</button>
        </form>
      </div>

      <Alert>{error}</Alert>
      {loading && <Spinner />}
      {data && !loading && data.items.length === 0 && <p className="center muted">No restaurants found.</p>}

      <div className="grid">
        {data?.items.map((r) => (
          <Link key={r.id} to={`/restaurants/${r.id}`} className="card restaurant">
            <h3>{r.name}</h3>
            <p className="muted small">{r.cuisine || "Multi-cuisine"}</p>
            <p className="small">{r.description}</p>
            <p className="small">
              {r.avg_rating ? `★ ${r.avg_rating} (${r.review_count})` : "No reviews yet"}
            </p>
          </Link>
        ))}
      </div>
      {data && <Pagination page={data.page} pages={data.pages} onChange={setPage} />}
    </>
  );
}
