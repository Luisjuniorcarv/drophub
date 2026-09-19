"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface CartItem {
  productId: string;
  variantId?: string | null;
  name: string;
  slug: string;
  sku: string;
  image: string;
  variant?: { id: string; name: string; sku: string } | null;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  availableStock: number;
}

export interface CartData {
  items: CartItem[];
  itemsCount: number;
  subtotalAmount: number;
  shippingCost: number;
  totalAmount: number;
}

interface CartContextType {
  cart: CartData;
  isLoading: boolean;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  addItem: (productId: string, variantId?: string | null, quantity?: number) => Promise<void>;
  updateQuantity: (productId: string, variantId: string | null | undefined, quantity: number) => Promise<void>;
  removeItem: (productId: string, variantId?: string | null) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

const defaultCart: CartData = {
  items: [],
  itemsCount: 0,
  subtotalAmount: 0,
  shippingCost: 0,
  totalAmount: 0,
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartData>(defaultCart);
  const [isLoading, setIsLoading] = useState(true);
  const [isCartOpen, setIsCartOpen] = useState(false);

  async function refreshCart() {
    try {
      const res = await fetch("/api/store/cart");
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.cart) {
          setCart(data.cart);
        }
      }
    } catch (err) {
      console.error("[REFRESH_CART_ERROR]", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refreshCart();
  }, []);

  async function addItem(productId: string, variantId: string | null = null, quantity = 1) {
    try {
      setIsLoading(true);
      const res = await fetch("/api/store/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, variantId, quantity }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.cart) setCart(data.cart);
        setIsCartOpen(true);
      }
    } catch (err) {
      console.error("[ADD_TO_CART_ERROR]", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function updateQuantity(productId: string, variantId: string | null = null, quantity: number) {
    try {
      setIsLoading(true);
      const res = await fetch("/api/store/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, variantId, quantity }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.cart) setCart(data.cart);
      }
    } catch (err) {
      console.error("[UPDATE_CART_QUANTITY_ERROR]", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function removeItem(productId: string, variantId: string | null = null) {
    try {
      setIsLoading(true);
      let url = `/api/store/cart?productId=${encodeURIComponent(productId)}`;
      if (variantId) url += `&variantId=${encodeURIComponent(variantId)}`;

      const res = await fetch(url, { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        if (data.cart) setCart(data.cart);
      }
    } catch (err) {
      console.error("[REMOVE_CART_ITEM_ERROR]", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function clearCart() {
    try {
      setIsLoading(true);
      const res = await fetch("/api/store/cart?clear=true", { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        if (data.cart) setCart(data.cart);
      }
    } catch (err) {
      console.error("[CLEAR_CART_ERROR]", err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <CartContext.Provider
      value={{
        cart,
        isLoading,
        isCartOpen,
        setIsCartOpen,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart deve ser usado dentro de um CartProvider");
  }
  return context;
}
