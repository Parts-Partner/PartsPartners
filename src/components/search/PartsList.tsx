// src/components/search/PartsList.tsx - MAXIMUM SAFETY VERSION
import React, { useState, useEffect } from 'react';
import type { Part } from 'services/partsService';

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
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // DEBUG: Confirm we're using the fixed version
    console.log('🛠️ PartsList: Using FIXED version with safe manufacturer rendering');
  }, []);

  // ULTRA-SAFE HELPER FUNCTIONS
const getManufacturerName = (part: any): string => {
  if (part.manufacturer_name && typeof part.manufacturer_name === 'string') {
    return part.manufacturer_name.trim();
  }
  return '';
};

  const getMake = (part: any): string => {
    // Based on your RPC response, the field is "make" 
    if (part.make && typeof part.make === 'string') {
      return part.make.trim();
    }
    return '';
  };

  // ULTRA-SAFE PART RENDERER
  const renderPart = (p: any, index: number) => {
    try {
      // DEBUG: Log problematic parts
      if (typeof p.manufacturer === 'object') {
        console.log(`🐛 Part ${index} has object manufacturer:`, p.manufacturer);
      }

      const partId = String(p.id || `part-${index}`);
      const partNumber = String(p.part_number || 'Unknown Part');
      const partDescription = String(p.part_description || 'No description');
      
      const unit = typeof p.list_price === 'string' 
        ? parseFloat(p.list_price) || 0
        : Number(p.list_price) || 0;
      const discounted = unit * (1 - (Number(discountPct) || 0) / 100);
      const qty = getQty(partId);

      const manufacturerName = getManufacturerName(p);
      const make = getMake(p);

      return (
        <div key={partId} className="bg-white border rounded-xl p-4 shadow-sm hover:shadow cursor-pointer">
          <button
            type="button"
            className="text-left w-full"
            onClick={() => {
              if (onView) {
                onView(p);
              } else {
                window.dispatchEvent(new CustomEvent('pp:viewPart', { detail: { id: partId } }));
              }
            }}
            aria-label={`View ${partNumber}`}
          >
            {/* ULTRA-SAFE MANUFACTURER DISPLAY */}
            <div className="text-xs text-gray-500">
              {manufacturerName}
              {make && ` • ${make}`}
            </div>
            
            <div className="font-semibold text-lg underline decoration-transparent hover:decoration-slate-300">
              {partNumber}
            </div>
            
            <div className="text-sm text-gray-700 line-clamp-2">
              {partDescription}
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
              <div className="font-bold text-green-700">${discounted.toFixed(2)}</div>
            </div>
          </div>

          {/* Cart controls */}
          <div className="mt-3 flex items-center justify-between">
            {qty > 0 ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onUpdateQty(partId, Math.max(0, qty - 1))}
                  className="w-8 h-8 flex items-center justify-center border rounded text-gray-600 hover:bg-gray-50"
                >
                  -
                </button>
                <span className="w-8 text-center text-sm font-medium">{qty}</span>
                <button
                  onClick={() => onUpdateQty(partId, qty + 1)}
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
    } catch (error) {
      console.error(`Error rendering part ${index}:`, error, p);
      return (
        <div key={`error-${index}`} className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="text-red-700">Error rendering part</div>
        </div>
      );
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!isClient) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600" />
      </div>
    );
  }

  // ULTRA-SAFE PARTS RENDERING
  try {
    const safeParts = Array.isArray(parts) ? parts : [];
    console.log(`🔍 PartsList: Rendering ${safeParts.length} parts`);
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {safeParts.map((part, index) => renderPart(part, index))}
      </div>
    );
  } catch (error) {
    console.error('Critical error in PartsList:', error);
    return (
      <div className="text-center py-8">
        <div className="text-red-600">Unable to display parts</div>
        <div className="text-sm text-gray-500 mt-2">Check console for details</div>
      </div>
    );
  }
};