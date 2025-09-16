// src/features/parts/ProductListingPage.tsx - Complete URL-based version
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchPartsWithFacets } from 'services/searchService';
import { listCategories, listManufacturers } from 'services/partsService';
import { useCart } from 'context/CartContext';
import { useAuth, type UserProfile } from 'context/AuthContext';
import { PartsList } from 'components/search/PartsList';
import { NoResults } from 'components/search/NoResults';
import { X } from 'lucide-react';

interface ProductListingPageProps {
  onNav?: (page: string) => void;
}

interface SearchResponse {
  data: any[];
  facets: Array<{
    id: string;
    name: string;
    count: number;
  }>;
  count: number;
}

export const ProductListingPage: React.FC<ProductListingPageProps> = ({ onNav }) => {
  // Context
  const { add, updateQty, items } = useCart();
  const { profile } = useAuth();

  // Search state
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [manufacturerId, setManufacturerId] = useState('all');
  const [hasSearched, setHasSearched] = useState(false);
  
  // Sidebar filter state
  const [sidebarFilter, setSidebarFilter] = useState('');

  // UI state
  const [sort, setSort] = useState<'relevance' | 'price_asc' | 'price_desc' | 'in_stock'>('relevance');
  const [pageSize, setPageSize] = useState(24);
  const [currentPage, setCurrentPage] = useState(1);
  const [isMounted, setIsMounted] = useState(false);
  
  // Load categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: listCategories,
    staleTime: 30 * 60 * 1000,
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Read search parameters from URL on component mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlQuery = params.get('q') || '';
    const urlCategory = params.get('category') || 'all';
    const urlManufacturerId = params.get('manufacturerId') || 'all';
    
    console.log('🔍 ProductListingPage: Reading URL params:', { 
      query: urlQuery, 
      category: urlCategory, 
      manufacturerId: urlManufacturerId 
    });
    
    if (urlQuery) {
      setQuery(urlQuery);
      setCategory(urlCategory);
      setManufacturerId(urlManufacturerId);
      setHasSearched(true);
    }
  }, []); // Run once on mount

  // Listen for URL changes (browser back/forward)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const urlQuery = params.get('q') || '';
      const urlCategory = params.get('category') || 'all';
      const urlManufacturerId = params.get('manufacturerId') || 'all';
      
      console.log('🔍 ProductListingPage: Browser navigation detected:', { 
        query: urlQuery, 
        category: urlCategory, 
        manufacturerId: urlManufacturerId 
      });
      
      setQuery(urlQuery);
      setCategory(urlCategory);
      setManufacturerId(urlManufacturerId);
      setHasSearched(!!urlQuery);
      setCurrentPage(1);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Search query with facets - with proper error handling
  const { 
    data: searchResponse = { data: [], facets: [], count: 0 }, 
    isLoading, 
    error,
    refetch
  } = useQuery({
    queryKey: ['searchWithFacets', query.trim(), category, manufacturerId],
    queryFn: async (): Promise<SearchResponse> => {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) return { data: [], facets: [], count: 0 };
      
      try {
        const result = await searchPartsWithFacets(
          trimmedQuery,
          category === 'all' ? undefined : category,
          manufacturerId === 'all' ? undefined : manufacturerId
        );
        
        // Ensure we always return properly structured data
        return {
          data: Array.isArray(result.data) ? result.data : [],
          facets: Array.isArray(result.facets) ? result.facets : [],
          count: result.count || 0
        };
      } catch (err) {
        console.error('Search error:', err);
        return { data: [], facets: [], count: 0 };
      }
    },
    enabled: hasSearched && query.trim().length > 0,
    staleTime: 2 * 60 * 1000,
    retry: false
  });

  // Update URL when filters change (for bookmarkable filtered results)
  const updateUrlWithFilters = useCallback((newCategory: string, newManufacturerId: string) => {
    if (!hasSearched || !query) return;

    const params = new URLSearchParams();
    params.set('q', query);
    if (newCategory !== 'all') params.set('category', newCategory);
    if (newManufacturerId !== 'all') params.set('manufacturerId', newManufacturerId);
    
    const newUrl = `/search?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, [query, hasSearched]);

  // Handle manufacturer selection from sidebar
  const handleManufacturerSelect = useCallback((manufacturerIdSelected: string | null) => {
    const newManufacturerId = manufacturerIdSelected || 'all';
    setManufacturerId(newManufacturerId);
    setCurrentPage(1);
    updateUrlWithFilters(category, newManufacturerId);
  }, [category, updateUrlWithFilters]);

  // Handle category changes
  const handleCategoryChange = useCallback((newCategory: string) => {
    setCategory(newCategory);
    setCurrentPage(1);
    updateUrlWithFilters(newCategory, manufacturerId);
    if (hasSearched) refetch();
  }, [manufacturerId, updateUrlWithFilters, hasSearched, refetch]);

  // Reset to homepage
  const resetToHomepage = useCallback(() => {
    setQuery('');
    setCategory('all');
    setManufacturerId('all');
    setHasSearched(false);
    setCurrentPage(1);
    setSidebarFilter('');
    
    // Clear URL parameters and navigate to home
    window.history.pushState(null, '', '/');
    onNav?.('home');
  }, [onNav]);

  // Filter and sort results
  const filteredAndSortedResults = useMemo(() => {
    if (!searchResponse?.data) return [];
    
    let filtered = [...searchResponse.data];
    
    // Apply sidebar filter
    if (sidebarFilter.trim()) {
      const filterTerm = sidebarFilter.toLowerCase().trim();
      filtered = filtered.filter(part => 
        part.part_number?.toLowerCase().includes(filterTerm) ||
        part.part_description?.toLowerCase().includes(filterTerm)
      );
    }
    
    // Apply sorting
    switch (sort) {
      case 'price_asc':
        return filtered.sort((a, b) => {
          const priceA = parseFloat(String(a.list_price || '0'));
          const priceB = parseFloat(String(b.list_price || '0'));
          return priceA - priceB;
        });
      case 'price_desc':
        return filtered.sort((a, b) => {
          const priceA = parseFloat(String(a.list_price || '0'));
          const priceB = parseFloat(String(b.list_price || '0'));
          return priceB - priceA;
        });
      case 'in_stock':
        return filtered.sort((a, b) => Number(b.in_stock) - Number(a.in_stock));
      default:
        return filtered;
    }
  }, [searchResponse.data, sidebarFilter, sort]);

  // Pagination - updated to use filtered results
  const totalResults = filteredAndSortedResults.length;
  const totalPages = Math.ceil(totalResults / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentResults = filteredAndSortedResults.slice(startIndex, endIndex);

  // Active filter chips
  const activeFilters = useMemo(() => {
    const filters: Array<{ label: string; clear: () => void }> = [];
    
    if (category !== 'all') {
      filters.push({
        label: category,
        clear: () => handleCategoryChange('all')
      });
    }
    
    if (manufacturerId !== 'all') {
      const manufacturer = (searchResponse?.facets || []).find(f => f.id === manufacturerId);
      if (manufacturer) {
        filters.push({
          label: manufacturer.name,
          clear: () => handleManufacturerSelect(null)
        });
      }
    }

    if (sidebarFilter.trim()) {
      filters.push({
        label: `Filter: "${sidebarFilter}"`,
        clear: () => setSidebarFilter('')
      });
    }
    
    return filters;
  }, [category, manufacturerId, sidebarFilter, searchResponse?.facets, handleCategoryChange, handleManufacturerSelect]);

  // Cart quantity helper
  const getCartQuantity = useCallback((partId: string) => {
    return items.find(item => item.id === partId)?.quantity || 0;
  }, [items]);

  // Handle rate limiting error
  const isRateLimited = error?.message === 'RATE_LIMITED';

  // Render homepage content if not searched
  if (!hasSearched) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Hero Banner */}
        <div className="mb-8 relative">
          <img
            src="https://xarnvryaicseavgnmtjn.supabase.co/storage/v1/object/public/assets/Hero_Banner_ServiceTechs_Join_The_Team.png"
            alt="Service Technicians - Join The Team"
            className="w-full h-auto rounded-2xl shadow-lg"
          />
          <button
            onClick={() => onNav?.('contact')}
            className="absolute bg-transparent hover:bg-white/10 transition-colors duration-200 rounded-lg"
            style={{
              left: '5.5%',
              top: '47.5%',
              width: '19%',
              height: '17%'
            }}
            aria-label="Register Now"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Main content area */}
      <div className="w-full overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">
          {/* Search Results Header */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="text-sm text-gray-500">
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                  Searching...
                </span>
              ) : isRateLimited ? (
                <span className="text-red-600">Search rate limited - please slow down</span>
              ) : error ? (
                <span className="text-red-600">Search failed - please try again</span>
              ) : (
                <>
                  Showing <span className="font-semibold text-gray-900">{totalResults.toLocaleString()}</span> results for
                </>
              )}
            </div>
            
            {!isLoading && !error && (
              <div className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 text-sm font-semibold">
                &quot;{query}&quot;
              </div>
            )}
          </div>

          {/* Active Filters */}
          {activeFilters.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-500">Active filters:</span>
              {activeFilters.map((filter, index) => (
                <button
                  key={index}
                  onClick={filter.clear}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition-colors"
                >
                  {filter.label}
                  <X size={14} />
                </button>
              ))}
            </div>
          )}

          {/* Sort and Page Size Controls */}
          {totalResults > 0 && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Sort by:</label>
                  <select 
                    value={sort} 
                    onChange={(e) => setSort(e.target.value as typeof sort)}
                    className="px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="relevance">Relevance</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                    <option value="in_stock">In Stock First</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Show:</label>
                  <select 
                    value={pageSize} 
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value={12}>12 per page</option>
                    <option value={24}>24 per page</option>
                    <option value={48}>48 per page</option>
                    <option value={96}>96 per page</option>
                  </select>
                </div>
              </div>

              {/* Sidebar Filter */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Filter results:</label>
                <input
                  type="text"
                  value={sidebarFilter}
                  onChange={(e) => setSidebarFilter(e.target.value)}
                  placeholder="Search within results..."
                  className="px-3 py-2 border rounded-lg text-sm w-48"
                />
                {sidebarFilter && (
                  <button
                    onClick={() => setSidebarFilter('')}
                    className="p-2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Results */}
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-600 mb-4">Search failed. Please try again.</div>
              <button 
                onClick={() => refetch()} 
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Retry Search
              </button>
            </div>
          ) : totalResults === 0 ? (
            <NoResults onReset={resetToHomepage} />
          ) : (
            <>
              {/* Parts List */}
              {!isMounted ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
                </div>
              ) : (
                <PartsList
                  parts={currentResults}
                  loading={false}
                  discountPct={(profile as UserProfile | null)?.discount_percentage || 0}
                  onAdd={add}
                  onUpdateQty={updateQty}
                  getQty={getCartQuantity}
                  onView={(part) => {
                    window.dispatchEvent(new CustomEvent('pp:viewPart', { detail: { id: part.id } }));
                  }}
                />
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-8 flex justify-center items-center gap-2">
                  <button
                    onClick={() => {
                      setCurrentPage(prev => Math.max(1, prev - 1));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  
                  <span className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  
                  <button
                    onClick={() => {
                      setCurrentPage(prev => Math.min(totalPages, prev + 1));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};