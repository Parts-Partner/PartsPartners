import React, { useState, useEffect } from 'react';
import { Search, Plus, ShoppingCart } from 'lucide-react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
}

// Initialize Supabase client
import { supabase } from '../lib/supabase';

const PartsSearch: React.FC<PartsSearchProps> = ({ onAddToCart, cartItems = [] }) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [parts, setParts] = useState<Part[]>([]);
  const [filteredParts, setFilteredParts] = useState<Part[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(false);
  const [userDiscount, setUserDiscount] = useState<number>(0);

  const placeholderImageUrl = '/No_Product_Image_Filler.png';

  // Fetch parts from Supabase with manufacturer data
  const fetchParts = async (): Promise<void> => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('parts')
        .select(`
          *,
          manufacturer:manufacturer_id (
            id,
            make,
            manufacturer
          )
        `)
        .order('part_number');

      if (error) {
        console.error('Supabase error:', error);
        alert('Unable to load parts. Please check your internet connection and try again.');
        return;
      }

      if (!data || data.length === 0) {
        console.log('No parts found in database');
        setParts([]);
        setFilteredParts([]);
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

      console.log('Successfully loaded parts:', typedParts.length);
      setParts(typedParts);
      setFilteredParts(typedParts);
    } catch (error) {
      console.error('Network error fetching parts:', error);
      alert('Network error: Unable to connect to database. Please check your internet connection.');
    } finally {
      setLoading(false);
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

  useEffect(() => {
    const loadData = async () => {
      await fetchParts();
      setTimeout(() => {
        fetchUserDiscount();
      }, 500);
    };
    
    loadData();
  }, []);

  useEffect(() => {
    let filtered: Part[] = parts;

    if (searchTerm) {
      filtered = filtered.filter((part: Part) => {
        const compatibleModels = Array.isArray(part.compatible_models) 
          ? part.compatible_models 
          : typeof part.compatible_models === 'string' 
            ? [part.compatible_models] 
            : [];
            
        return (
          part.part_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          part.part_description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          part.manufacturer?.manufacturer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          part.manufacturer?.make?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          part.make_part_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          compatibleModels.some((model: string) => 
            model.toLowerCase().includes(searchTerm.toLowerCase())
          )
        );
      });
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter((part: Part) => part.category === selectedCategory);
    }

    if (selectedManufacturer !== 'all') {
      filtered = filtered.filter((part: Part) => 
        part.manufacturer?.manufacturer === selectedManufacturer ||
        part.manufacturer?.make === selectedManufacturer
      );
    }

    setFilteredParts(filtered);
  }, [searchTerm, selectedCategory, selectedManufacturer, parts]);

  const calculateDiscountedPrice = (price: string | number): string => {
    const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
    const discountAmount = numericPrice * (userDiscount / 100);
    return (numericPrice - discountAmount).toFixed(2);
  };

  const getUniqueCategories = (): string[] => {
    return Array.from(new Set(parts.map((part: Part) => part.category)));
  };

  const getUniqueManufacturers = (): string[] => {
    const manufacturers = new Set<string>();
    parts.forEach((part: Part) => {
      if (part.manufacturer?.manufacturer) {
        manufacturers.add(part.manufacturer.manufacturer);
      }
      if (part.manufacturer?.make) {
        manufacturers.add(part.manufacturer.make);
      }
    });
    return Array.from(manufacturers);
  };

  const isInCart = (partId: string): boolean => {
    return cartItems.some((item: CartItem) => item.id === partId);
  };

  const getCartQuantity = (partId: string): number => {
    const item = cartItems.find((item: CartItem) => item.id === partId);
    return item ? item.quantity : 0;
  };

  if (loading) {
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
      {/* Header Section */}
      <div style={{
        backgroundColor: 'white',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '32px 16px',
          textAlign: 'center'
        }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            color: '#111827',
            marginBottom: '12px'
          }}>
            OEM Parts Search
          </h1>
          <p style={{
            fontSize: '1.125rem',
            color: '#6b7280',
            maxWidth: '512px',
            margin: '0 auto'
          }}>
            Find the right parts for your equipment with our comprehensive inventory
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 16px' }}>
        {/* Search and Filters Section */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e5e7eb',
          padding: '32px',
          marginBottom: '32px'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: window.innerWidth >= 1024 ? 'row' : 'column',
            gap: '24px'
          }}>
            {/* Search Input */}
            <div style={{ flex: 1, position: 'relative' }}>
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
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  fontSize: '16px',
                  color: '#111827',
                  backgroundColor: 'white',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={(e) => {
                  e.target.style.borderColor = '#3b82f6';
                  e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Category Filter */}
            <div style={{ minWidth: '224px' }}>
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
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Categories</option>
                {getUniqueCategories().map((category: string) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            {/* Manufacturer Filter */}
            <div style={{ minWidth: '224px' }}>
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
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Manufacturers</option>
                {getUniqueManufacturers().map((manufacturer: string) => (
                  <option key={manufacturer} value={manufacturer}>{manufacturer}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: '1.125rem', fontWeight: '500', color: '#374151' }}>
              Showing <span style={{ color: '#2563eb', fontWeight: 'bold' }}>{filteredParts.length}</span> of <span style={{ color: '#2563eb', fontWeight: 'bold' }}>{parts.length}</span> parts
            </p>
            {filteredParts.length > 0 && searchTerm && (
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                Results for "{searchTerm}"
              </div>
            )}
          </div>
        </div>

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

            return (
              <div 
                key={part.id} 
                style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
                }}
              >
                {/* Part Image */}
                <div style={{
                  position: 'relative',
                  background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
                  aspectRatio: '1',
                  overflow: 'hidden'
                }}>
                  <img
                    src={part.image_url || placeholderImageUrl}
                    alt={part.part_description}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transition: 'transform 0.3s ease'
                    }}
                    onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                      const target = e.target as HTMLImageElement;
                      target.src = placeholderImageUrl;
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  />
                  
                  {/* Stock Status Badge */}
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px'
                  }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      backgroundColor: part.in_stock ? '#10b981' : '#ef4444',
                      color: 'white',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
                    }}>
                      {part.in_stock ? '✓ In Stock' : '✗ Out of Stock'}
                    </span>
                  </div>
                </div>

                {/* Part Details */}
                <div style={{ padding: '24px' }}>
                  {/* Part Number */}
                  <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: 'bold',
                    color: '#111827',
                    marginBottom: '8px',
                    lineHeight: '1.3'
                  }}>
                    {part.part_number}
                  </h3>

                  {/* Description */}
                  <p style={{
                    color: '#6b7280',
                    fontSize: '0.875rem',
                    marginBottom: '16px',
                    lineHeight: '1.4',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {part.part_description}
                  </p>

                  {/* Details */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '500', color: '#374151', width: '80px' }}>Brand:</span>
                      <span style={{ color: '#6b7280' }}>{part.manufacturer?.manufacturer || 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '500', color: '#374151', width: '80px' }}>Make:</span>
                      <span style={{ color: '#6b7280' }}>{part.manufacturer?.make || 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '500', color: '#374151', width: '80px' }}>Category:</span>
                      <span style={{ color: '#6b7280' }}>{part.category}</span>
                    </div>
                    {part.make_part_number && (
                      <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '500', color: '#374151', width: '80px' }}>Make P/N:</span>
                        <span style={{ color: '#6b7280' }}>{part.make_part_number}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'flex-start', fontSize: '0.875rem' }}>
                      <span style={{ fontWeight: '500', color: '#374151', width: '80px', flexShrink: 0 }}>Models:</span>
                      <span style={{ color: '#6b7280', fontSize: '0.75rem', lineHeight: '1.5' }}>
                        {compatibleModels.join(', ') || 'Universal'}
                      </span>
                    </div>
                  </div>

                  {/* Pricing */}
                  <div style={{ marginBottom: '24px' }}>
                    {userDiscount > 0 ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>
                            ${calculateDiscountedPrice(part.list_price)}
                          </span>
                          <span style={{ fontSize: '1.125rem', color: '#6b7280', textDecoration: 'line-through' }}>
                            ${priceValue}
                          </span>
                        </div>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px 8px',
                          backgroundColor: '#dcfce7',
                          color: '#166534',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          borderRadius: '12px'
                        }}>
                          {userDiscount}% discount applied
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>
                        ${priceValue}
                      </span>
                    )}
                  </div>

                  {/* Add to Cart Button */}
                  <button
                    onClick={() => onAddToCart(part)}
                    disabled={!part.in_stock}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '12px 24px',
                      borderRadius: '12px',
                      fontWeight: '600',
                      fontSize: '0.875rem',
                      border: 'none',
                      cursor: part.in_stock ? 'pointer' : 'not-allowed',
                      transition: 'all 0.2s ease',
                      background: part.in_stock 
                        ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                        : '#d1d5db',
                      color: part.in_stock ? 'white' : '#6b7280',
                      boxShadow: part.in_stock ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (part.in_stock) {
                        e.currentTarget.style.background = 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)';
                        e.currentTarget.style.transform = 'scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (part.in_stock) {
                        e.currentTarget.style.background = 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)';
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                      }
                    }}
                  >
                    {isInCart(part.id) ? (
                      <>
                        <ShoppingCart style={{ width: '20px', height: '20px' }} />
                        In Cart ({getCartQuantity(part.id)})
                      </>
                    ) : (
                      <>
                        <Plus style={{ width: '20px', height: '20px' }} />
                        Add to Quote
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* No Results State */}
        {filteredParts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e5e7eb',
              padding: '48px',
              maxWidth: '384px',
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
                Try adjusting your search criteria or filters to find what you're looking for
              </p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                  setSelectedManufacturer('all');
                }}
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
                Clear All Filters
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PartsSearch;