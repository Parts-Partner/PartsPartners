// src/features/parts/ProductListingPage.tsx - Enhanced with rate limiting
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { debounce } from 'lodash';
import {
  listCategories,
  listManufacturers,
  type Part,
} from 'services/partsService';
import { searchPartsWithCache } from 'services/cachedPartsService';
import { rateLimitUtils, RateLimitError } from 'lib/rateLimiting';
import { useCart } from 'context/CartContext';
import { useAuth, type UserProfile } from 'context/AuthContext';
import { PartsList } from 'components/search/PartsList';
import { NoResults } from 'components/search/NoResults';
import { Filters } from 'components/search/Filters';
import HomePromos from 'components/home/HomePromos';
import { X } from 'lucide-react';

// --- helpers --------------------------------------------------------------
const PAGE_SIZES = [12, 24, 48];

type SearchPayload = { q?: string; category?: string; manufacturerId?: string };

export const ProductListingPage: React.FC = () => {
  const { add, updateQty, items } = useCart();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // query + filter state (mirrors Header) ---------------------------------
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('all');
  const [manufacturerId, setManufacturerId] = useState('all');

  // UI state ---------------------------------------------------------------
  const [searched, setSearched] = useState(false);

  // Rate limiting state
  const [rateLimited, setRateLimited] = useState(false);
  const [rateLimitMessage, setRateLimitMessage] = useState('');
  const [retryAfter, setRetryAfter] = useState(0);

  // sort & pagination
  const [sort, setSort] = useState<'relevance'|'price_asc'|'price_desc'|'in_stock'>('relevance');
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [page, setPage] = useState(1);

  // Create search params for React Query - only when we have a real search
  const searchParams = useMemo(() => {
    const hasRealSearch = searched && q.trim().length > 0;
    return hasRealSearch ? {
      query: q.trim(),
      category: category === 'all' ? 'all' : category,
      manufacturerId: manufacturerId === 'all' ? 'all' : manufacturerId
    } : null;
  }, [q, category, manufacturerId, searched]);

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

  // React Query for categories - cached aggressively for performance
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: listCategories,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnMount: false, // Don't refetch on every mount
    refetchOnReconnect: false,
  });

  // React Query for manufacturers - cached aggressively for performance
  const { data: manufacturers = [] } = useQuery({
    queryKey: ['manufacturers'],
    queryFn: listManufacturers,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnMount: false, // Don't refetch on every mount
    refetchOnReconnect: false,
  });

  // React Query for search results - with rate limiting and smart caching
  const { 
    data: parts = [], 
    isLoading, 
    error,
    refetch,
    isFetching
  } = useQuery({
    queryKey: ['parts-search', searchParams],
    queryFn: async () => {
      if (!searchParams) return [];
      
      try {
        // Clear any previous rate limit state
        setRateLimited(false);
        setRateLimitMessage('');
        
        // Use the rate-limited cached search service
        const results = await searchPartsWithCache(
          searchParams.query,
          searchParams.category,
          searchParams.manufacturerId
        );
        
        return results;
        
      } catch (error) {
        // Handle rate limiting errors
        if (rateLimitUtils.isRateLimitError(error)) {
          const rateLimitError = error as RateLimitError;
          setRateLimited(true);
          setRateLimitMessage(rateLimitUtils.getRateLimitMessage('search', rateLimitError));
          setRetryAfter(rateLimitError.getRetryAfterSeconds());
          
          console.warn(`🚫 ProductListing search rate limited: ${rateLimitError.message}`);
          
          // Return empty array instead of throwing to prevent React Query error state
          return [];
        }
        
        // Re-throw other errors for React Query to handle
        throw error;
      }
    },
    enabled: !!searchParams && !rateLimited, // Don't fetch if rate limited
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: (failureCount, error) => {
      // Don't retry rate limit errors
      if (rateLimitUtils.isRateLimitError(error)) {
        return false;
      }
      return failureCount < 1; // Only retry once for other errors
    },
    retryDelay: 1000,
  });

  // Manual search function for immediate execution
  const executeSearch = useCallback((payload: SearchPayload) => {
    const nextQ = (payload.q ?? '').trim();
    const nextCat = String(payload.category ?? 'all');
    const nextMfg = String(payload.manufacturerId ?? 'all');

    console.log('🚀 Executing search:', { nextQ, nextCat, nextMfg });

    // Clear rate limit state on new search
    setRateLimited(false);
    setRateLimitMessage('');
    setRetryAfter(0);

    // Update state
    setQ(nextQ);
    setCategory(nextCat);
    setManufacturerId(nextMfg);
    setPage(1); // reset paging on every new search
    
    // Mark as searched if we have a query
    if (nextQ.length > 0) {
      setSearched(true);
    }
  }, []);

  // Debounced search for filter changes (but not initial searches)
  const debouncedFilterSearch = useMemo(
    () => debounce((payload: SearchPayload) => {
      if (searched) { // Only debounce if we're already in search mode
        executeSearch(payload);
      }
    }, 300),
    [executeSearch, searched]
  );

  // Reset to homepage state
  const resetToHomepage = useCallback(() => {
    debouncedFilterSearch.cancel();
    setQ('');
    setCategory('all');
    setManufacturerId('all');
    setSort('relevance');
    setPage(1);
    setSearched(false);
    
    // Clear rate limiting state
    setRateLimited(false);
    setRateLimitMessage('');
    setRetryAfter(0);
    
    // Clear the search cache to ensure fresh results next time
    queryClient.removeQueries({ queryKey: ['parts-search'] });
  }, [debouncedFilterSearch, queryClient]);

  // Listen for Header-dispatched searches
  useEffect(() => {
    const handler = (e: Event) => {
      const payload = (e as CustomEvent).detail || {};
      console.log('📡 Received search event:', payload);
      executeSearch(payload);
    };
    
    window.addEventListener('pp:search' as any, handler);
    window.addEventListener('pp:do-search' as any, handler);
    
    return () => {
      window.removeEventListener('pp:search' as any, handler);
      window.removeEventListener('pp:do-search' as any, handler);
    };
  }, [executeSearch]);

  // Listen for homepage reset events from header
  useEffect(() => {
    const handler = () => {
      resetToHomepage();
    };
    window.addEventListener('pp:goHome' as any, handler);
    return () => window.removeEventListener('pp:goHome' as any, handler);
  }, [resetToHomepage]);

  // in-cart qty helper
  const inCartQty = useCallback((id: string) => 
    items.find((i) => i.id === id)?.quantity || 0
  , [items]);

  // active filter chips ----------------------------------------------------
  const activeChips = useMemo(() => {
    const chips: { label: string; clear: () => void }[] = [];
    if (category !== 'all') {
      chips.push({ 
        label: category, 
        clear: () => {
          setCategory('all');
          if (searched) {
            executeSearch({ q, category: 'all', manufacturerId });
          }
        }
      });
    }
    if (manufacturerId !== 'all') {
      const m = manufacturers.find((m) => m.id === manufacturerId)?.manufacturer || 'Manufacturer';
      chips.push({ 
        label: m, 
        clear: () => {
          setManufacturerId('all');
          if (searched) {
            executeSearch({ q, category, manufacturerId: 'all' });
          }
        }
      });
    }
    return chips;
  }, [category, manufacturerId, manufacturers, searched, q, executeSearch]);

  // client-side sorting (optimized with useMemo) ----------------------------
  const sorted = useMemo(() => {
    if (!parts || parts.length === 0) return [];
    
    // Don't sort on every render if sort hasn't changed
    const base = [...parts];
    switch (sort) {
      case 'price_asc':
        return base.sort((a,b) => (num(a.list_price) - num(b.list_price)));
      case 'price_desc':
        return base.sort((a,b) => (num(b.list_price) - num(a.list_price)));
      case 'in_stock':
        return base.sort((a,b) => Number(b.in_stock) - Number(a.in_stock));
      default:
        return base; // API relevance
    }
  }, [parts, sort]);

  // pagination (optimized) -------------------------------------------------
  const total = sorted.length;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(page, lastPage);
  
  const pageSlice = useMemo(() => {
    if (sorted.length === 0) return [];
    const start = (clampedPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, clampedPage, pageSize]);

  useEffect(() => { 
    if (page > lastPage && lastPage > 0) setPage(lastPage); 
  }, [lastPage, page]);

  // utilities --------------------------------------------------------------
  function num(n: number | string | null | undefined) {
    if (typeof n === 'number') return n;
    if (!n) return 0;
    const x = parseFloat(String(n));
    return isNaN(x) ? 0 : x;
  }

  // handlers ---------------------------------------------------------------
  const applyFilters = useCallback(() => {
    executeSearch({ q, category, manufacturerId });
  }, [executeSearch, q, category, manufacturerId]);
  
  const clearAll = useCallback(() => {
    setCategory('all');
    setManufacturerId('all');
    setSort('relevance');
    setPage(1);
    if (q.trim()) {
      executeSearch({ q: q || '', category: 'all', manufacturerId: 'all' });
    }
  }, [executeSearch, q]);

  // Performance monitoring (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 PLP Performance:', {
        partsCount: parts.length,
        isLoading,
        isFetching,
        searchParams,
        searched,
        rateLimited,
        cacheHit: !isLoading && !isFetching && parts.length > 0
      });
    }
  }, [parts.length, isLoading, isFetching, searchParams, searched, rateLimited]);

  // render -----------------------------------------------------------------
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Homepage Promos - Show when not searched yet */}
      {!searched && (
        <div className="mb-12">
          <HomePromos
            onRegister={() => {
              window.dispatchEvent(new CustomEvent('pp:navigate', { detail: { page: 'contact' } }));
            }}
            onFindTech={() => {
              window.dispatchEvent(new CustomEvent('pp:openTechFinder'));
            }}
            onBulk={() => {
              window.dispatchEvent(new CustomEvent('pp:openBulkOrder'));
            }}
          />
        </div>
      )}

      {/* Rate limit notification banner */}
      {rateLimited && searched && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-red-600 text-sm font-bold">!</span>
            </div>
            <div className="flex-1">
              <div className="text-red-800 font-medium">Search Rate Limited</div>
              <div className="text-red-700 text-sm">{rateLimitMessage}</div>
            </div>
            {retryAfter > 0 && (
              <div className="text-red-600 font-mono text-sm">
                {retryAfter}s
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top meta bar (visible after a search) */}
      {searched && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="text-sm text-gray-500">
            {isLoading || isFetching ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                Searching...
              </span>
            ) : rateLimited ? (
              <span className="text-red-600">Search temporarily limited</span>
            ) : (
              <>
                Showing <span className="font-semibold text-gray-900">{total.toLocaleString()}</span> results for
              </>
            )}
          </div>
          {!isLoading && !isFetching && !rateLimited && (
            <div className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 text-sm font-semibold">
              &quot;{q || 'All'}&quot;
            </div>
          )}

          {/* active chips */}
          {activeChips.map((c, i) => (
            <button
              key={i}
              onClick={c.clear}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-xs hover:bg-gray-200 transition-colors"
              aria-label={`Clear ${c.label}`}
            >
              {c.label}
              <X className="w-3 h-3" />
            </button>
          ))}

          {/* spacer */}
          <div className="ml-auto flex items-center gap-2">
            <label className="text-sm text-gray-600">Sort</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label="Sort results"
              disabled={rateLimited}
            >
              <option value="relevance">Relevance</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="in_stock">In Stock First</option>
            </select>
            <label className="text-sm text-gray-600 ml-2">Per page</label>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(1); }}
              className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label="Results per page"
            >
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Controls row (filters at left, apply) */}
      {searched && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Filters
            categories={categories}
            manufacturers={manufacturers}
            category={category}
            manufacturerId={manufacturerId}
            onCategoryChange={(newCategory) => {
              setCategory(newCategory);
              if (!rateLimited) {
                debouncedFilterSearch({ q, category: newCategory, manufacturerId });
              }
            }}
            onManufacturerChange={(newManufacturerId) => {
              setManufacturerId(newManufacturerId);
              if (!rateLimited) {
                debouncedFilterSearch({ q, category, manufacturerId: newManufacturerId });
              }
            }}
            onApply={applyFilters}
          />

          <button
            onClick={clearAll}
            className="px-3 py-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Clear All
          </button>

          {/* Retry button for errors */}
          {error && !rateLimited && (
            <button
              onClick={() => refetch()}
              className="px-3 py-3 rounded-xl border border-red-300 text-red-700 hover:bg-red-50 transition-colors"
            >
              Retry Search
            </button>
          )}

          {/* Retry button for rate limiting */}
          {rateLimited && retryAfter === 0 && (
            <button
              onClick={() => {
                setRateLimited(false);
                setRateLimitMessage('');
                refetch();
              }}
              className="px-3 py-3 rounded-xl border border-green-300 text-green-700 hover:bg-green-50 transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      )}

      {/* Error state (for non-rate-limit errors) */}
      {error && searched && !rateLimited && !rateLimitUtils.isRateLimitError(error) && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-700 font-medium">Search Error</div>
          <div className="text-red-600 text-sm mt-1">
            Unable to load search results. Please try again.
          </div>
        </div>
      )}

      {/* Results */}
      {searched ? (
        parts.length === 0 && !isLoading && !isFetching && !error && !rateLimited ? (
          <NoResults onReset={resetToHomepage} />
        ) : (
          <>
            <PartsList
              parts={pageSlice}
              onAdd={add}
              onUpdateQty={updateQty}
              getQty={inCartQty}
              loading={isLoading || isFetching}
              discountPct={(profile as UserProfile | null)?.discount_percentage || 0}
              onView={(p) => {
                window.dispatchEvent(new CustomEvent('pp:viewPart', { detail: { id: p.id } }));
              }}
            />

            {/* Pagination */}
            {total > pageSize && !isLoading && !isFetching && !rateLimited && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Page <span className="font-medium text-gray-900">{clampedPage}</span> of {lastPage}
                  {total > 0 && (
                    <span className="ml-2">
                      ({((clampedPage - 1) * pageSize) + 1}-{Math.min(clampedPage * pageSize, total)} of {total.toLocaleString()} results)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="px-3 py-2 rounded-lg border disabled:opacity-50 hover:bg-gray-50 transition-colors"
                    disabled={clampedPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <button
                    className="px-3 py-2 rounded-lg border disabled:opacity-50 hover:bg-gray-50 transition-colors"
                    disabled={clampedPage >= lastPage}
                    onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )
      ) : null}
    </div>
  );
};

export default ProductListingPage;