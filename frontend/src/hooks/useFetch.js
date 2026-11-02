import { useCallback, useEffect, useRef, useState } from "react";
import api, { errorMessage } from "../api/client";

// GET helper with loading/error state; refetches when path or params change.
export default function useFetch(path, params = {}, enabled = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const latest = useRef(0);
  const key = JSON.stringify(params);

  const load = useCallback(async () => {
    if (!enabled) return;
    const id = ++latest.current;
    setLoading(true);
    setError("");
    try {
      const clean = Object.fromEntries(Object.entries(JSON.parse(key)).filter(([, v]) => v !== "" && v != null));
      const res = await api.get(path, { params: clean });
      if (id === latest.current) setData(res.data);
    } catch (err) {
      if (id === latest.current) setError(errorMessage(err));
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }, [path, key, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load, setError };
}
