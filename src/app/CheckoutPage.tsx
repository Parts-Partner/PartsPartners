// src/app/CheckoutPage.tsx
import React, { useMemo, useState } from 'react';
import { useCart } from 'context/CartContext';
import { useAuth } from 'context/AuthContext';
import MockUPSFreightCalculator from 'features/freight/MockUPSFreightCalculator';
import PaymentFlow from 'features/checkout/PaymentFlow';

interface UPSService { service_code: string; service_name: string; total_charges: number; customer_rate: number; transit_days?: string; delivery_date?: string }

const CheckoutPage: React.FC<{ onBack: ()=>void; onComplete: ()=>void }> = ({ onBack, onComplete }) => {
  const { items, subtotal, clear } = useCart();
  const { profile } = useAuth();
  const [selectedFreight, setSelectedFreight] = useState<UPSService | null>(null);
  const [showPaymentFlow, setShowPaymentFlow] = useState(false);
  const freightCost = selectedFreight?.customer_rate || 0;
  const cartTotal = useMemo(()=> subtotal + freightCost, [subtotal, freightCost]);

  const handleProceedToPayment = () => {
    setShowPaymentFlow(true);
  };

  const handlePaymentSuccess = () => {
    clear();
    setShowPaymentFlow(false);
    onComplete();
  };

  const handlePaymentClose = () => {
    setShowPaymentFlow(false);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-4">
        <button className="text-sm text-gray-600 underline" onClick={onBack}>← Continue shopping</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border rounded-xl p-4">
            <h2 className="font-semibold text-lg mb-3">1) Choose Shipping</h2>
            <MockUPSFreightCalculator onSelect={(svc: UPSService)=>setSelectedFreight(svc)} selected={selectedFreight} />
          </div>

          <div className="bg-white border rounded-xl p-4">
            <h2 className="font-semibold text-lg mb-3">2) Review Items</h2>
            {items.length===0 ? <div className="text-gray-600">Your cart is empty.</div> : (
              <div className="divide-y">
                {items.map((i)=> (
                  <div key={i.id} className="py-3 flex justify-between">
                    <div>
                      <div className="text-sm text-gray-500">{i.manufacturer?.manufacturer}</div>
                      <div className="font-medium">{i.part_number}</div>
                      <div className="text-sm text-gray-700">Qty {i.quantity}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Unit</div>
                      <div className="font-medium">${i.discounted_price.toFixed(2)}</div>
                      <div className="text-sm text-gray-500">Line</div>
                      <div className="font-semibold">${i.line_total.toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-4">
            <div className="flex justify-between text-sm"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm"><span>Freight</span><span>${freightCost.toFixed(2)}</span></div>
            <div className="flex justify-between font-semibold text-lg mt-2"><span>Total</span><span>${cartTotal.toFixed(2)}</span></div>
          </div>

          <div className="bg-white border rounded-xl p-4">
            <h2 className="font-semibold text-lg mb-3">3) Ready to Order?</h2>
            <p className="text-sm text-gray-600 mb-4">
              Review your items and shipping selection above, then proceed to payment.
            </p>
            <button
              onClick={handleProceedToPayment}
              disabled={items.length === 0 || !selectedFreight}
              className="w-full bg-red-600 hover:bg-red-700 text-white rounded-lg py-3 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Proceed to Payment
            </button>
            {!selectedFreight && items.length > 0 && (
              <p className="text-xs text-red-600 mt-2">Please select a shipping option first</p>
            )}
          </div>
        </div>
      </div>

      {/* Payment Flow Modal - Only shows when user clicks "Proceed to Payment" */}
      {showPaymentFlow && (
        <PaymentFlow
          cartItems={items as any}
          cartTotal={cartTotal}
          userDiscount={profile?.discount_percentage || 0}
          userProfile={profile as any}
          onSuccess={handlePaymentSuccess}
          onClose={handlePaymentClose}
        />
      )}
    </div>
  );
};

export default CheckoutPage;