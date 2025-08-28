import React, { useEffect, useState } from 'react';
import { CheckCircle2, Package, Mail, ArrowLeft, Download } from 'lucide-react';
import { supabase } from 'services/supabaseClient';

interface OrderConfirmationProps {
  orderId: string;
  onBackToShopping: () => void;
}

interface OrderDetails {
  id: string;
  po_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total_amount: number;
  created_at: string;
  items: Array<{
    part_number: string;
    part_description: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
}

const OrderConfirmation: React.FC<OrderConfirmationProps> = ({ orderId, onBackToShopping }) => {
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadOrder = async () => {
      try {
        setLoading(true);
        
        // Fetch order details
        const { data: orderData, error: orderError } = await supabase
          .from('purchase_orders')
          .select('*')
          .eq('id', orderId)
          .single();

        if (orderError) throw orderError;

        // Fetch order items
        const { data: itemsData, error: itemsError } = await supabase
          .from('purchase_order_items')
          .select('*')
          .eq('po_id', orderId);

        if (itemsError) throw itemsError;

        setOrder({
          id: orderData.id,
          po_number: orderData.po_number,
          status: orderData.status,
          payment_status: orderData.payment_status,
          payment_method: orderData.payment_method,
          total_amount: orderData.total_amount,
          created_at: orderData.created_at,
          items: itemsData || []
        });

      } catch (err: any) {
        console.error('Failed to load order:', err);
        setError('Failed to load order details');
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      loadOrder();
    }
  }, [orderId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border p-8 text-center">
          <div className="text-red-600 mb-4">
            <Package className="h-12 w-12 mx-auto mb-2" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Order Not Found</h2>
          <p className="text-gray-600 mb-4">{error || 'Unable to load order details'}</p>
          <button
            onClick={onBackToShopping}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Success Header */}
      <div className="bg-green-50 border border-green-200 rounded-2xl p-8 mb-6 text-center">
        <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-green-900 mb-2">Order Confirmed!</h1>
        <p className="text-green-700 text-lg mb-4">
          Thank you for your order. We&apos;ve received your request and will process it shortly.
        </p>
        <div className="bg-white rounded-lg p-4 inline-block">
          <div className="text-sm text-gray-600">Order Number</div>
          <div className="text-2xl font-bold text-gray-900">{order.po_number}</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mb-6 justify-center">
        <button
          onClick={onBackToShopping}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Continue Shopping
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <Download className="h-4 w-4" />
          Print Receipt
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4">Order Items</h2>
            <div className="space-y-4">
              {order.items.map((item, index) => (
                <div key={index} className="flex items-start gap-4 pb-4 border-b border-gray-100 last:border-b-0 last:pb-0">
                  <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Package className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{item.part_number}</div>
                    <div className="text-sm text-gray-600 mt-1">{item.part_description}</div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                      <span>Qty: {item.quantity}</span>
                      <span>Unit: ${item.unit_price.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-semibold text-gray-900">${item.line_total.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold mb-4">Order Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span>${order.total_amount.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-gray-200">
                <div className="text-xs text-gray-600">Payment Method</div>
                <div className="font-medium">{order.payment_method === 'credit_card' ? 'Credit Card' : 'Net 30 Terms'}</div>
              </div>
              <div className="pt-2">
                <div className="text-xs text-gray-600">Status</div>
                <div className="font-medium">{order.status.charAt(0).toUpperCase() + order.status.slice(1)}</div>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold mb-4">Need Help?</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600">Email:</span>
                <a href="mailto:orders@partspartners.com" className="text-red-600 hover:underline">
                  orders@partspartners.com
                </a>
              </div>
              <div className="text-xs text-gray-600">
                Order Date: {formatDate(order.created_at)}
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-800">
                <strong>What&apos;s Next?</strong> We&apos;ll send you email updates as your order progresses. 
                You can also check your order status in your profile.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmation;