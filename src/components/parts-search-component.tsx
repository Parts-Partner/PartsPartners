import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Plus, Minus, ShoppingCart, ChevronDown, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

// TypeScript interfaces
interface Manufacturer {
  id: string;
  make: string;
  manufacturer: string;
}

interface Part {
  id: string;
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
  manufacturer?: Manufacturer;
  search_rank?: number;
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

interface SuggestionItem {
  type: 'part' | 'manufacturer';
  value: string;
  description: string;
  score: number;
}

const PartsSearch: React.FC<PartsSearchProps> = ({ onAddToCart, cartItems = [], onUpdateQuantity }) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');
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
  
  // Auto-suggest state
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number>(-1);
  const [suggestionLoading, setSuggestionLoading] = useState<boolean>(false);
  
  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Use local placeholder image
  const placeholderImageUrl = '/No_Product_Image_Filler.png';

  // Debounce search term for auto-search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 400); // 400ms debounce for auto-search

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Debounce search term for suggestions (faster)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.length >= 0 && !searchPerformed) {
        fetchSuggestions(searchTerm);
      }
    }, 200); // 200ms debounce for suggestions

    return () => clearTimeout(timer);
  }, [searchTerm, searchPerformed]);

  // Auto-search when debounced term changes
  useEffect(() => {
    if (debouncedSearchTerm.trim() && debouncedSearchTerm.length >= 5) {
      performAdvancedSearch(debouncedSearchTerm, selectedCategory, selectedManufacturer);
    }
  }, [debouncedSearchTerm, selectedCategory, selectedManufacturer]);

  // Fetch suggestions
  const fetchSuggestions = async (query: string) => {
    try {
      setSuggestionLoading(true);
      const suggestions: SuggestionItem[] = [];

      // Fetch part number suggestions
      const { data: partSuggestions, error: partError } = await supabase.rpc('suggest_part_numbers', {
        search_prefix: query,
        limit_count: 5
      });

      if (!partError && partSuggestions) {
        partSuggestions.forEach((item: any) => {
          suggestions.push({
            type: 'part',
            value: item.part_number,
            description: item.part_description,
            score: item.similarity_score
          });
        });
      }

      // Fetch manufacturer suggestions
      const { data: mfgSuggestions, error: mfgError } = await supabase.rpc('suggest_manufacturers', {
        search_prefix: query,
        limit_count: 3
      });

      if (!mfgError && mfgSuggestions) {
        mfgSuggestions.forEach((item: any) => {
          suggestions.push({
            type: 'manufacturer',
            value: `${item.manufacturer_name} ${item.make}`.trim(),
            description: `${item.parts_count} parts available`,
            score: item.similarity_score
          });
        });
      }

      // Sort by score and show top results
      suggestions.sort((a, b) => b.score - a.score);
      setSuggestions(suggestions.slice(0, 8));
      setShowSuggestions(suggestions.length > 0);

    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setSuggestionLoading(false);
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: SuggestionItem) => {
    setSearchTerm(suggestion.value);
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedSuggestionIndex(-1);
    performAdvancedSearch(suggestion.value, selectedCategory, selectedManufacturer);
  };

  // Handle keyboard navigation in suggestions
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) {
      if (e.key === 'Enter') {
        handleSearch();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestionIndex >= 0) {
          handleSuggestionSelect(suggestions[selectedSuggestionIndex]);
        } else {
          handleSearch();
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node) &&
          searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch manufacturers from Supabase
  const fetchManufacturers = async (): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('manufacturers')
        .select('*')
        .order('manufacturer');

      if (error) {
        console.error('Supabase error details:', error);
        return;
      }

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
    } catch (error) {
      console.error('Error fetching parts count:', error);
    }
  };

  // Advanced search function with multi-term AND logic
  const performAdvancedSearch = useCallback(async (
    searchQuery: string,
    category: string = 'all',
    manufacturerId: string = 'all'
  ): Promise<void> => {
    try {
      setLoading(true);
      setSearchPerformed(true);
      setShowSuggestions(false);

      let results: Part[] = [];

      if (searchQuery.trim()) {
        // Use the enhanced search function
        const { data, error } = await supabase.rpc('search_parts_with_manufacturers', {
          search_query: searchQuery.trim(),
          category_filter: category,
          manufacturer_filter: manufacturerId === 'all' ? null : manufacturerId
        });

        // Transform the results to match our Part interface
        results = (data || []).map((item: any) => ({
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
          search_rank: item.search_rank,
          manufacturer: {
            id: item.manufacturer_id,
            manufacturer: item.manufacturer_name || '',
            make: item.make || ''
          }
        }));

        console.log(`Advanced search results: ${results.length} parts found for "${searchQuery}"`);
      } else {
        // If no search query, load recent parts
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
          .limit(50)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error loading recent parts:', error);
          return;
        }

        results = (data || []).map((item: any) => ({
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
      }

      setParts(results);
      setFilteredParts(results);

    } catch (error) {
      console.error('Network error during search:', error);
      await performFallbackSearch(searchQuery, category, manufacturerId);
    } finally {
      setLoading(false);
    }
  }, []);

  // Manual search button handler
  const handleSearch = () => {
    if (!searchTerm.trim() && selectedCategory === 'all' && selectedManufacturer === 'all') {
      setParts([]);
      setFilteredParts([]);
      setSearchPerformed(false);
      return;
    }
    performAdvancedSearch(searchTerm, selectedCategory, selectedManufacturer);
  };

  // Add this new function after performAdvancedSearch
  const performManufacturerSearch = useCallback(async (manufacturerId: string, category: string = 'all'): Promise<void> => {
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
        .eq('manufacturer_id', manufacturerId)
        .limit(200)
        .order('part_number');

      if (category !== 'all') {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Manufacturer search error:', error);
        return;
      }

      const results = (data || []).map((item: any) => ({
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

      console.log(`Manufacturer search results: ${results.length} parts found`);
      setParts(results);
      setFilteredParts(results);

    } catch (error) {
      console.error('Manufacturer search failed:', error);
    } finally {
      setLoading(false);
    }
  }, []);

    // Fallback search using basic ilike if advanced search fails
  const performFallbackSearch = async (
    searchQuery: string,
    category: string = 'all',
    manufacturerId: string = 'all'
  ): Promise<void> => {
    try {
      console.log('Using fallback search method...');
      
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
        .limit(200)
        .order('part_number');

      if (searchQuery.trim()) {
        const searchLower = searchQuery.toLowerCase().trim();
        query = query.or(`
          part_number.ilike.%${searchLower}%,
          part_description.ilike.%${searchLower}%,
          make_part_number.ilike.%${searchLower}%
        `);
      }

      if (category !== 'all') {
        query = query.eq('category', category);
      }

      if (manufacturerId !== 'all') {
        query = query.eq('manufacturer_id', manufacturerId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Fallback search error:', error);
        alert('Search failed. Please try again with different terms.');
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

      console.log(`Fallback search results: ${typedParts.length} parts found`);
      setParts(typedParts);
      setFilteredParts(typedParts);

    } catch (error) {
      console.error('Fallback search failed:', error);
      alert('Search is currently unavailable. Please try again later.');
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

  // Handle manufacturer dropdown changes
  useEffect(() => {
    if (selectedManufacturer !== 'all' && !searchTerm.trim()) {
      // Only do manufacturer-only search if there's no search term
      performManufacturerSearch(selectedManufacturer, selectedCategory);
    }
  }, [selectedManufacturer]);

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
    e.stopPropagation();
    const currentQuantity = getCartQuantity(partId);
    if (currentQuantity > 0 && onUpdateQuantity) {
      onUpdateQuantity(partId, currentQuantity - 1);
    }
  };

  const handleQuantityIncrease = (e: React.MouseEvent, part: Part) => {
    e.stopPropagation();
    const currentQuantity = getCartQuantity(part.id);
    if (currentQuantity === 0) {
      onAddToCart(part);
    } else if (onUpdateQuantity) {
      onUpdateQuantity(part.id, currentQuantity + 1);
    }
  };

  const handleAddToCartClick = (e: React.MouseEvent, part: Part) => {
    e.stopPropagation();
    onAddToCart(part);
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedManufacturer('all');
    setParts([]);
    setFilteredParts([]);
    setSearchPerformed(false);
    setSuggestions([]);
    setShowSuggestions(false);
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
            {/* Search Input with Auto-Suggest */}
            <div style={{ flex: 1, position: 'relative', display: 'flex', gap: '8px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9ca3af',
                  width: '20px',
                  height: '20px',
                  zIndex: 2
                }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search parts, manufacturers, models... (try: vulcan igniter, AT0A-2779)"
                  style={{
                    width: '100%',
                    paddingLeft: '48px',
                    paddingRight: searchTerm ? '40px' : '16px',
                    paddingTop: '12px',
                    paddingBottom: '12px',
                    border: '5px solid #d63838ff',
                    borderRadius: showSuggestions ? '12px 12px 0 0' : '12px',
                    fontSize: '16px',
                    color: '#111827',
                    backgroundColor: 'white',
                    outline: 'none',
                    transition: 'all 0.2s',
                    position: 'relative',
                    zIndex: 1
                  }}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  onFocus={() => {
                    if (suggestions.length > 0) {
                      setShowSuggestions(true);
                    }
                  }}
                />
                
                {/* Clear search button */}
                {searchTerm && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setSuggestions([]);
                      setShowSuggestions(false);
                      if (searchPerformed) {
                        clearAllFilters();
                      }
                    }}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      padding: '4px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#9ca3af',
                      zIndex: 2
                    }}
                  >
                    <X size={16} />
                  </button>
                )}

                {/* Auto-suggest dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: '0',
                      right: '0',
                      backgroundColor: 'white',
                      border: '2px solid #d63838ff',
                      borderTop: 'none',
                      borderRadius: '0 0 12px 12px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      maxHeight: '300px',
                      overflowY: 'auto',
                      zIndex: 1000
                    }}
                  >
                    {suggestions.map((suggestion, index) => (
                      <div
                        key={`${suggestion.type}-${suggestion.value}-${index}`}
                        style={{
                          padding: '12px 16px',
                          borderBottom: index < suggestions.length - 1 ? '1px solid #f3f4f6' : 'none',
                          cursor: 'pointer',
                          backgroundColor: index === selectedSuggestionIndex ? '#f3f4f6' : 'white',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={() => setSelectedSuggestionIndex(index)}
                        onMouseLeave={() => setSelectedSuggestionIndex(-1)}
                        onClick={() => handleSuggestionSelect(suggestion)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            padding: '4px',
                            borderRadius: '4px',
                            backgroundColor: suggestion.type === 'part' ? '#eff6ff' : '#f0fdf4',
                            color: suggestion.type === 'part' ? '#2563eb' : '#059669',
                            fontSize: '0.75rem',
                            fontWeight: '500'
                          }}>
                            {suggestion.type === 'part' ? 'PART' : 'MFG'}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '500', color: '#111827', fontSize: '0.875rem' }}>
                              {suggestion.value}
                            </div>
                            <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                              {suggestion.description}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {suggestionLoading && (
                      <div style={{
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#6b7280',
                        fontSize: '0.875rem'
                      }}>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        Loading suggestions...
                      </div>
                    )}
                  </div>
                )}
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
                <div>
                  <p style={{ fontSize: '1.125rem', fontWeight: '500', color: '#374151' }}>
                    Found <span style={{ color: '#2563eb', fontWeight: 'bold' }}>{filteredParts.length}</span> parts
                  </p>
                  {filteredParts.length > 0 && searchTerm && (
                    <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '4px' }}>
                      Smart search: Multi-term AND matching with fuzzy logic
                    </p>
                  )}
                </div>
              ) : (
                <p>
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

        {/* Parts Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(300px, 1fr))`,
          gap: '32px'
        }}>
          {filteredParts.map((part: Part, index: number) => {
            const compatibleModels = Array.isArray(part.compatible_models) 
              ? part.compatible_models 
              : typeof part.compatible_models === 'string' 
                ? [part.compatible_models] 
                : [];

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
                {/* Relevance badge for search results */}
                {searchPerformed && part.search_rank && part.search_rank > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    zIndex: 2
                  }}>
                    #{index + 1}
                  </div>
                )}

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

                {/* Add to Cart Section */}
                <div style={{
                  padding: '0 16px 16px',
                  borderTop: '1px solid #f1f5f9'
                }}>
                  {currentQuantity > 0 ? (
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
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
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
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
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
                        color: part.in_stock ? 'white' : '#6b7280'
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
    
    {/* No Search Performed State - Three Feature Blocks */}
    {!searchPerformed && !loading && (
      <>
        {/* Three Feature Blocks */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '32px',
          marginBottom: '48px'
        }}>
          {/* Left Block - Become a Partner */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e5e7eb',
            padding: '32px',
            textAlign: 'center',
            transition: 'all 0.3s ease',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.1)';
          }}
          >
            <div style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              boxShadow: '0 8px 16px rgba(220, 38, 38, 0.3)'
            }}>
              <svg style={{ width: '40px', height: '40px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            
            <h3 style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              color: '#111827',
              marginBottom: '16px'
            }}>
              Become a Partner!
            </h3>
            
            <p style={{
              color: '#6b7280',
              lineHeight: '1.6',
              marginBottom: '32px',
              fontSize: '1rem',
              flex: 1
            }}>
              Service technicians are the backbone of our industry and the foundation of everything we do! 
              Join our growing community of professionals and unlock exclusive discounts, priority support, 
              and special perks designed just for the experts who keep the world running.
            </p>
            
            <button
              onClick={() => {
                // This should connect to your existing registration modal
                // You'll need to pass this function down as a prop or use your existing modal trigger
                console.log('Register clicked - connect to registration modal');
              }}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                color: 'white',
                padding: '16px 24px',
                borderRadius: '12px',
                border: 'none',
                fontSize: '1.1rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(220, 38, 38, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.3)';
              }}
            >
              <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Register Now
            </button>
          </div>

          {/* Middle Block - Find a Technician */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e5e7eb',
            padding: '32px',
            textAlign: 'center',
            transition: 'all 0.3s ease',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.1)';
          }}
          >
            <div style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              boxShadow: '0 8px 16px rgba(220, 38, 38, 0.3)'
            }}>
              <svg style={{ width: '40px', height: '40px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            
            <h3 style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              color: '#111827',
              marginBottom: '16px'
            }}>
              Find a Technician!
            </h3>
            
            <p style={{
              color: '#6b7280',
              lineHeight: '1.6',
              marginBottom: '32px',
              fontSize: '1rem',
              flex: 1
            }}>
              Connect with our rapidly expanding network of qualified service professionals! 
              Our tech community spans nationwide and continues growing daily. Finding the right 
              expert for your needs has never been easier or more reliable.
            </p>
            
            <button
              onClick={() => {
                // This should connect to your existing tech finder modal
                // You'll need to pass this function down as a prop or use your existing modal trigger
                console.log('Find Tech clicked - connect to tech finder modal');
              }}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                color: 'white',
                padding: '16px 24px',
                borderRadius: '12px',
                border: 'none',
                fontSize: '1.1rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(220, 38, 38, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.3)';
              }}
            >
              <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Find Tech
            </button>
          </div>

          {/* Right Block - Bulk Order */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e5e7eb',
            padding: '32px',
            textAlign: 'center',
            transition: 'all 0.3s ease',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.1)';
          }}
          >
            <div style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              boxShadow: '0 8px 16px rgba(220, 38, 38, 0.3)'
            }}>
              <svg style={{ width: '40px', height: '40px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            
            <h3 style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              color: '#111827',
              marginBottom: '16px'
            }}>
              Bulk Order
            </h3>
            
            <p style={{
              color: '#6b7280',
              lineHeight: '1.6',
              marginBottom: '32px',
              fontSize: '1rem',
              flex: 1
            }}>
              Need to order multiple parts quickly? Simply paste your part numbers and quantities, 
              and we'll handle the rest! Our bulk ordering system streamlines large purchases, 
              saving you time and ensuring accuracy for big jobs.
            </p>
            
            <button
              onClick={() => {
                // This should connect to your existing bulk order modal
                // You'll need to pass this function down as a prop or use your existing modal trigger
                console.log('Bulk Order clicked - connect to bulk order modal');
              }}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                color: 'white',
                padding: '16px 24px',
                borderRadius: '12px',
                border: 'none',
                fontSize: '1.1rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(220, 38, 38, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.3)';
              }}
            >
              <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              Bulk Order
            </button>
          </div>
        </div>
      </>
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
                No parts match your search criteria. Try:
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
                <li>• Checking spelling (fuzzy matching is enabled)</li>
                <li>• Using fewer keywords</li>
                <li>• Removing filters</li>
                <li>• Trying manufacturer names</li>
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
              >
                Clear Search & Filters
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Product Detail Modal */}
      {selectedPart && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedPart(null)}
        >
          <div 
            className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
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

                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Compatible Models:</h4>
                    <p className="text-gray-900 text-sm">
                      {Array.isArray(selectedPart.compatible_models) 
                        ? selectedPart.compatible_models.join(', ')
                        : selectedPart.compatible_models || 'Universal'}
                    </p>
                  </div>

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