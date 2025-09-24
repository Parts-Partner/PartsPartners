import React, { useEffect, useMemo, useState } from 'react';
import { useCart } from 'context/CartContext';
import { useAuth, type UserProfile } from 'context/AuthContext';
import { supabase } from 'services/supabaseClient';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import type { Part } from 'services/partsService';

type Props = { partId: string; onBack: () => void };

const ProductDetailPage: React.FC<Props> = ({ partId, onBack }) => {
  const { add, updateQty, items } = useCart();
  const { profile } = useAuth();

  console.log('PDP: Received partId:', partId);

  const [product, setProduct] = useState<Part | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);

  console.log('PDP: Current product state:', product);

  const discountPct = (profile as UserProfile | null)?.discount_percentage || 0;
  const inCartQty = useMemo(
    () => items.find((i) => i.id === partId)?.quantity || 0,
    [items, partId]
  );

useEffect(() => {
  console.log('PDP: useEffect triggered with partId:', partId);
  
  const fetchPart = async () => {
    setLoading(true);
    
    try {
      console.log('PDP: Starting direct query...');
      
      // Direct query for the specific part
      const { data, error } = await supabase
        .from('parts')
        .select('*')
        .eq('id', partId)
        .single();
      
      console.log('PDP: Direct query completed. Data:', data, 'Error:', error);
      
      if (error) {
        console.error('PDP: Query error:', error);
        return;
      }
      
      if (data) {
        // Add manufacturer info separately if needed
        const partWithMfg = {
          ...data,
          manufacturer_name: 'Loading...', // We'll add this properly later
          make: 'Loading...'
        };
        
        console.log('PDP: Setting product:', partWithMfg);
        setProduct(partWithMfg);
      }
      
    } catch (err) {
      console.error('PDP: Catch error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  fetchPart();
}, [partId]);

  const unit = useMemo(() => {
    if (!product) return 0;
    const n =
      typeof product.list_price === 'number'
        ? product.list_price
        : parseFloat(String(product.list_price || 0));
    return isNaN(n) ? 0 : n;
  }, [product]);

  const discounted = useMemo(
    () => unit * (1 - discountPct / 100),
    [unit, discountPct]
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="text-gray-700">We couldn’t find that part.</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft size={16} /> Back to results
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Media */}
        <div className="bg-white border rounded-2xl p-4 flex items-center justify-center">
          <img
            src={product.image_url || '/placeholder.png'}
            alt={product.part_number}
            className="max-h-[420px] object-contain"
          />
        </div>

        {/* Details */}
        <div className="bg-white border rounded-2xl p-6 space-y-4">
          <div>
            <div className="text-xs text-gray-500">
              {product.manufacturer_name}
              {product.make && product.make !== product.manufacturer_name
                ? ` • ${product.make}`
                : ''}
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              {product.part_number}
            </h1>
            <p className="text-gray-700">{product.part_description}</p>
          </div>

          {/* Pricing */}
          <div className="flex items-end gap-8">
            <div>
              <div className="text-xs text-gray-500">List</div>
              <div className="text-gray-500 line-through">
                ${unit.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Your price</div>
              <div className="text-2xl font-bold text-green-700">
                ${discounted.toFixed(2)}
              </div>
            </div>
            <div
              className={`ml-auto text-sm font-medium ${
                product.in_stock ? 'text-green-700' : 'text-gray-500'
              }`}
            >
              {product.in_stock ? 'In stock' : 'Backorder'}
            </div>
          </div>

          {/* Qty + Cart */}
          <div className="flex items-center gap-3 pt-2">
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) =>
                setQty(Math.max(1, parseInt(e.target.value || '1', 10)))
              }
              className="w-24 px-3 py-2 border rounded-lg"
              aria-label="Quantity"
            />
            {inCartQty > 0 ? (
              <button
                  onClick={() => {
                    console.log('PDP: Update cart clicked with:', { product, inCartQty, qty }); // ADD THIS
                    updateQty(product.id, inCartQty + qty);
                  }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg py-3 font-semibold inline-flex items-center justify-center gap-2"
              >
                <ShoppingCart size={18} /> Update Cart ({inCartQty})
              </button>
            ) : (
              <button
                onClick={() => {
                  console.log('PDP: Add to cart clicked with:', { product, qty }); // ADD THIS
                  add(product, qty);
                }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg py-3 font-semibold inline-flex items-center justify-center gap-2"
              >
                <ShoppingCart size={18} /> Add to Cart
              </button>
            )}
          </div>

          {/* Compatibility */}
          {product.compatible_models && (
            <div className="pt-2">
              <h3 className="font-semibold text-lg">Compatible Models</h3>
              <ul className="list-disc list-inside text-gray-700">
                {(Array.isArray(product.compatible_models)
                  ? product.compatible_models
                  : String(product.compatible_models)
                      .split(',')
                      .map((s) => s.trim())
                ).map((m: string) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Related (placeholder) */}
      <div className="mt-12">
        <h2 className="text-xl font-bold mb-3">Related Parts</h2>
        <div className="text-gray-500">Coming soon…</div>
      </div>
    </div>
  );
};

export default ProductDetailPage;
