// src/components/search/PartsList.tsx - Fixed object rendering issue
import React, { useState, useEffect } from 'react';
import type { Part } from 'services/partsService';

// Define props interface
interface PartsListProps {
  parts: Part[];
  loading: boolean;
  discountPct: number;
  onAdd: (p: Part, qty?: number) => Promise<void>;
  onUpdateQty: (id: string, qty: number) => Promise<void>;
  getQty: (id: string) => number;
  onView?: (p: Part) => void;
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
  // Add hydration protection
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // HELPER FUNCTIONS TO SAFELY HANDLE MANUFACTURER DATA
  const getManufacturerName = (manufacturer: any): string => {
    if (typeof manufacturer === 'string') return manufacturer;
    if (typeof manufacturer === 'object' && manufacturer?.manufacturer) {
      return manufacturer.manufacturer;
    }
    return 'Unknown Manufacturer';
  };

  const getMake = (manufacturer: any): string => {
    if (typeof manufacturer === 'object' && manufacturer?.make) {
      return manufacturer.make;
    }
    return '';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  // Show loading until client-side hydration is complete
  if (!isClient) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {parts.map((p) => {
        const unit =
          typeof p.list_price === 'string'
            ? parseFloat(p.list_price)
            : p.list_price || 0;
        const discounted = unit * (1 - (discountPct || 0) / 100);
        const qty = getQty(p.id);

        const open = () => {
          if (onView) {
            onView(p);
          } else {
            window.dispatchEvent(
              new CustomEvent('pp:viewPart', { detail: { id: p.id } })
            );
          }
        };

        return (
          <div
            key={p.id}
            className="bg-white border rounded-xl p-4 shadow-sm hover:shadow cursor-pointer"
          >
            {/* Clickable product info */}
            <button
              type="button"
              className="text-left w-full"
              onClick={open}
              aria-label={`View ${p.part_number}`}
            >
              {/* FIXED: Safe manufacturer rendering */}
              <div className="text-xs text-gray-500">
                {getManufacturerName(p.manufacturer)}
                {getMake(p.manufacturer) && ` • ${getMake(p.manufacturer)}`}
              </div>
              <div className="font-semibold text-lg underline decoration-transparent hover:decoration-slate-300">
                {p.part_number}
              </div>
              <div className="text-sm text-gray-700 line-clamp-2">
                {p.part_description}
              </div>
            </button>

            {/* Pricing */}
            <div className="mt-2 flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500">List</div>
                <div className="font-medium">${unit.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Your price</div>
                <div className="font-bold text-green-700">
                  ${discounted.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Cart controls */}
            <div className="mt-3 flex items-center justify-between">
              {qty > 0 ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onUpdateQty(p.id, qty - 1)}
                    className="w-8 h-8 flex items-center justify-center border rounded text-gray-600 hover:bg-gray-50"
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-sm font-medium">
                    {qty}
                  </span>
                  <button
                    onClick={() => onUpdateQty(p.id, qty + 1)}
                    className="w-8 h-8 flex items-center justify-center border rounded text-gray-600 hover:bg-gray-50"
                  >
                    +
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onAdd(p, 1)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
                >
                  Add to Cart
                </button>
              )}

              <div className="text-xs text-gray-500">
                {p.in_stock ? (
                  <span className="text-green-600">✓ In Stock</span>
                ) : (
                  <span className="text-red-600">Out of Stock</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};