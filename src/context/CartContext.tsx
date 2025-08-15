// src/context/CartContext.tsx
import React, { createContext, useContext, useMemo, useState } from 'react';
import type { Part } from 'services/partsService';
import { calcDiscounted } from 'lib/pricing';
import { useAuth } from 'context/AuthContext';

export interface CartItem extends Part {
  quantity: number; unit_price: number; discounted_price: number; line_total: number;
}

interface CartCtx {
  items: CartItem[];
  add: (part: Part, qty?: number) => void;
  updateQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  subtotal: number; count: number;
}

const Ctx = createContext<CartCtx | null>(null);
export const useCart = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCart must be used within <CartProvider>');
  return ctx;
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);

  const add = (part: Part, qty = 1) => {
    const unit = typeof part.list_price === 'string' ? parseFloat(part.list_price) : part.list_price;
    const disc = calcDiscounted(unit, profile?.discount_percentage || 0);
    setItems(prev => {
      const existing = prev.find(i => i.id === part.id);
      if (existing) {
        const quantity = existing.quantity + qty;
        return prev.map(i => i.id === part.id ? { ...i, quantity, line_total: quantity * disc } : i);
      }
      return [...prev, { ...part, quantity: qty, unit_price: unit, discounted_price: disc, line_total: disc * qty }];
    });
  };

  const updateQty = (id: string, qty: number) => {
    setItems(prev => qty <= 0 ? prev.filter(i => i.id !== id) : prev.map(i => i.id === id ? { ...i, quantity: qty, line_total: i.discounted_price * qty } : i));
  };

  const remove = (id: string) => setItems(prev => prev.filter(i => i.id !== id));
  const clear = () => setItems([]);

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.line_total, 0), [items]);
  const count = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);

  return <Ctx.Provider value={{ items, add, updateQty, remove, clear, subtotal, count }}>{children}</Ctx.Provider>;
};