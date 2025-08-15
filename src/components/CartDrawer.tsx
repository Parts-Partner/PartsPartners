// src/components/CartDrawer.tsx
import React from 'react';
import { X } from 'lucide-react';
import { useCart } from 'context/CartContext';

export const CartDrawer: React.FC<{
  open: boolean; onClose: ()=>void; onCheckout: ()=>void; freightCost?: number;
}> = ({ open, onClose, onCheckout, freightCost = 0 }) => {
  const { items, updateQty, remove, subtotal } = useCart();
  const total = subtotal + (freightCost || 0);

  return (
    <div className={`fixed inset-0 z-50 ${open? '':'pointer-events-none'}`}>
      <div className={`absolute inset-0 bg-black/40 transition-opacity ${open? 'opacity-100':'opacity-0'}`} onClick={onClose} />
      <aside className={`absolute right-0 top-0 h-full w-full sm:w-[460px] bg-white shadow-xl transition-transform flex flex-col ${open? 'translate-x-0':'translate-x-full'}`}>
        {/* Header - Fixed at top */}
        <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-semibold">Your Cart</h2>
          <button className="p-2 rounded hover:bg-gray-100" onClick={onClose}><X /></button>
        </div>
        
        {/* Content - Scrollable middle section */}
        <div className="flex-1 p-4 space-y-3 overflow-y-auto">
          {items.length === 0 ? (
            <div className="text-center text-gray-600 py-16">Your cart is empty.</div>
          ) : items.map((i) => (
            <div key={i.id} className="border rounded-lg p-3 flex gap-3">
              <div className="flex-1">
                <div className="text-sm text-gray-500">{i.manufacturer?.manufacturer}</div>
                <div className="font-medium">{i.part_number}</div>
                <div className="text-sm text-gray-700 line-clamp-2">{i.part_description}</div>
                <div className="mt-2 flex items-center gap-2">
                  <button className="px-2 py-1 border rounded" onClick={()=>updateQty(i.id, Math.max(0, i.quantity-1))}>-</button>
                  <div className="w-8 text-center text-sm">{i.quantity}</div>
                  <button className="px-2 py-1 border rounded" onClick={()=>updateQty(i.id, i.quantity+1)}>+</button>
                  <button className="ml-auto text-sm text-red-600" onClick={()=>remove(i.id)}>Remove</button>
                </div>
              </div>
              <div className="text-right min-w-[96px]">
                <div className="text-xs text-gray-500">Unit</div>
                <div className="font-medium">${i.discounted_price.toFixed(2)}</div>
                <div className="text-xs text-gray-500 mt-2">Line</div>
                <div className="font-semibold">${i.line_total.toFixed(2)}</div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Footer - Fixed at bottom */}
        <div className="p-4 border-t space-y-2 flex-shrink-0 bg-white">
          <div className="flex justify-between text-sm"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between text-sm"><span>Freight</span><span>${(freightCost||0).toFixed(2)}</span></div>
          <div className="flex justify-between font-semibold text-lg"><span>Total</span><span>${total.toFixed(2)}</span></div>
          <button className="w-full mt-2 bg-red-600 hover:bg-red-700 text-white rounded-lg py-3 font-semibold disabled:opacity-50" disabled={items.length===0} onClick={onCheckout}>
            Checkout
          </button>
        </div>
      </aside>
    </div>
  );
};