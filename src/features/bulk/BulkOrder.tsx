import React, { useState, useCallback, useEffect } from 'react';
import { X, Upload, Trash2, AlertCircle, CheckCircle, Edit2, Plus, Download } from 'lucide-react';
import { supabase } from 'services/supabaseClient';
import { rateLimitUtils, RateLimitError } from 'lib/rateLimiting';

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
  initialText?: string;
}

const BulkOrder: React.FC<BulkOrderProps> = ({ isOpen, onClose, onAddToCart, userProfile, initialText = '' }) => {
  const [items, setItems] = useState<BulkOrderItem[]>([]);
  const [rawInput, setRawInput] = useState<string>('');
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [validationComplete, setValidationComplete] = useState<boolean>(false);
  const [showFireworks, setShowFireworks] = useState<boolean>(false);

  // Rate limiting state
  const [rateLimited, setRateLimited] = useState<boolean>(false);
  const [rateLimitMessage, setRateLimitMessage] = useState<string>('');
  const [retryAfter, setRetryAfter] = useState<number>(0);

  // Handle initial text when modal opens
  useEffect(() => {
    if (initialText && isOpen) {
      console.log('🔥 BulkOrder: Setting initial text:', initialText);
      setRawInput(initialText);
      handleInputChange(initialText);
    }
  }, [initialText, isOpen]);

  // Auto-validate when items are loaded from initial text
  useEffect(() => {
    if (items.length > 0 && showPreview && !validationComplete && initialText && !rateLimited) {
      console.log('🔥 BulkOrder: Auto-validating items from initial text');
      // Only auto-validate if this came from initial text and we haven't validated yet
      setTimeout(() => {
        validateItems();
      }, 200);
    }
  }, [items, showPreview, validationComplete, initialText, rateLimited]);

  // Rate limit countdown timer
  useEffect(() => {
    if (retryAfter > 0) {
      const timer = setInterval(() => {
        setRetryAfter(prev => {
          if (prev <= 1) {
            setRateLimited(false);
            setRateLimitMessage('');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [retryAfter]);

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
      
      // Handle single part number without quantity
      if (parts.length === 1) {
        const partNumber = parts[0].trim().toUpperCase().replace(/[^A-Z0-9\-_]/g, '');
        if (partNumber) {
          parsedItems.push({
            id: `bulk-${index}-${Date.now()}`,
            partNumber,
            quantity: 1, // Default quantity
            status: 'pending'
          });
        }
        return;
      }

      // Handle part number + quantity
      if (parts.length >= 2) {
        const partNumber = parts[0].trim().toUpperCase().replace(/[^A-Z0-9\-_]/g, '');
        const quantityStr = parts[1].trim();
        const quantity = parseInt(quantityStr, 10);

        if (partNumber && !isNaN(quantity) && quantity > 0) {
          parsedItems.push({
            id: `bulk-${index}-${Date.now()}`,
            partNumber,
            quantity,
            status: 'pending'
          });
        }
      }
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
    
    // Clear rate limiting state when user changes input
    setRateLimited(false);
    setRateLimitMessage('');
    setRetryAfter(0);
  };

  // Validate items using Supabase RPC with rate limiting
  const validateItems = async () => {
    if (items.length === 0) return;
    if (rateLimited) return;

    setIsValidating(true);
    
    // Clear any previous rate limit state
    setRateLimited(false);
    setRateLimitMessage('');
    setRetryAfter(0);
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Extract part numbers
      const partNumbers = items.map(item => item.partNumber);
      
      console.log('🔍 Validating part numbers:', partNumbers);
      
      // Call Supabase RPC function
      const { data: validationResults, error } = await supabase.rpc('validate_bulk_skus', {
        part_numbers: partNumbers,
        customer_id: user?.id || null
      });

      if (error) {
        console.error('Validation error:', error);
        
        // Check if this is a rate limiting error
        if (rateLimitUtils.isRateLimitError(error)) {
          handleRateLimitError(error as RateLimitError);
          return;
        }
        
        // Try fallback validation if RPC fails
        const fallbackResults = await fallbackValidation(partNumbers, user?.id || null);
        if (fallbackResults) {
          processValidationResults(fallbackResults);
        } else {
          alert('Validation failed. Please try again.');
        }
        return;
      }

      processValidationResults(validationResults);
      
    } catch (error) {
      console.error('Validation failed:', error);
      
      // Handle rate limiting errors
      if (rateLimitUtils.isRateLimitError(error)) {
        handleRateLimitError(error as RateLimitError);
        return;
      }
      
      // Try fallback validation for other errors
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const partNumbers = items.map(item => item.partNumber);
        const fallbackResults = await fallbackValidation(partNumbers, user?.id || null);
        if (fallbackResults) {
          processValidationResults(fallbackResults);
        } else {
          alert('Validation failed. Please check your connection and try again.');
        }
      } catch (fallbackError) {
        if (rateLimitUtils.isRateLimitError(fallbackError)) {
          handleRateLimitError(fallbackError as RateLimitError);
        } else {
          alert('Validation failed. Please check your connection and try again.');
        }
      }
    } finally {
      setIsValidating(false);
    }
  };

  // Handle rate limiting errors
  const handleRateLimitError = (error: RateLimitError) => {
    setRateLimited(true);
    setRateLimitMessage(rateLimitUtils.getRateLimitMessage('bulk', error));
    setRetryAfter(error.getRetryAfterSeconds());
    
    console.warn(`🚫 BulkOrder validation rate limited: ${error.message}`);
    
    // Show user-friendly notification
    rateLimitUtils.showRateLimitNotification('bulk', error);
  };

  // Fallback validation using direct queries with rate limiting protection
  const fallbackValidation = async (partNumbers: string[], customerId: string | null) => {
    try {
      console.log('🔄 Using fallback validation for:', partNumbers);
      
      // Query parts directly
      const { data: parts, error } = await supabase
        .from('parts')
        .select(`
          id,
          part_number,
          part_description,
          list_price,
          in_stock,
          manufacturer:manufacturer_id (
            id,
            manufacturer,
            make
          )
        `)
        .in('part_number', partNumbers);

      if (error) {
        console.error('Fallback validation error:', error);
        
        // Check if this is a rate limiting error
        if (rateLimitUtils.isRateLimitError(error)) {
          throw error; // Re-throw to be handled by caller
        }
        
        return null;
      }

      // Transform to expected format
      const results = partNumbers.map(partNumber => {
        const part = parts?.find(p => p.part_number === partNumber);
        if (part) {
          const listPrice = typeof part.list_price === 'string' 
            ? parseFloat(part.list_price) 
            : part.list_price || 0;
          
          // Apply user discount if available
          const discountPct = userProfile?.discount_percentage || 0;
          const discountedPrice = listPrice * (1 - discountPct / 100);

          return {
            part_number: part.part_number,
            part_id: part.id,
            description: part.part_description || 'No description available',
            price: listPrice,
            discounted_price: discountedPrice,
            in_stock: Boolean(part.in_stock),
            status: 'ok' as const,
            message: undefined
          };
        } else {
          return {
            part_number: partNumber,
            part_id: '',
            description: '',
            price: 0,
            discounted_price: 0,
            in_stock: false,
            status: 'error' as const,
            message: 'Part not found'
          };
        }
      });

      return results;
    } catch (error) {
      console.error('Fallback validation failed:', error);
      
      // Re-throw rate limiting errors to be handled by caller
      if (rateLimitUtils.isRateLimitError(error)) {
        throw error;
      }
      
      return null;
    }
  };

  // Process validation results
  const processValidationResults = (validationResults: ValidationResult[]) => {
    console.log('🔍 Processing validation results:', validationResults);

    // Map validation results back to items
    const validatedItems: BulkOrderItem[] = items.map(item => {
      const result = validationResults?.find((r: ValidationResult) => 
        r.part_number === item.partNumber
      );

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
        
        return mappedItem;
      } else {
        return {
          ...item,
          status: 'error' as const,
          errorMessage: 'Part not found in catalog'
        };
      }
    });

    console.log('🔍 Final validated items:', validatedItems);
    console.log('🔍 Valid count:', validatedItems.filter(i => i.status === 'valid').length);
    console.log('🔍 Warning count:', validatedItems.filter(i => i.status === 'warning').length);
    console.log('🔍 Error count:', validatedItems.filter(i => i.status === 'error').length);

    setItems(validatedItems);
    setValidationComplete(true);
  };

  // Update item
  const updateItem = (id: string, updates: Partial<BulkOrderItem>) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates, status: 'pending' } : item
    ));
    // Reset validation when user makes changes
    setValidationComplete(false);
  };

  // Delete item
  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  // Add to cart with rate limiting protection
  const handleAddToCart = () => {
    if (rateLimited) {
      alert('Please wait before adding items to cart due to rate limiting.');
      return;
    }

    const validItems = items.filter(item => 
      item.status === 'valid' || item.status === 'warning'
    );

    if (validItems.length === 0) {
      alert('No valid items to add to cart');
      return;
    }

    try {
      // Convert to cart format
      const cartItems = validItems.map(item => ({
        id: item.partId,
        part_number: item.partNumber,
        part_description: item.description,
        list_price: item.price,
        quantity: item.quantity,
        discounted_price: item.discountedPrice || item.price,
        in_stock: item.availability === 'in_stock',
        // Additional fields for cart compatibility
        category: '',
        compatible_models: [],
        image_url: null,
        manufacturer_id: '',
        make_part_number: null,
        manufacturer: null
      }));

      console.log('🛒 Adding items to cart:', cartItems);
      onAddToCart(cartItems);
      
      // Show fireworks animation
      setShowFireworks(true);
      setTimeout(() => {
        setShowFireworks(false);
        onClose();
        // Reset form after closing
        resetForm();
      }, 2000);
      
    } catch (error) {
      console.error('Error adding items to cart:', error);
      
      if (rateLimitUtils.isRateLimitError(error)) {
        handleRateLimitError(error as RateLimitError);
      } else {
        alert('Failed to add items to cart. Please try again.');
      }
    }
  };

  // Reset form
  const resetForm = () => {
    setItems([]);
    setRawInput('');
    setShowPreview(false);
    setValidationComplete(false);
    
    // Clear rate limiting state
    setRateLimited(false);
    setRateLimitMessage('');
    setRetryAfter(0);
  };

  // Close handler with cleanup
  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Retry validation after rate limit expires
  const handleRetryValidation = () => {
    setRateLimited(false);
    setRateLimitMessage('');
    setRetryAfter(0);
    validateItems();
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
        <div className="bg-red-600 text-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Upload className="w-6 h-6" />
              <h2 className="text-xl font-bold">Bulk Order</h2>
            </div>
            <button
              onClick={handleClose}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <p className="text-white/90 text-sm mt-2">
            Paste part numbers and quantities directly from Excel, Google Sheets, or any spreadsheet
          </p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Rate limit notification banner */}
          {rateLimited && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 text-sm font-bold">!</span>
                </div>
                <div className="flex-1">
                  <div className="text-red-800 font-medium">Validation Rate Limited</div>
                  <div className="text-red-700 text-sm">{rateLimitMessage}</div>
                </div>
                {retryAfter > 0 && (
                  <div className="text-red-600 font-mono text-sm">
                    {retryAfter}s
                  </div>
                )}
                {retryAfter === 0 && (
                  <button
                    onClick={handleRetryValidation}
                    className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
                  >
                    Try Again
                  </button>
                )}
              </div>
            </div>
          )}

          {!showPreview ? (
            /* Input Stage */
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Paste your part list
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
SINGLE-PART

Each line can contain:
• Part Number only (quantity defaults to 1)
• Part Number + Quantity (separated by space, comma, tab, etc.)`}
                  className="w-full h-48 p-4 border-2 border-gray-300 rounded-lg resize-none focus:border-red-500 focus:outline-none font-mono text-sm"
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
                      className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
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
                      disabled={isValidating || rateLimited}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                      {isValidating ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Validating...
                        </>
                      ) : rateLimited ? (
                        `Rate Limited (${retryAfter}s)`
                      ) : (
                        'Validate Parts'
                      )}
                    </button>
                  )}
                  {validationComplete && (validCount > 0 || warningCount > 0) && !rateLimited && (
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
                                  disabled={rateLimited}
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
                              disabled={rateLimited}
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
                              disabled={rateLimited}
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