// src/features/parts/ProductListingPage.tsx - Full sidebar version
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchPartsWithFacets } from 'services/searchService';
import { listCategories, listManufacturers } from 'services/partsService';
import { useCart } from 'context/CartContext';
import { useAuth, type UserProfile } from 'context/AuthContext';
import { PartsList } from 'components/search/PartsList';
import { NoResults } from 'components/search/NoResults';
import HomePromos from 'components/home/HomePromos';
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
  
  // Load categories (still needed for other parts of the app)
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: listCategories,
    staleTime: 30 * 60 * 1000,
  });

    useEffect(() => {
    setIsMounted(true);
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

  // Handle search from external sources (Header, HomeMinimal)
  const handleExternalSearch = useCallback((payload: any) => {
    const searchQuery = payload.q?.trim() || '';
    const searchCategory = payload.category || 'all';
    const searchManufacturer = payload.manufacturerId || 'all';

    if (searchQuery) {
      setQuery(searchQuery);
      setCategory(searchCategory);
      setManufacturerId(searchManufacturer);
      setHasSearched(true);
      setCurrentPage(1);
      setSidebarFilter(''); // Clear sidebar filter on new search
    }
  }, []);

  // Listen for external search events
  useEffect(() => {
    const handleSearchEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        handleExternalSearch(detail);
      }
    };

    window.addEventListener('pp:search' as any, handleSearchEvent);
    window.addEventListener('pp:do-search' as any, handleSearchEvent);

    return () => {
      window.removeEventListener('pp:search' as any, handleSearchEvent);
      window.removeEventListener('pp:do-search' as any, handleSearchEvent);
    };
  }, [handleExternalSearch]);

  // Reset to homepage
  const resetToHomepage = useCallback(() => {
    setQuery('');
    setCategory('all');
    setManufacturerId('all');
    setHasSearched(false);
    setCurrentPage(1);
    setSidebarFilter('');
  }, []);

  // Listen for homepage reset
  useEffect(() => {
    const handleReset = () => resetToHomepage();
    window.addEventListener('pp:goHome' as any, handleReset);
    return () => window.removeEventListener('pp:goHome' as any, handleReset);
  }, [resetToHomepage]);

  // Handle manufacturer selection from sidebar
  const handleManufacturerSelect = useCallback((manufacturerIdSelected: string | null) => {
    setManufacturerId(manufacturerIdSelected || 'all');
    setCurrentPage(1);
  }, []);

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

  // Active filter chips - adapted for sidebar
  const activeFilters = useMemo(() => {
    const filters: Array<{ label: string; clear: () => void }> = [];
    
    if (category !== 'all') {
      filters.push({
        label: category,
        clear: () => {
          setCategory('all');
          if (hasSearched) refetch();
        }
      });
    }
    
    if (manufacturerId !== 'all') {
      const manufacturer = (searchResponse?.facets || []).find(f => f.id === manufacturerId);
      if (manufacturer) {
        filters.push({
          label: manufacturer.name,
          clear: () => {
            setManufacturerId('all');
            if (hasSearched) refetch();
          }
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
  }, [category, manufacturerId, sidebarFilter, searchResponse?.facets, hasSearched, refetch]);

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

        {/* Home Promos */}
        <HomePromos
          onRegister={() => onNav?.('contact')}
          onFindTech={() => window.dispatchEvent(new CustomEvent('pp:openTechFinder'))}
          onBulk={() => window.dispatchEvent(new CustomEvent('pp:showBulkOrderModal', { detail: { initialText: '' } }))}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Left Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 p-6 h-full overflow-y-auto flex-shrink-0">
        {/* Filter results input */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Filter Results</h3>
          <input
            type="text"
            value={sidebarFilter}
            onChange={(e) => {
              setSidebarFilter(e.target.value);
              setCurrentPage(1); // Reset to first page when filtering
            }}
            placeholder="Filter by part number or description..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
        </div>

        {/* Results count */}
        <div className="mb-6 text-sm text-gray-600">
          {totalResults.toLocaleString()} parts found
          {sidebarFilter.trim() && (
            <div className="text-xs text-gray-500 mt-1">
              (filtered from {searchResponse?.data?.length || 0} total)
            </div>
          )}
        </div>

        {/* Active filter chips */}
        {activeFilters.length > 0 && (
          <div className="mb-6">
            <h4 className="text-xs font-semibold text-gray-700 mb-2">Active Filters</h4>
            <div className="space-y-1">
              {activeFilters.map((filter, index) => (
                <button
                  key={index}
                  onClick={filter.clear}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-50 text-red-700 text-xs hover:bg-red-100 transition-colors mr-1 mb-1"
                >
                  {filter.label}
                  <X className="w-3 h-3" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Manufacturer filter */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Manufacturer</h3>
            {manufacturerId !== 'all' && (
              <button
                onClick={() => handleManufacturerSelect(null)}
                className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
              >
                <X size={12} />
                Clear
              </button>
            )}
          </div>
          
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {(searchResponse?.facets || []).map((facet) => (
              <button
                key={facet.id}
                onClick={() => handleManufacturerSelect(
                  manufacturerId === facet.id ? null : facet.id
                )}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  manufacturerId === facet.id
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">
                    {facet.name}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    manufacturerId === facet.id
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {facet.count}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto">
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

            {/* Sort and pagination controls */}
            <div className="ml-auto flex items-center gap-4">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as any)}
                className="px-3 py-2 border rounded-lg text-sm"
                disabled={isLoading}
              >
                <option value="relevance">Relevance</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="in_stock">In Stock First</option>
              </select>
              
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(parseInt(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value={12}>12 per page</option>
                <option value={24}>24 per page</option>
                <option value={48}>48 per page</option>
              </select>
            </div>
          </div>

          {/* Results */}
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
            </div>
          ) : error && !isRateLimited ? (
            <div className="text-center py-12">
              <div className="text-red-600 mb-4">Search failed. Please try again.</div>
              <button
                onClick={() => refetch()}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Retry Search
              </button>
            </div>
          ) : isRateLimited ? (
            <div className="text-center py-12">
              <div className="text-orange-600 mb-4">
                Search rate limited. Please wait a moment and try again.
              </div>
              <button
                onClick={resetToHomepage}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Return to Homepage
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
                <div className="mt-8 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages} 
                    <span className="ml-2">
                      ({startIndex + 1}-{Math.min(endIndex, totalResults)} of {totalResults.toLocaleString()})
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage <= 1}
                      className="px-4 py-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                      Previous
                    </button>
                    
                    {totalPages <= 7 ? (
                      Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-2 rounded-lg border transition-colors ${
                            page === currentPage 
                              ? 'bg-red-600 text-white border-red-600' 
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      ))
                    ) : (
                      <>
                        {currentPage > 3 && (
                          <>
                            <button
                              onClick={() => setCurrentPage(1)}
                              className="px-3 py-2 rounded-lg border hover:bg-gray-50"
                            >
                              1
                            </button>
                            {currentPage > 4 && <span className="px-2">...</span>}
                          </>
                        )}
                        
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                          if (page > totalPages) return null;
                          
                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`px-3 py-2 rounded-lg border transition-colors ${
                                page === currentPage 
                                  ? 'bg-red-600 text-white border-red-600' 
                                  : 'hover:bg-gray-50'
                              }`}
                            >
                              {page}
                            </button>
                          );
                        })}
                        
                        {currentPage < totalPages - 2 && (
                          <>
                            {currentPage < totalPages - 3 && <span className="px-2">...</span>}
                            <button
                              onClick={() => setCurrentPage(totalPages)}
                              className="px-3 py-2 rounded-lg border hover:bg-gray-50"
                            >
                              {totalPages}
                            </button>
                          </>
                        )}
                      </>
                    )}
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage >= totalPages}
                      className="px-4 py-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};