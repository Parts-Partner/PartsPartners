// src/context/CartContext.tsx
import React, { createContext, useContext, useMemo, useState } from 'react';
import type { Part } from 'services/partsService';
import { calcDiscounted } from 'lib/pricing';
import { useAuth } from 'context/AuthContext';
import { supabase } from 'services/supabaseClient';

export interface CartItem extends Part {
  quantity: number; unit_price: number; discounted_price: number; line_total: number;
}

interface CartCtx {
  items: CartItem[];
  add: (part: Part, qty?: number) => Promise<void>;
  updateQty: (id: string, qty: number) => Promise<void>;
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
  const { profile, user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);

  const add = async (part: Part, qty = 1) => {
    if (!user?.id) {
      console.error('User must be logged in to add items to cart');
      return;
    }

    try {
      // Call our secure pricing function
      const { data: pricingData, error } = await supabase
        .rpc('calculate_secure_pricing', {
          part_id_input: part.id,
          user_id_input: user.id,
          quantity_input: qty
        });

      if (error) throw error;

      const { unit_price, line_total } = pricingData;

      setItems(prev => {
        const existing = prev.find(i => i.id === part.id);
        if (existing) {
          const newQuantity = existing.quantity + qty;
          return prev.map(i => 
            i.id === part.id 
              ? { ...i, quantity: newQuantity, line_total: unit_price * newQuantity }
              : i
          );
        }
        return [...prev, { 
          ...part, 
          quantity: qty, 
          unit_price: parseFloat(part.list_price as string), 
          discounted_price: unit_price, 
          line_total 
        }];
      });
    } catch (error) {
      console.error('Failed to add item to cart:', error);
    }
  };

  const updateQty = async (id: string, qty: number) => {
    if (qty <= 0) {
      setItems(prev => prev.filter(i => i.id !== id));
      return;
    }

    // For now, just update quantity using existing discounted_price
    setItems(prev => 
      prev.map(i => 
        i.id === id 
          ? { ...i, quantity: qty, line_total: i.discounted_price * qty }
          : i
      )
    );
  };

  const remove = (id: string) => setItems(prev => prev.filter(i => i.id !== id));
  const clear = () => setItems([]);

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.line_total, 0), [items]);
  const count = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);

  return <Ctx.Provider value={{ items, add, updateQty, remove, clear, subtotal, count }}>{children}</Ctx.Provider>;
};