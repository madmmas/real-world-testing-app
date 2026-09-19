import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "./auth";

export type CartLine = {
  bookId: string;
  quantity: number;
  unitPriceCents: number;
  title: string;
  author: string;
  coverUrl: string;
  stock: number;
  storeId: string;
  storeName: string;
  available: boolean;
};

export type CartPayload = {
  id: string;
  expiresAt: string;
  itemCount: number;
  totalCents: number;
  items: CartLine[];
};

const emptyCart: CartPayload = {
  id: "",
  expiresAt: "",
  itemCount: 0,
  totalCents: 0,
  items: [],
};

type CartState = {
  cart: CartPayload;
  ready: boolean;
  refresh: () => Promise<void>;
  add: (bookId: string, quantity?: number) => Promise<CartPayload>;
  setQuantity: (bookId: string, quantity: number) => Promise<CartPayload>;
  remove: (bookId: string) => Promise<CartPayload>;
  checkout: (idempotencyKey: string) => Promise<{ checkoutUrl: string | null }>;
};

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { ready: authReady, user, apiJson } = useAuth();
  const [cart, setCart] = useState<CartPayload>(emptyCart);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const next = await apiJson<CartPayload>("/cart");
    setCart(next);
  }, [apiJson]);

  useEffect(() => {
    if (!authReady) return;
    void refresh()
      .catch(() => setCart(emptyCart))
      .finally(() => setReady(true));
  }, [authReady, user?.id, refresh]);

  const add = useCallback(
    async (bookId: string, quantity = 1) => {
      const next = await apiJson<CartPayload>("/cart/items", {
        method: "POST",
        body: JSON.stringify({ bookId, quantity }),
      });
      setCart(next);
      return next;
    },
    [apiJson]
  );

  const setQuantity = useCallback(
    async (bookId: string, quantity: number) => {
      const next = await apiJson<CartPayload>(`/cart/items/${bookId}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity }),
      });
      setCart(next);
      return next;
    },
    [apiJson]
  );

  const remove = useCallback(
    async (bookId: string) => {
      const next = await apiJson<CartPayload>(`/cart/items/${bookId}`, { method: "DELETE" });
      setCart(next);
      return next;
    },
    [apiJson]
  );

  const checkout = useCallback(
    async (idempotencyKey: string) => {
      const data = await apiJson<{ checkoutUrl: string | null }>("/cart/checkout", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
      });
      await refresh();
      return data;
    },
    [apiJson, refresh]
  );

  const value = useMemo(
    () => ({ cart, ready, refresh, add, setQuantity, remove, checkout }),
    [cart, ready, refresh, add, setQuantity, remove, checkout]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
