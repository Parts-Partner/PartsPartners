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

      </div>
    );
  }

  return (
    <div className="min-h-screen"> {/* Changed from flex h-screen */}
      <div className="max-w-6xl mx-auto px-6 py-6"> {/* Removed nested div structure */}
        {/* All your existing content goes here - search header, filters, results, etc. */}
        
        {/* Search Results Header */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {/* ... existing header content ... */}
        </div>

        {/* Active Filters */}
        {activeFilters.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {/* ... existing filters ... */}
          </div>
        )}

        {/* Sort and Page Size Controls */}
        {totalResults > 0 && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            {/* ... existing controls ... */}
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex justify-center items-center gap-2">
                {/* ... existing pagination ... */}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};