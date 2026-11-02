import { createContext, useContext, useEffect, useState } from "react";

const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);

const EMPTY = { restaurantId: null, restaurantName: "", items: [] };

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("cart")) || EMPTY;
    } catch {
      return EMPTY;
    }
  });

  useEffect(() => localStorage.setItem("cart", JSON.stringify(cart)), [cart]);

  // A cart holds dishes from one restaurant; returns false if the caller must confirm a switch.
  const addItem = (restaurant, dish, force = false) => {
    if (cart.restaurantId && cart.restaurantId !== restaurant.id && !force) return false;
    setCart((c) => {
      const base = c.restaurantId === restaurant.id ? c : { restaurantId: restaurant.id, restaurantName: restaurant.name, items: [] };
      const existing = base.items.find((i) => i.id === dish.id);
      const items = existing
        ? base.items.map((i) => (i.id === dish.id ? { ...i, quantity: Math.min(50, i.quantity + 1) } : i))
        : [...base.items, { id: dish.id, name: dish.name, price: dish.price, quantity: 1 }];
      return { ...base, items };
    });
    return true;
  };

  const setQuantity = (id, quantity) =>
    setCart((c) => {
      const items = c.items.filter((i) => i.id !== id || quantity > 0).map((i) => (i.id === id ? { ...i, quantity: Math.min(50, quantity) } : i));
      return items.length ? { ...c, items } : EMPTY;
    });

  const removeItem = (id) => setQuantity(id, 0);
  const clear = () => setCart(EMPTY);
  const count = cart.items.reduce((n, i) => n + i.quantity, 0);
  const total = cart.items.reduce((n, i) => n + i.quantity * i.price, 0);

  return (
    <CartContext.Provider value={{ cart, addItem, setQuantity, removeItem, clear, count, total }}>
      {children}
    </CartContext.Provider>
  );
}
