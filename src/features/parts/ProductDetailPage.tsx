import React, { useEffect, useMemo, useState } from 'react';
import { useCart } from 'context/CartContext';
import { useAuth, type UserProfile } from 'context/AuthContext';
import { supabase } from 'services/supabaseClient';
import { ArrowLeft, ShoppingCart } from 'lucide-react';

type Props = { partId: string; onBack: () => void };

interface Part {
  id: string;
  part_number: string;
  part_description: string;
  category: string;
  list_price: string | number;
  compatible_models: string[] | string;
  image_url?: string;
  in_stock: boolean;
  manufacturer_id: string;
  make_part_number?: string;
  manufacturer_name?: string;
  make?: string;
}

const ProductDetailPage: React.FC<Props> = ({ partId, onBack }) => {
  const { add, updateQty, items } = useCart();
  const { profile } = useAuth();

  const [product, setProduct] = useState<Part | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);

  const discountPct = (profile as UserProfile | null)?.discount_percentage || 0;
  const inCartQty = useMemo(
    () => items.find((i) => i.id === partId)?.quantity || 0,
    [items, partId]
  );

useEffect(() => {
    let mounted = true;

    const fetchPart = async () => {
      console.log('🔍 ProductDetailPage: Fetching part with ID:', partId);
      setLoading(true);
      try {
        // First, get the part
        const { data: partData, error: partError } = await supabase
          .from('parts')
          .select('*')
          .eq('id', partId)
          .single();

        console.log('📦 ProductDetailPage: Part data:', { partData, partError });

        if (partError) {
          console.error('❌ ProductDetailPage: Part fetch error:', partError);
          throw partError;
        }

        if (!partData) {
          console.warn('⚠️ ProductDetailPage: No part found with ID:', partId);
          if (mounted) {
            setLoading(false);
          }
          return;
        }

        // Then get manufacturer info if available
        let manufacturerName = '';
        let make = '';
        
        if (partData.manufacturer_id) {
          console.log('🔍 ProductDetailPage: Fetching manufacturer:', partData.manufacturer_id);
          
          const { data: mfgData, error: mfgError } = await supabase
            .from('manufacturers')
            .select('manufacturer, make')
            .eq('id', partData.manufacturer_id)
            .single();

          console.log('📦 ProductDetailPage: Manufacturer data:', { mfgData, mfgError });

          if (!mfgError && mfgData) {
            manufacturerName = mfgData.manufacturer || '';
            make = mfgData.make || '';
          }
        }

        if (mounted) {
          const part: Part = {
            ...partData,
            manufacturer_name: manufacturerName,
            make: make
          };
          
          console.log('✅ ProductDetailPage: Setting product:', part);
          setProduct(part);
        }
      } catch (err) {
        if (mounted) {
          console.error('❌ ProductDetailPage: Error fetching part:', err);
        }
      } finally {
        if (mounted) {
          console.log('🏁 ProductDetailPage: Loading complete');
          setLoading(false);
        }
      }
    };

    if (partId) {
      fetchPart();
    } else {
      console.warn('⚠️ ProductDetailPage: No partId provided');
      setLoading(false);
    }

    return () => {
      mounted = false;
    };
  }, [partId]);

  const unit = useMemo(() => {
    if (!product) return 0;
    const n = typeof product.list_price === 'number'
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
        <div className="text-gray-700">We could not find that part.</div>
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
        <div className="bg-white border rounded-2xl p-4 flex items-center justify-center">
          <img
            src={product.image_url || '/placeholder.png'}
            alt={product.part_number}
            className="max-h-[420px] object-contain"
          />
        </div>

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

          <div className="flex items-end gap-8">
            <div>
              <div className="text-xs text-gray-500">List</div>
              <div className="text-gray-500 line-through">${unit.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Your price</div>
              <div className="text-2xl font-bold text-green-700">
                ${discounted.toFixed(2)}
              </div>
            </div>
            <div className={`ml-auto text-sm font-medium ${
              product.in_stock ? 'text-green-700' : 'text-gray-500'
            }`}>
              {product.in_stock ? 'In stock' : 'Backorder'}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || '1', 10)))}
              className="w-24 px-3 py-2 border rounded-lg"
              aria-label="Quantity"
            />
            {inCartQty > 0 ? (
              <button
                onClick={async () => {
                  try {
                    await updateQty(product.id, inCartQty + qty);
                  } catch (error) {
                    console.error('Error updating cart:', error);
                  }
                }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg py-3 font-semibold inline-flex items-center justify-center gap-2"
              >
                <ShoppingCart size={18} /> Update Cart ({inCartQty})
              </button>
            ) : (
              <button
                onClick={async () => {
                  try {
                    await add(product as any, qty);
                  } catch (error) {
                    console.error('Error adding to cart:', error);
                  }
                }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg py-3 font-semibold inline-flex items-center justify-center gap-2"
              >
                <ShoppingCart size={18} /> Add to Cart
              </button>
            )}
          </div>

          {product.compatible_models && (
            <div className="pt-2">
              <h3 className="font-semibold text-lg">Compatible Models</h3>
              <ul className="list-disc list-inside text-gray-700">
                {(Array.isArray(product.compatible_models)
                  ? product.compatible_models
                  : String(product.compatible_models).split(',').map((s) => s.trim())
                ).map((m: string) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="mt-12">
        <h2 className="text-xl font-bold mb-3">Related Parts</h2>
        <div className="text-gray-500">Coming soon…</div>
      </div>
    </div>
  );
};

export default ProductDetailPage;