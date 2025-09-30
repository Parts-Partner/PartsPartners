// src/context/CartContext.tsx - Fixed with better error handling
import React, { createContext, useContext, useMemo, useState } from 'react';
import type { Part } from 'services/partsService';
import { useAuth } from 'context/AuthContext';
import { supabase } from 'services/supabaseClient';

console.log('CartContext: supabase imported?', !!supabase);
console.log('CartContext: supabase.rpc exists?', !!supabase?.rpc);

export interface CartItem extends Part {
  quantity: number; 
  unit_price: number; 
  discounted_price: number; 
  line_total: number;
}

interface CartCtx {
  items: CartItem[];
  add: (part: Part, qty?: number) => Promise<void>;
  updateQty: (id: string, qty: number) => Promise<void>;
  remove: (id: string) => void;
  clear: () => void;
  subtotal: number; 
  count: number;
}

const Ctx = createContext<CartCtx | null>(null);

export const useCart = () => {
  const ctx = useContext(Ctx);
  if (!ctx) {
    console.error('useCart must be used within <CartProvider>');
    throw new Error('useCart must be used within <CartProvider>');
  }
  return ctx;
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);

  const add = async (part: Part, qty = 1): Promise<void> => {
    console.log('🛒 CartContext: add() called', { partId: part.id, qty, hasUser: !!user?.id });
    
    if (!user?.id) {
      console.error('❌ User not logged in');
      throw new Error('Please log in to add items to cart');
    }

    if (!part?.id) {
      console.error('❌ Invalid part');
      throw new Error('Invalid part data');
    }

    console.log('📞 Calling calculate_secure_pricing RPC...');

    try {
      const { data: pricingData, error } = await supabase
        .rpc('calculate_secure_pricing', {
          part_id_input: part.id,
          user_id_input: user.id,
          quantity_input: qty
        });

      console.log('📦 RPC response:', { pricingData, error });

      if (error) throw error;
      if (!pricingData) throw new Error('No pricing data returned');

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
        
        const newItem: CartItem = { 
          ...part, 
          quantity: qty, 
          unit_price: typeof part.list_price === 'number' ? part.list_price : parseFloat(String(part.list_price || '0')), 
          discounted_price: unit_price, 
          line_total,
          id: part.id,
          part_number: part.part_number || '',
          part_description: part.part_description || '',
          category: part.category || '',
          list_price: part.list_price || 0,
          compatible_models: part.compatible_models || [],
          in_stock: part.in_stock || false,
          manufacturer_id: part.manufacturer_id || '',
          manufacturer: part.manufacturer || { id: '', manufacturer: '', make: '' }
        };
        
        return [...prev, newItem];
      });

      console.log('✅ Item added successfully');
    } catch (error) {
      console.error('❌ Add to cart failed:', error);
      throw error;
    }
  };

  const updateQty = async (id: string, qty: number) => {
    if (!id) {
      console.error('Invalid ID provided to updateQty');
      return;
    }

    if (qty <= 0) {
      setItems(prev => prev.filter(i => i.id !== id));
      return;
    }

    try {
      // For now, just update quantity using existing discounted_price
      setItems(prev => 
        prev.map(i => 
          i.id === id 
            ? { ...i, quantity: qty, line_total: i.discounted_price * qty }
            : i
        )
      );
    } catch (error) {
      console.error('Failed to update cart quantity:', error);
    }
  };

  const remove = (id: string) => {
    if (!id) {
      console.error('Invalid ID provided to remove');
      return;
    }
    
    try {
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (error) {
      console.error('Failed to remove item from cart:', error);
    }
  };

  const clear = () => {
    try {
      setItems([]);
    } catch (error) {
      console.error('Failed to clear cart:', error);
    }
  };

  const subtotal = useMemo(() => {
    try {
      return items.reduce((s, i) => {
        const lineTotal = typeof i.line_total === 'number' ? i.line_total : 0;
        return s + lineTotal;
      }, 0);
    } catch (error) {
      console.error('Error calculating subtotal:', error);
      return 0;
    }
  }, [items]);

  const count = useMemo(() => {
    try {
      return items.reduce((s, i) => {
        const quantity = typeof i.quantity === 'number' ? i.quantity : 0;
        return s + quantity;
      }, 0);
    } catch (error) {
      console.error('Error calculating count:', error);
      return 0;
    }
  }, [items]);

  // Provide safe context value
  const contextValue: CartCtx = {
    items: items || [],
    add,
    updateQty,
    remove,
    clear,
    subtotal,
    count
  };

  return (
    <Ctx.Provider value={contextValue}>
      {children}
    </Ctx.Provider>
  );
};