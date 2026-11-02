import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/client";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(!!localStorage.getItem("token"));

  // Re-validate the stored token on load so a stale session is cleared.
  useEffect(() => {
    if (!localStorage.getItem("token")) return;
    api
      .get("/auth/me")
      .then((res) => saveUser(res.data))
      .catch(() => clearSession())
      .finally(() => setLoading(false));
  }, []);

  const saveUser = (u) => {
    localStorage.setItem("user", JSON.stringify(u));
    setUser(u);
  };

  const clearSession = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  const startSession = (data) => {
    localStorage.setItem("token", data.access_token);
    saveUser(data.user);
    return data.user;
  };

  const login = async (email, password) =>
    startSession((await api.post("/auth/login", { email, password })).data);

  const register = async (payload) => startSession((await api.post("/auth/register", payload)).data);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout: clearSession }}>
      {children}
    </AuthContext.Provider>
  );
}
