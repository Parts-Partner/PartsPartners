import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Minus, ShoppingCart, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from 'services/supabaseClient';

// TypeScript interfaces
interface Manufacturer {
  id: string;
  make: string;
  manufacturer: string;
}

interface Part {
  id: string; // UUID
  part_number: string;
  part_description: string;
  category: string;
  list_price: string | number;
  compatible_models: string[] | string;
  image_url?: string;
  in_stock: boolean;
  created_at?: string;
  updated_at?: string;
  manufacturer_id: string;
  make_part_number?: string;
  // Joined manufacturer data
  manufacturer?: Manufacturer;
}

interface CartItem extends Part {
  quantity: number;
}

interface UserProfile {
  id: string;
  discount_percentage: number;
}

interface PartsSearchProps {
  onAddToCart: (part: Part) => void;
  cartItems?: CartItem[];
  onUpdateQuantity?: (partId: string, quantity: number) => void;
}

const PartsSearch: React.FC<PartsSearchProps> = ({ onAddToCart, cartItems = [], onUpdateQuantity }) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [parts, setParts] = useState<Part[]>([]);
  const [filteredParts, setFilteredParts] = useState<Part[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(false);
  const [userDiscount, setUserDiscount] = useState<number>(0);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [totalParts, setTotalParts] = useState<number>(0);
  const [searchPerformed, setSearchPerformed] = useState<boolean>(false);
  const [categories, setCategories] = useState<string[]>([]);

  // Use local placeholder image
  const placeholderImageUrl = '/No_Product_Image_Filler.png';

  // Fetch manufacturers from Supabase
  const fetchManufacturers = async (): Promise<void> => {
    try {
      console.log('Fetching manufacturers...');
      
      const { data, error } = await supabase
        .from('manufacturers')
        .select('*')
        .order('manufacturer');

      console.log('Manufacturers response:', { data, error });
      
      if (error) {
        console.error('Supabase error details:', error);
        return;
      }

      console.log('Setting manufacturers:', data);
      setManufacturers(data || []);
    } catch (error) {
      console.error('Catch block error:', error);
    }
  };

  // Fetch categories from database
  const fetchCategories = async (): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('parts')
        .select('category')
        .not('category', 'is', null);

      if (error) {
        console.error('Error fetching categories:', error);
        return;
      }

      const uniqueCategories = Array.from(new Set(data?.map(item => item.category).filter(Boolean))) as string[];
      setCategories(uniqueCategories.sort());
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  // Get total count of parts
  const fetchTotalPartsCount = async (): Promise<void> => {
    try {
      const { count, error } = await supabase
        .from('parts')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error('Error fetching parts count:', error);
        return;
      }

      setTotalParts(count || 0);
      console.log('Total parts in database:', count);
    } catch (error) {
      console.error('Error fetching parts count:', error);
    }
  };

  // Server-side search function using PostgreSQL ilike
  const performServerSearch = useCallback(async (
    searchQuery: string,
    category: string = 'all',
    manufacturerId: string = 'all'
  ): Promise<void> => {
    try {
      setLoading(true);
      setSearchPerformed(true);

      let query = supabase
        .from('parts')
        .select(`
          *,
          manufacturer:manufacturer_id (
            id,
            make,
            manufacturer
          )
        `)
        .limit(1000) // Smart result limiting
        .order('part_number');

      // Apply text search across multiple fields using PostgreSQL ilike
      if (searchQuery.trim()) {
        const searchLower = searchQuery.toLowerCase().trim();
        
        // Search across all relevant fields
        query = query.or(`
          part_number.ilike.%${searchLower}%,
          part_description.ilike.%${searchLower}%,
          make_part_number.ilike.%${searchLower}%,
          compatible_models::text.ilike.%${searchLower}%
        `);
      }

      // Apply category filter
      if (category !== 'all') {
        query = query.eq('category', category);
      }

      // Apply manufacturer filter with join
      if (manufacturerId !== 'all') {
        query = query.eq('manufacturer_id', manufacturerId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Search error:', error);
        alert('Search failed. Please try again.');
        return;
      }

      const typedParts: Part[] = (data || []).map((item: any) => ({
        id: item.id,
        part_number: item.part_number || '',
        part_description: item.part_description || '',
        category: item.category || '',
        list_price: item.list_price || '0',
        compatible_models: item.compatible_models || [],
        image_url: item.image_url,
        in_stock: Boolean(item.in_stock),
        created_at: item.created_at,
        updated_at: item.updated_at,
        manufacturer_id: item.manufacturer_id,
        make_part_number: item.make_part_number,
        manufacturer: item.manufacturer
      }));

      console.log(`Server search results: ${typedParts.length} parts found`);
      setParts(typedParts);
      setFilteredParts(typedParts);

    } catch (error) {
      console.error('Network error during search:', error);
      alert('Network error: Unable to search. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Search button handler
  const handleSearch = () => {
    performServerSearch(searchTerm, selectedCategory, selectedManufacturer);
  };

  // Handle Enter key press in search input
  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Fetch user discount from profile
  const fetchUserDiscount = async (): Promise<void> => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.log('Auth error (user not logged in):', authError);
        return;
      }
      
      if (!user) {
        console.log('No authenticated user - using default discount');
        return;
      }
      
      const { data, error } = await supabase
        .from('profiles')
        .select('discount_percentage')
        .eq('id', user.id)
        .single();

      if (error) {
        console.log('No user profile found or error fetching discount:', error);
        return;
      }

      const profile = data as UserProfile | null;
      const discount = profile?.discount_percentage || 0;
      console.log('User discount loaded:', discount);
      setUserDiscount(discount);
    } catch (error) {
      console.log('Error fetching user discount (non-critical):', error);
    }
  };

  // Initialize data on component mount
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchManufacturers(),
        fetchCategories(),
        fetchTotalPartsCount(),
      ]);
      setTimeout(() => {
        fetchUserDiscount();
      }, 500);
    };
    
    loadData();
  }, []);

  // Auto-search when filters change (but not search term)
  useEffect(() => {
    if (searchPerformed) {
      performServerSearch(searchTerm, selectedCategory, selectedManufacturer);
    }
  }, [selectedCategory, selectedManufacturer, performServerSearch, searchTerm, searchPerformed]);

  const calculateDiscountedPrice = (price: string | number): string => {
    const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
    const discountAmount = numericPrice * (userDiscount / 100);
    return (numericPrice - discountAmount).toFixed(2);
  };

  const isInCart = (partId: string): boolean => {
    return cartItems.some((item: CartItem) => item.id === partId);
  };

  const getCartQuantity = (partId: string): number => {
    const item = cartItems.find((item: CartItem) => item.id === partId);
    return item ? item.quantity : 0;
  };

  const handleQuantityDecrease = (e: React.MouseEvent, partId: string) => {
    e.stopPropagation(); // Prevent opening PDP
    const currentQuantity = getCartQuantity(partId);
    if (currentQuantity > 0 && onUpdateQuantity) {
      onUpdateQuantity(partId, currentQuantity - 1);
    }
  };

  const handleQuantityIncrease = (e: React.MouseEvent, part: Part) => {
    e.stopPropagation(); // Prevent opening PDP
    const currentQuantity = getCartQuantity(part.id);
    if (currentQuantity === 0) {
      // If not in cart, add to cart
      onAddToCart(part);
    } else if (onUpdateQuantity) {
      // If already in cart, increase quantity
      onUpdateQuantity(part.id, currentQuantity + 1);
    }
  };

  const handleAddToCartClick = (e: React.MouseEvent, part: Part) => {
    e.stopPropagation(); // Prevent opening PDP
    onAddToCart(part);
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedManufacturer('all');
    setParts([]);
    setFilteredParts([]);
    setSearchPerformed(false);
  };

  if (loading && !searchPerformed) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)'
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 16px' }}>
        {/* Search and Filters Section */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #ebe5e5ff',
          padding: '32px',
          marginBottom: '32px',
          position: 'relative',
          zIndex: 10
        }}>
          <div style={{
            display: 'flex',
            flexDirection: window.innerWidth >= 1024 ? 'row' : 'column',
            gap: '24px'
          }}>
            {/* Search Input with Button */}
            <div style={{ flex: 1, position: 'relative', display: 'flex', gap: '8px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9ca3af',
                  width: '20px',
                  height: '20px'
                }} />
                <input
                  type="text"
                  placeholder="Search by part number, description, manufacturer, or model..."
                  style={{
                    width: '100%',
                    paddingLeft: '48px',
                    paddingRight: '16px',
                    paddingTop: '12px',
                    paddingBottom: '12px',
                    border: '5px solid #d63838ff',
                    borderRadius: '12px',
                    fontSize: '16px',
                    color: '#111827',
                    backgroundColor: 'white',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={handleSearchKeyPress}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#d63838ff';
                    e.target.style.boxShadow = '0 0 0 3px #d63838ff';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
              
              {/* Search Button */}
              <button
                onClick={handleSearch}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  background: loading 
                    ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)'
                    : 'linear-gradient(135deg, #d63838ff 0%, #b91c1c 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                  minWidth: '120px'
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 16px rgba(214, 56, 56, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Searching...
                  </>
                ) : (
                  <>
                    <Search size={18} />
                    Search
                  </>
                )}
              </button>
            </div>

            {/* Category Filter */}
            <div style={{ minWidth: '224px', position: 'relative' }}>
              <select
                value={selectedCategory}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  backgroundColor: 'white',
                  color: '#111827',
                  fontSize: '16px',
                  outline: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                  zIndex: 1000
                }}
              >
                <option value="all">All Categories</option>
                {categories.map((category: string) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            {/* Manufacturer Filter */}
            <div style={{ minWidth: '224px', position: 'relative' }}>
              <select
                value={selectedManufacturer}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedManufacturer(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  backgroundColor: 'white',
                  color: '#111827',
                  fontSize: '16px',
                  outline: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                  zIndex: 1000
                }}
              >
                <option value="all">All Manufacturers</option>
                {manufacturers.map((manufacturer: Manufacturer) => (
                  <option key={manufacturer.id} value={manufacturer.id}>
                    {manufacturer.manufacturer}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              {searchPerformed ? (
                <>
                  <p style={{ fontSize: '1.125rem', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                    Found <span style={{ color: '#2563eb', fontWeight: 'bold' }}>{filteredParts.length}</span> parts
                    {filteredParts.length === 1000 && (
                      <span style={{ color: '#dc2626', fontSize: '0.875rem', marginLeft: '8px' }}>
                        (showing first 1,000 results - refine search for more specific results)
                      </span>
                    )}
                  </p>
                  <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    Searching {totalParts.toLocaleString()} total parts in database
                  </p>
                </>
              ) : (
                <p style={{ fontSize: '1.125rem', fontWeight: '500', color: '#6b7280' }}>
                  Search through {totalParts.toLocaleString()} available parts
                </p>
              )}
            </div>
            
            {filteredParts.length > 0 && searchTerm && (
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                Results for "{searchTerm}"
              </div>
            )}
          </div>
        </div>

        {/* Smart result limiting warning */}
        {filteredParts.length === 1000 && (
          <div style={{
            backgroundColor: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px',
            textAlign: 'center'
          }}>
            <p style={{ color: '#92400e', fontSize: '0.875rem', margin: 0 }}>
              <strong>Showing first 1,000 results.</strong> For better performance and more specific results, try refining your search with more specific terms or use the category/manufacturer filters.
            </p>
          </div>
        )}

        {/* Parts Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(300px, 1fr))`,
          gap: '32px'
        }}>
          {filteredParts.map((part: Part) => {
            const compatibleModels = Array.isArray(part.compatible_models) 
              ? part.compatible_models 
              : typeof part.compatible_models === 'string' 
                ? [part.compatible_models] 
                : [];

            const priceValue = typeof part.list_price === 'string' ? part.list_price : part.list_price.toString();
            const listPrice = typeof part.list_price === 'string' ? parseFloat(part.list_price) : part.list_price;
            const discountedPrice = userDiscount > 0 ? parseFloat(calculateDiscountedPrice(part.list_price)) : listPrice;
            const currentQuantity = getCartQuantity(part.id);

            return (
              <div 
                key={part.id}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease',
                  border: '1px solid #e5e7eb',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                }}
              >
                {/* Clickable part tile area */}
                <div 
                  onClick={() => setSelectedPart(part)}
                  style={{ cursor: 'pointer', padding: '16px' }}
                >
                  {/* Part Image */}
                  <div style={{
                    width: '100%',
                    height: '160px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    marginBottom: '12px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <img
                      src={part.image_url || placeholderImageUrl}
                      alt={part.part_description}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                      onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                        const target = e.target as HTMLImageElement;
                        target.src = placeholderImageUrl;
                      }}
                    />
                  </div>

                  {/* Part Number */}
                  <h3 style={{
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: '#111827',
                    marginBottom: '4px',
                    lineHeight: '1.3'
                  }}>
                    {part.part_number}
                  </h3>

                  {/* Description */}
                  <p style={{
                    color: '#6b7280',
                    fontSize: '0.875rem',
                    marginBottom: '8px',
                    lineHeight: '1.4',
                    height: '40px',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    {part.part_description}
                  </p>

                  {/* Manufacturer Info */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '12px',
                    fontSize: '0.75rem',
                    color: '#64748b'
                  }}>
                    <span><strong>OEM:</strong> {part.manufacturer?.manufacturer || 'N/A'}</span>
                    <span>•</span>
                    <span><strong>Make:</strong> {part.manufacturer?.make || 'N/A'}</span>
                  </div>

                  {/* Price Section */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{
                      fontSize: '1.25rem',
                      fontWeight: 'bold',
                      color: '#059669',
                      marginBottom: '4px'
                    }}>
                      ${discountedPrice.toFixed(2)}
                    </div>
                    {userDiscount > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '0.875rem',
                          color: '#9ca3af',
                          textDecoration: 'line-through'
                        }}>
                          ${listPrice.toFixed(2)}
                        </span>
                        <span style={{
                          fontSize: '0.75rem',
                          color: '#dc2626',
                          fontWeight: '600',
                          backgroundColor: '#fef2f2',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          {userDiscount}% OFF
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Add to Cart Section - Not clickable for PDP */}
                <div style={{
                  padding: '0 16px 16px',
                  borderTop: '1px solid #f1f5f9'
                }}>
                  {currentQuantity > 0 ? (
                    /* Quantity Controls */
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '8px 12px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0'
                      }}>
                        <button
                          onClick={(e) => handleQuantityDecrease(e, part.id)}
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            border: '1px solid #d1d5db',
                            backgroundColor: 'white',
                            color: '#374151',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'white';
                          }}
                        >
                          <Minus size={14} />
                        </button>
                        
                        <span style={{
                          minWidth: '24px',
                          textAlign: 'center',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: '#111827'
                        }}>
                          {currentQuantity}
                        </span>
                        
                        <button
                          onClick={(e) => handleQuantityIncrease(e, part)}
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            border: '1px solid #d1d5db',
                            backgroundColor: 'white',
                            color: '#374151',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'white';
                          }}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.875rem',
                        color: '#059669',
                        fontWeight: '500'
                      }}>
                        <ShoppingCart size={16} />
                        In Cart
                      </div>
                    </div>
                  ) : (
                    /* Add to Cart Button */
                    <button
                      onClick={(e) => handleAddToCartClick(e, part)}
                      disabled={!part.in_stock}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        borderRadius: '8px',
                        fontWeight: '600',
                        fontSize: '0.875rem',
                        border: 'none',
                        cursor: part.in_stock ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s ease',
                        background: part.in_stock 
                          ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
                          : '#d1d5db',
                        color: part.in_stock ? 'white' : '#6b7280',
                        boxShadow: part.in_stock ? '0 2px 4px rgba(0, 0, 0, 0.1)' : 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (part.in_stock) {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (part.in_stock) {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                        }
                      }}
                    >
                      <Plus size={16} />
                      Add to Cart
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* No Search Performed State */}
        {!searchPerformed && !loading && (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e5e7eb',
              padding: '48px',
              maxWidth: '500px',
              margin: '0 auto'
            }}>
              <div style={{ color: '#3b82f6', marginBottom: '24px' }}>
                <Search style={{ width: '80px', height: '80px', margin: '0 auto' }} />
              </div>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: '#111827',
                marginBottom: '16px'
              }}>
                Ready to Search
              </h3>
              <p style={{
                color: '#6b7280',
                marginBottom: '32px',
                lineHeight: '1.5'
              }}>
                Enter your search terms above and click "Search" to find parts from our inventory of <strong>{totalParts.toLocaleString()}</strong> items.
              </p>
              <div style={{
                padding: '16px',
                backgroundColor: '#f0f9ff',
                borderRadius: '8px',
                border: '1px solid #bae6fd',
                marginTop: '24px'
              }}>
                <p style={{ color: '#0369a1', fontSize: '0.875rem', margin: 0 }}>
                  💡 <strong>Search Tips:</strong> Try part numbers, descriptions, manufacturer names, or compatible models. Use filters to narrow results.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* No Results State */}
        {searchPerformed && filteredParts.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e5e7eb',
              padding: '48px',
              maxWidth: '500px',
              margin: '0 auto'
            }}>
              <div style={{ color: '#9ca3af', marginBottom: '24px' }}>
                <Search style={{ width: '80px', height: '80px', margin: '0 auto' }} />
              </div>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: '#111827',
                marginBottom: '16px'
              }}>
                No parts found
              </h3>
              <p style={{
                color: '#6b7280',
                marginBottom: '24px',
                lineHeight: '1.5'
              }}>
                No parts match your current search criteria. Try:
              </p>
              <ul style={{
                textAlign: 'left',
                color: '#6b7280',
                marginBottom: '32px',
                maxWidth: '300px',
                margin: '0 auto 32px',
                listStyle: 'none',
                padding: 0
              }}>
                <li>• Checking your spelling</li>
                <li>• Using fewer or different keywords</li>
                <li>• Removing some filters</li>
                <li>• Searching by part number instead</li>
              </ul>
              <button
                onClick={clearAllFilters}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  borderRadius: '12px',
                  fontWeight: '600',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#1d4ed8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                }}
              >
                Clear Search & Filters
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Product Detail Modal with click-outside support */}
      {selectedPart && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedPart(null)} // Click outside to close
        >
          <div 
            className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">{selectedPart.part_number}</h2>
                <button
                  onClick={() => setSelectedPart(null)}
                  className="text-white hover:text-gray-200 transition-colors text-2xl"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Product Image */}
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={selectedPart.image_url || placeholderImageUrl}
                    alt={selectedPart.part_description}
                    className="w-full h-full object-cover"
                    onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                      const target = e.target as HTMLImageElement;
                      target.src = placeholderImageUrl;
                    }}
                  />
                </div>

                {/* Product Details */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{selectedPart.part_number}</h3>
                    <p className="text-gray-600 text-lg">{selectedPart.part_description}</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">OEM:</span>
                      <span className="text-gray-900">{selectedPart.manufacturer?.manufacturer || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">Make:</span>
                      <span className="text-gray-900">{selectedPart.manufacturer?.make || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">Category:</span>
                      <span className="text-gray-900">{selectedPart.category}</span>
                    </div>
                    {selectedPart.make_part_number && (
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-700">Make P/N:</span>
                        <span className="text-gray-900">{selectedPart.make_part_number}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">Stock Status:</span>
                      <span className={`font-medium ${selectedPart.in_stock ? 'text-green-600' : 'text-red-600'}`}>
                        {selectedPart.in_stock ? '✓ In Stock' : '✗ Out of Stock'}
                      </span>
                    </div>
                  </div>

                  {/* Compatible Models */}
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Compatible Models:</h4>
                    <p className="text-gray-900 text-sm">
                      {Array.isArray(selectedPart.compatible_models) 
                        ? selectedPart.compatible_models.join(', ')
                        : selectedPart.compatible_models || 'Universal'}
                    </p>
                  </div>

                  {/* Pricing */}
                  <div className="border-t pt-4">
                    {userDiscount > 0 ? (
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl font-bold text-green-600">
                            ${calculateDiscountedPrice(selectedPart.list_price)}
                          </span>
                          <span className="text-lg text-gray-500 line-through">
                            ${typeof selectedPart.list_price === 'string' ? selectedPart.list_price : selectedPart.list_price.toString()}
                          </span>
                        </div>
                        <div className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                          {userDiscount}% discount applied
                        </div>
                      </div>
                    ) : (
                      <span className="text-2xl font-bold text-gray-900">
                        ${typeof selectedPart.list_price === 'string' ? selectedPart.list_price : selectedPart.list_price.toString()}
                      </span>
                    )}
                  </div>

                  {/* Add to Cart Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToCart(selectedPart);
                    }}
                    disabled={!selectedPart.in_stock}
                    className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                      selectedPart.in_stock
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {isInCart(selectedPart.id) ? (
                      <>
                        <ShoppingCart className="w-5 h-5" />
                        In Cart ({getCartQuantity(selectedPart.id)})
                      </>
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        Add to Cart
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartsSearch;