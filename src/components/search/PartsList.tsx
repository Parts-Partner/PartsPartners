// src/components/search/PartsList.tsx - Corrected version
import React, { useState, useEffect } from 'react';
import { ShoppingCart, Eye } from 'lucide-react';

interface Part {
  id: string;
  part_number: string;
  part_description: string;
  category: string;
  list_price: string | number;
  compatible_models: string[];
  image_url?: string;
  in_stock: boolean;
  manufacturer_id: string;
  make_part_number?: string;
  manufacturer_name: string;
  make: string;
}

interface PartsListProps {
  parts: Part[];
  loading: boolean;
  discountPct: number;
  onAdd: (part: Part, qty?: number) => Promise<void>;
  onUpdateQty: (id: string, qty: number) => Promise<void>;
  getQty: (id: string) => number;
  onView?: (part: Part) => void;
}

export const PartsList: React.FC<PartsListProps> = ({
  parts,
  loading,
  discountPct,
  onAdd,
  onUpdateQty,
  getQty,
  onView,
}) => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (loading || !isClient) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (!parts || parts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">No parts found</div>
      </div>
    );
  }

  const handleAddToCart = async (part: Part, qty = 1) => {
    try {
      await onAdd(part, qty);
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
  };

  const handleUpdateQty = async (partId: string, newQty: number) => {
    try {
      await onUpdateQty(partId, newQty);
    } catch (error) {
      console.error('Error updating quantity:', error);
    }
  };

  const handleViewPart = (part: Part) => {
    // Cache part data for detail page
    sessionStorage.setItem(`part_${part.id}`, JSON.stringify(part));
    
    if (onView) {
      onView(part);
    } else {
      // Dispatch the custom event that MainShell listens for
      window.dispatchEvent(new CustomEvent('pp:viewPart', { 
        detail: { id: part.id } 
      }));
    }
  };

  return (
    <div className="space-y-4">
      {parts.map((part) => {
        const currentQty = getQty(part.id);
        const unitPrice = typeof part.list_price === 'string' 
          ? parseFloat(part.list_price) || 0 
          : Number(part.list_price) || 0;
        const discountedPrice = unitPrice * (1 - (discountPct || 0) / 100);
        const hasDiscount = discountPct > 0;

        // Format manufacturer display
        const manufacturerDisplay = part.manufacturer_name && part.make && part.manufacturer_name !== part.make
          ? `${part.manufacturer_name} • ${part.make}`
          : part.manufacturer_name || part.make || 'Unknown';

        return (
          <div
            key={part.id}
            onClick={() => handleViewPart(part)}
            className="bg-white rounded-lg border border-gray-200 hover:border-red-300 transition-colors p-6 cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                {/* Part Number & Manufacturer */}
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    {part.part_number}
                  </h3>
                  <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                    {manufacturerDisplay}
                  </span>
                  {!part.in_stock && (
                    <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                      Out of Stock
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {part.part_description}
                </p>

                {/* Compatible Models */}
                {part.compatible_models && part.compatible_models.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-1">Compatible Models:</p>
                    <div className="flex flex-wrap gap-1">
                      {part.compatible_models.slice(0, 3).map((model, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded"
                        >
                          {model}
                        </span>
                      ))}
                      {part.compatible_models.length > 3 && (
                        <span className="px-2 py-1 text-xs bg-gray-50 text-gray-500 rounded">
                          +{part.compatible_models.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Make Part Number */}
                {part.make_part_number && (
                  <p className="text-xs text-gray-500">
                    Mfg Part #: {part.make_part_number}
                  </p>
                )}
              </div>

              {/* Right side - Price and Actions */}
              <div className="ml-6 flex flex-col items-end gap-3">
                {/* Price */}
                <div className="text-right">
                  {hasDiscount ? (
                    <>
                      <div className="text-sm text-gray-500 line-through">
                        ${unitPrice.toFixed(2)}
                      </div>
                      <div className="text-xl font-bold text-red-600">
                        ${discountedPrice.toFixed(2)}
                      </div>
                      <div className="text-xs text-green-600 font-medium">
                        {discountPct}% off
                      </div>
                    </>
                  ) : (
                    <div className="text-xl font-bold text-gray-900">
                      ${unitPrice.toFixed(2)}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {/* Quantity Controls */}
                  {currentQty > 0 ? (
                    <div className="flex items-center gap-2 bg-red-50 rounded-lg p-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateQty(part.id, Math.max(0, currentQty - 1));
                        }}
                        className="w-8 h-8 flex items-center justify-center text-red-600 hover:bg-red-100 rounded"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-semibold text-red-600">
                        {currentQty}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateQty(part.id, currentQty + 1);
                        }}
                        className="w-8 h-8 flex items-center justify-center text-red-600 hover:bg-red-100 rounded"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToCart(part, 1);
                      }}
                      disabled={!part.in_stock}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
                        part.in_stock
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      <ShoppingCart size={16} />
                      Add to Cart
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};