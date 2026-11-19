'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { CartItem, SelectedModifier } from '@/types';

interface CartContextType {
  items: CartItem[];
  addItem: (item: {
    menuItemId: string;
    name: string;
    basePrice: number;
    quantity: number;
    notes: string;
    selectedModifiers: SelectedModifier[];
  }) => void;
  updateQuantity: (id: string, delta: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  totalCount: number;
  totalAmount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'ayam_dubrak_cart_v1';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        setItems(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Failed to load cart from storage', e);
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('Failed to save cart', e);
    }
  }, [items, isHydrated]);

  const addItem = (newItem: {
    menuItemId: string;
    name: string;
    basePrice: number;
    quantity: number;
    notes: string;
    selectedModifiers: SelectedModifier[];
  }) => {
    const modifierSum = newItem.selectedModifiers.reduce((acc, m) => acc + (m.price * (m.quantity || 1)), 0);
    const itemTotal = (newItem.basePrice + modifierSum) * newItem.quantity;

    const cartItem: CartItem = {
      id: `${newItem.menuItemId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      ...newItem,
      itemTotal,
    };

    setItems((prev) => [...prev, cartItem]);
  };

  const updateQuantity = (id: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((item) => {
          if (item.id !== id) return item;
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          const modifierSum = item.selectedModifiers.reduce((acc, m) => acc + (m.price * (m.quantity || 1)), 0);
          return {
            ...item,
            quantity: newQty,
            itemTotal: (item.basePrice + modifierSum) * newQty,
          };
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setItems([]);
  };

  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce((sum, item) => sum + item.itemTotal, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        totalCount,
        totalAmount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}
