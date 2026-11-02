import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import EmptyState from "./components/EmptyState";
import { useAuth } from "./context/AuthContext";
import { roleHome } from "./utils";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Restaurants from "./pages/Restaurants";
import RestaurantMenu from "./pages/RestaurantMenu";
import Cart from "./pages/Cart";
import CustomerDashboard from "./pages/CustomerDashboard";
import AIInsights from "./pages/AIInsights";
import OwnerDashboard from "./pages/OwnerDashboard";
import OwnerOrders from "./pages/OwnerOrders";
import OwnerMenu from "./pages/OwnerMenu";
import OwnerReturns from "./pages/OwnerReturns";
import DeliveryDashboard from "./pages/DeliveryDashboard";

function Home() {
  const { user } = useAuth();
  return <Navigate to={user ? roleHome(user.role) : "/restaurants"} replace />;
}

export default function App() {
  const location = useLocation();
  return (
    <>
      <Navbar />
      <main className="container">
        {/* Keyed on the path so each page plays its entrance animation. */}
        <div key={location.pathname} className="page">
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/restaurants" element={<Restaurants />} />
            <Route path="/restaurants/:id" element={<RestaurantMenu />} />

            <Route element={<ProtectedRoute roles={["customer"]} />}>
              <Route path="/cart" element={<Cart />} />
              <Route path="/orders" element={<CustomerDashboard />} />
              <Route path="/insights" element={<AIInsights />} />
            </Route>

            <Route element={<ProtectedRoute roles={["restaurant_owner"]} />}>
              <Route path="/owner" element={<OwnerDashboard />} />
              <Route path="/owner/orders" element={<OwnerOrders />} />
              <Route path="/owner/menu" element={<OwnerMenu />} />
              <Route path="/owner/returns" element={<OwnerReturns />} />
            </Route>

            <Route element={<ProtectedRoute roles={["delivery_partner"]} />}>
              <Route path="/delivery" element={<DeliveryDashboard />} />
            </Route>

            <Route
              path="*"
              element={
                <EmptyState
                  icon="🧭"
                  title="Page not found"
                  action={
                    <Link className="btn" to="/">
                      Go home
                    </Link>
                  }
                >
                  The page you are looking for doesn&apos;t exist.
                </EmptyState>
              }
            />
          </Routes>
        </div>
      </main>
      <footer className="footer">© {new Date().getFullYear()} CampusBite · Made for hungry students</footer>
    </>
  );
}
