import React, { useState, useCallback } from 'react';
import { X, Upload, Trash2, AlertCircle, CheckCircle, Edit2, Plus, Download } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client (you can also import this from your existing setup)
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

// Types
interface BulkOrderItem {
  id: string;
  partNumber: string;
  quantity: number;
  description?: string;
  price?: number;
  discountedPrice?: number;
  availability?: 'in_stock' | 'out_of_stock' | 'unknown';
  status: 'pending' | 'valid' | 'warning' | 'error';
  errorMessage?: string;
  partId?: string;
  isEditing?: boolean;
}

interface ValidationResult {
  part_number: string;
  part_id: string;
  description: string;
  price: number;
  discounted_price: number;
  in_stock: boolean;
  status: 'ok' | 'warn' | 'error';
  message?: string;
}

interface BulkOrderProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (items: any[]) => void;
  userProfile?: any;
}

const BulkOrder: React.FC<BulkOrderProps> = ({ isOpen, onClose, onAddToCart, userProfile }) => {
  const [items, setItems] = useState<BulkOrderItem[]>([]);
  const [rawInput, setRawInput] = useState<string>('');
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [validationComplete, setValidationComplete] = useState<boolean>(false);
  const [showFireworks, setShowFireworks] = useState<boolean>(false);

  // Parse pasted input
  const parseInput = useCallback((input: string): BulkOrderItem[] => {
    if (!input.trim()) return [];

    const lines = input.trim().split('\n');
    const parsedItems: BulkOrderItem[] = [];

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      // Auto-detect delimiter
      let delimiter = '\t'; // Default to tab
      if (trimmedLine.includes('\t')) delimiter = '\t';
      else if (trimmedLine.includes(',')) delimiter = ',';
      else if (trimmedLine.includes(';')) delimiter = ';';
      else if (trimmedLine.includes('|')) delimiter = '|';
      else delimiter = ' '; // Space as last resort

      const parts = trimmedLine.split(delimiter);
      if (parts.length < 2) return;

      const partNumber = parts[0].trim().toUpperCase().replace(/[^A-Z0-9\-_]/g, '');
      const quantityStr = parts[1].trim();
      const quantity = parseInt(quantityStr, 10);

      if (!partNumber || isNaN(quantity) || quantity <= 0) return;

      parsedItems.push({
        id: `bulk-${index}-${Date.now()}`,
        partNumber,
        quantity,
        status: 'pending'
      });
    });

    return parsedItems;
  }, []);

  // Handle paste input
  const handleInputChange = (input: string) => {
    setRawInput(input);
    const parsed = parseInput(input);
    setItems(parsed);
    setShowPreview(parsed.length > 0);
    setValidationComplete(false);
  };

  // Validate items using Supabase RPC
  const validateItems = async () => {
    if (items.length === 0) return;

    setIsValidating(true);
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Extract part numbers
      const partNumbers = items.map(item => item.partNumber);
      
      // Call Supabase RPC function
      const { data: validationResults, error } = await supabase.rpc('validate_bulk_skus', {
        part_numbers: partNumbers,
        customer_id: user?.id || null
      });

      if (error) {
        console.error('Validation error:', error);
        alert('Validation failed. Please try again.');
        return;
      }

      // DEBUG: Log what we got back from Supabase
      console.log('🔍 Raw validation results:', validationResults);
      console.log('🔍 Number of results:', validationResults?.length);
      console.log('🔍 Part numbers we sent:', partNumbers);

      // Map validation results back to items
      const validatedItems: BulkOrderItem[] = items.map(item => {
        const result = validationResults?.find((r: ValidationResult) => 
          r.part_number === item.partNumber
        );

        // DEBUG: Log each mapping
        console.log(`🔍 Processing ${item.partNumber}:`, result);

        if (result) {
          const mappedItem = {
            ...item,
            description: result.description,
            price: Number(result.price),
            discountedPrice: Number(result.discounted_price),
            availability: result.in_stock ? 'in_stock' as const : 'out_of_stock' as const,
            status: (result.status === 'ok' ? 'valid' : result.status === 'warn' ? 'warning' : 'error') as 'valid' | 'warning' | 'error',
            errorMessage: result.message || undefined,
            partId: result.part_id
          };
          
          // DEBUG: Log the mapped item
          console.log(`🔍 Mapped ${item.partNumber} to:`, mappedItem);
          return mappedItem;
        } else {
          return {
            ...item,
            status: 'error' as const,
            errorMessage: 'Validation failed'
          };
        }
      });

      // DEBUG: Log final results and counts
      console.log('🔍 Final validated items:', validatedItems);
      console.log('🔍 Valid count:', validatedItems.filter(i => i.status === 'valid').length);
      console.log('🔍 Warning count:', validatedItems.filter(i => i.status === 'warning').length);
      console.log('🔍 Error count:', validatedItems.filter(i => i.status === 'error').length);

      setItems(validatedItems);
      setValidationComplete(true);
    } catch (error) {
      console.error('Validation failed:', error);
      alert('Validation failed. Please check your connection and try again.');
    } finally {
      setIsValidating(false);
    }
  };

  // Update item
  const updateItem = (id: string, updates: Partial<BulkOrderItem>) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates, status: 'pending' } : item
    ));
    setValidationComplete(false);
  };

  // Delete item
  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  // Add to cart
  const handleAddToCart = () => {
    const validItems = items.filter(item => 
      item.status === 'valid' || item.status === 'warning'
    );

    if (validItems.length === 0) {
      alert('No valid items to add to cart');
      return;
    }

    // Convert to cart format
    const cartItems = validItems.map(item => ({
      id: item.partId,
      part_number: item.partNumber,
      part_description: item.description,
      list_price: item.price,
      quantity: item.quantity,
      discounted_price: item.discountedPrice || item.price,
      in_stock: item.availability === 'in_stock'
    }));

    onAddToCart(cartItems);
    
    // Show fireworks animation instead of alert
    setShowFireworks(true);
    setTimeout(() => {
      setShowFireworks(false);
      onClose();
    }, 2000);
  };

  // Reset form
  const resetForm = () => {
    setItems([]);
    setRawInput('');
    setShowPreview(false);
    setValidationComplete(false);
  };

  if (!isOpen) return null;

  const validCount = items.filter(i => i.status === 'valid').length;
  const warningCount = items.filter(i => i.status === 'warning').length;
  const errorCount = items.filter(i => i.status === 'error').length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden shadow-2xl relative">
        {/* Fireworks Animation Overlay */}
        {showFireworks && (
          <div className="absolute inset-0 z-50 pointer-events-none overflow-hidden rounded-xl">
            {/* Success Message */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-60">
              <div className="bg-green-600 text-white px-8 py-4 rounded-xl shadow-2xl text-xl font-bold animate-bounce">
                🎉 {validCount + warningCount} items added to cart! 🎉
              </div>
            </div>
            
            {/* Firework particles */}
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full animate-ping"
                style={{
                  backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'][i % 5],
                  left: `${20 + Math.random() * 60}%`,
                  top: `${20 + Math.random() * 60}%`,
                  animationDelay: `${Math.random() * 0.5}s`,
                  animationDuration: `${0.8 + Math.random() * 0.4}s`
                }}
              />
            ))}
            
            {/* Larger burst particles */}
            {[...Array(8)].map((_, i) => (
              <div
                key={`burst-${i}`}
                className="absolute w-4 h-4 rounded-full"
                style={{
                  backgroundColor: ['#fbbf24', '#f87171', '#34d399', '#60a5fa'][i % 4],
                  left: `${30 + Math.random() * 40}%`,
                  top: `${30 + Math.random() * 40}%`,
                  animation: `fireworkBurst 1.5s ease-out ${Math.random() * 0.3}s`
                }}
              />
            ))}
          </div>
        )}

        {/* Header */}
        <div className="bg-red-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Upload className="w-6 h-6" />
              <h2 className="text-xl font-bold">Bulk Order</h2>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <p className="text-white-100 text-med mt-2">
            Paste part numbers and quantities directly from Excel or Google Sheets
          </p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {!showPreview ? (
            /* Input Stage */
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Paste your part list (Part Number + Quantity)
                  </label>
                  
                </div>
                <textarea
                  value={rawInput}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder={`Paste your data here. Supported formats:
                    
  PART123    5
  PART456,   10
  PART789;   2
  PART000 |  1

Each line should contain: Part Number [tab/comma/semicolon/pipe/space] Quantity`}
                  className="w-full h-48 p-4 border-2 border-grey-300 rounded-lg resize-none focus:border-black-700 focus:outline-none font-mono text-sm"
                />
              </div>

              {items.length > 0 && (
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-600">
                    Parsed {items.length} items
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={resetForm}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => setShowPreview(true)}
                      className="px-6 py-2 bg-black-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Review Items
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Preview Stage */
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900">{items.length}</div>
                  <div className="text-sm text-gray-600">Total Items</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{validCount}</div>
                  <div className="text-sm text-green-700">Valid</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-600">{warningCount}</div>
                  <div className="text-sm text-yellow-700">Warnings</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">{errorCount}</div>
                  <div className="text-sm text-red-700">Errors</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  ← Back to Edit
                </button>
                <div className="flex gap-3">
                  {!validationComplete && (
                    <button
                      onClick={validateItems}
                      disabled={isValidating}
                      className="px-6 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-400 disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                      {isValidating ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Validating...
                        </>
                      ) : (
                        'Validate Parts'
                      )}
                    </button>
                  )}
                  {validationComplete && (validCount > 0 || warningCount > 0) && (
                    <button
                      onClick={handleAddToCart}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add {validCount + warningCount} to Cart
                    </button>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Part Number
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Qty
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Price
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {items.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 whitespace-nowrap">
                            {item.isEditing ? (
                              <input
                                type="text"
                                value={item.partNumber}
                                onChange={(e) => updateItem(item.id, { partNumber: e.target.value.toUpperCase() })}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                onBlur={() => updateItem(item.id, { isEditing: false })}
                                autoFocus
                              />
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm">{item.partNumber}</span>
                                <button
                                  onClick={() => updateItem(item.id, { isEditing: true })}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateItem(item.id, { quantity: parseInt(e.target.value) || 1 })}
                              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                              min="1"
                            />
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-sm text-gray-900">
                              {item.description || (item.status === 'pending' ? '—' : 'Not found')}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            {item.price ? (
                              <div className="text-sm">
                                <div className="font-medium text-green-600">
                                  ${item.discountedPrice?.toFixed(2) || item.price.toFixed(2)}
                                </div>
                                {item.discountedPrice && item.discountedPrice !== item.price && (
                                  <div className="text-xs text-gray-500 line-through">
                                    ${item.price.toFixed(2)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {item.status === 'pending' && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  Pending
                                </span>
                              )}
                              {item.status === 'valid' && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Valid
                                </span>
                              )}
                              {item.status === 'warning' && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  Warning
                                </span>
                              )}
                              {item.status === 'error' && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  Error
                                </span>
                              )}
                            </div>
                            {item.errorMessage && (
                              <div className="text-xs text-red-600 mt-1">{item.errorMessage}</div>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-right">
                            <button
                              onClick={() => deleteItem(item.id)}
                              className="text-red-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* CSS Animation for firework burst */}
      <style>{`
        @keyframes fireworkBurst {
          0% {
            transform: scale(0) translateY(0);
            opacity: 1;
          }
          50% {
            transform: scale(1.5) translateY(-20px);
            opacity: 0.8;
          }
          100% {
            transform: scale(0) translateY(-40px);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default BulkOrder;