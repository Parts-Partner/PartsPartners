// src/features/parts/PartsSearch.tsx - Enhanced with caching and rate limiting
import React, { useEffect, useRef, useState } from 'react';
import {
  listCategories,
  listManufacturers,
  searchPartsAdvanced,
  fallbackSearch,
  type Part,
} from 'services/partsService';
import { searchPartsWithCache, cacheUtils } from 'services/cachedPartsService';
import { rateLimitUtils, RateLimitError } from 'lib/rateLimiting';
import { supabase } from 'services/supabaseClient';
import { useCart } from 'context/CartContext';
import { useAuth } from 'context/AuthContext';
import { PartsList } from 'components/search/PartsList';
import { NoResults } from 'components/search/NoResults';
import HomePromos from 'components/home/HomePromos';
import type { UserProfile } from 'context/AuthContext';

export const PartsSearch: React.FC<{
  onNav?: (page: string) => void;
  onOpenTech?: () => void;
}> = ({ onNav, onOpenTech }) => {
  const { add, updateQty, items } = useCart();
  const { profile } = useAuth();

  const [category, setCategory] = useState('all');
  const [manufacturerId, setManufacturerId] = useState('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [manufacturers, setManufacturers] = useState<{ id: string; manufacturer: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [parts, setParts] = useState<Part[]>([]);
  const [searched, setSearched] = useState(false);

  // Performance tracking states
  const [lastSearchTime, setLastSearchTime] = useState<number>(0);
  const [cacheHit, setCacheHit] = useState(false);

  // Rate limiting states
  const [rateLimited, setRateLimited] = useState(false);
  const [rateLimitMessage, setRateLimitMessage] = useState('');
  const [retryAfter, setRetryAfter] = useState(0);

  // Bulk Order hover flyout state (used by the promo card)
  const [flyOpen, setFlyOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addSummary, setAddSummary] = useState<{ added: number; missing: number } | null>(null);
  const flyTimer = useRef<number | null>(null);

  // Load filters and warm up cache on mount
  useEffect(() => {
    (async () => {
      const [cats, mfgs] = await Promise.all([listCategories(), listManufacturers()]);
      setCategories(cats);
      setManufacturers(mfgs);

      // Warm up cache with popular searches (runs in background)
      setTimeout(() => {
        cacheUtils.preloadCommonSearches().catch(console.error);
      }, 2000);
    })().catch(console.error);
  }, []);

  // Enhanced search handler with caching, performance tracking, and rate limiting
  const onSearch = async (q: string, cat = category, mfgId = manufacturerId) => {
    const searchStartTime = Date.now();
    
    setLoading(true);
    setSearched(true);
    setCategory(cat);
    setManufacturerId(mfgId);
    setCacheHit(false);
    
    // Clear any previous rate limit state
    setRateLimited(false);
    setRateLimitMessage('');
    
    try {
      const query = q.trim();
      if (!query.length) {
        setParts([]);
        setLoading(false);
        return;
      }

      console.log(`🔍 Starting search: "${query}"`);
      
      // Use cached search with rate limiting
      const res = await searchPartsWithCache(query, cat, mfgId);
      setParts(res);

      // Performance tracking and cache hit detection
      const searchTime = Date.now() - searchStartTime;
      setLastSearchTime(searchTime);
      const wasCacheHit = searchTime < 100;
      setCacheHit(wasCacheHit);
      
      console.log(`✅ Search completed: ${res.length} results in ${searchTime}ms (cached: ${wasCacheHit})`);
      
    } catch (error) {
      console.error('Search failed:', error);
      
      // Handle rate limiting errors specially
      if (rateLimitUtils.isRateLimitError(error)) {
        const rateLimitError = error as RateLimitError;
        setRateLimited(true);
        setRateLimitMessage(rateLimitUtils.getRateLimitMessage('search', rateLimitError));
        setRetryAfter(rateLimitError.getRetryAfterSeconds());
        
        // Show user-friendly notification
        rateLimitUtils.showRateLimitNotification('search', rateLimitError);
        
        // Don't clear existing results - let user see what they had
      } else {
        // Handle other errors normally
        setParts([]);
      }
    } finally {
      setLoading(false);
    }
  };

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

  // Listen for header-dispatched searches — support both event names
  useEffect(() => {
    const handler = (e: Event) => {
      const { q, category: cat, manufacturerId: mfgId } = (e as CustomEvent).detail || {};
      onSearch(String(q ?? ''), String(cat ?? category), String(mfgId ?? manufacturerId));
    };
    window.addEventListener('pp:search' as any, handler);     // legacy
    window.addEventListener('pp:do-search' as any, handler);  // new
    return () => {
      window.removeEventListener('pp:search' as any, handler);
      window.removeEventListener('pp:do-search' as any, handler);
    };
  }, [category, manufacturerId]);

  // If the header bulk flyout submits text, accept it here
  useEffect(() => {
    const onBulk = (e: Event) => {
      const txt = ((e as CustomEvent).detail || {}).text as string | undefined;
      if (!txt) return;
      setBulkText(txt);
      // run after state commit
      setTimeout(() => addFromBulk(), 0);
    };
    window.addEventListener('pp:bulkOrderInput' as any, onBulk);
    return () => window.removeEventListener('pp:bulkOrderInput' as any, onBulk);
  }, []);

  const inCartQty = (id: string) => items.find((i) => i.id === id)?.quantity || 0;

  // --- Bulk Order helpers ---
  type ParsedRow = { sku: string; qty: number };
  const parseBulk = (text: string): ParsedRow[] =>
    text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const m = l.match(/^([^,\t ]+)[,\t ]*\s*(\d+)?$/i);
        if (!m) return null;
        const sku = m[1].trim();
        const qty = m[2] ? Math.max(1, parseInt(m[2], 10)) : 1;
        return { sku, qty };
      })
      .filter((x): x is ParsedRow => !!x);

  const addFromBulk = async () => {
    const rows = parseBulk(bulkText || '');
    if (rows.length === 0) {
      setAddSummary(null);
      return;
    }
    setIsAdding(true);
    setAddSummary(null);

    try {
      const skuList = Array.from(new Set(rows.map((r) => r.sku)));
      const sel = `*, manufacturer:manufacturer_id ( id, make, manufacturer )`;
      const byPN = await supabase.from('parts').select(sel).in('part_number', skuList);

      const notFoundSkus =
        (skuList || []).filter((sku) => !(byPN.data || []).some((p: any) => p.part_number === sku)) || [];
      const byMake = notFoundSkus.length
        ? await supabase.from('parts').select(sel).in('make_part_number', notFoundSkus)
        : { data: [] as any[] };

      const all = ([...(byPN.data || []), ...(byMake.data || [])] as any[]).map((item) => ({
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
        manufacturer: item.manufacturer,
      })) as Part[];

      let added = 0;
      const qtyBySku = new Map(rows.map((r) => [r.sku, r.qty]));
      const pickQty = (p: Part) => qtyBySku.get(p.part_number) ?? qtyBySku.get(p.make_part_number || '') ?? 1;

      all.forEach((p) => {
        const qty = pickQty(p);
        if (qty && qty > 0) {
          add(p, qty);
          added += 1;
        }
      });

      const missing = skuList.length - added;
      setAddSummary({ added, missing });
      
      // Simple console logging instead of toast
      if (added > 0) {
        console.log(`✅ Added ${added} item${added === 1 ? '' : 's'} from your list`);
      }
      if (missing > 0) {
        console.log(`⚠️ Couldn't find ${missing} item${missing === 1 ? '' : 's'} in our catalog`);
      }
      if (added > 0) setBulkText('');
      
    } catch (error) {
      console.error('Bulk add failed:', error);
      
      // Handle rate limiting errors for bulk operations
      if (rateLimitUtils.isRateLimitError(error)) {
        const rateLimitError = error as RateLimitError;
        const message = rateLimitUtils.getRateLimitMessage('bulk', rateLimitError);
        alert(message); // Simple alert for bulk operations
        rateLimitUtils.showRateLimitNotification('bulk', rateLimitError);
      }
    } finally {
      setIsAdding(false);
    }
  };

  const openFly = () => {
    if (flyTimer.current) window.clearTimeout(flyTimer.current);
    setFlyOpen(true);
  };
  const closeFlySoon = () => {
    if (flyTimer.current) window.clearTimeout(flyTimer.current);
    flyTimer.current = window.setTimeout(() => setFlyOpen(false), 140) as unknown as number;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Performance indicator (development only) */}
      {process.env.NODE_ENV === 'development' && searched && (
        <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
          Last search: {lastSearchTime}ms {cacheHit && '⚡ (cached)'} | 
          Results: {parts.length} | 
          <button 
            onClick={() => console.log(cacheUtils.getStats())}
            className="ml-2 text-blue-600 underline"
          >
            Cache Stats
          </button> |
          <button 
            onClick={() => cacheUtils.clearCache()}
            className="ml-2 text-red-600 underline"
          >
            Clear Cache
          </button>
        </div>
      )}

      {/* Rate limit notification banner */}
      {rateLimited && (
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

      {/* Promos always visible */}
      <HomePromos
        onRegister={() => onNav?.('contact')}
        onFindTech={() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          onOpenTech?.();
        }}
        onBulk={openFly}
      />

      {/* Results: hidden until first search */}
      {parts.length === 0 && searched ? (
        <NoResults
          onReset={() => {
            setCategory('all');
            setManufacturerId('all');
            setParts([]);
            setSearched(false);
            // Reset performance indicators
            setCacheHit(false);
            setLastSearchTime(0);
            // Reset rate limiting state
            setRateLimited(false);
            setRateLimitMessage('');
            setRetryAfter(0);
          }}
        />
      ) : (
        searched && (
          <PartsList
            parts={parts}
            onAdd={add}
            onUpdateQty={updateQty}
            getQty={inCartQty}
            loading={loading}
            discountPct={(profile as UserProfile | null)?.discount_percentage || 0}
            onView={(p) => {
              window.dispatchEvent(new CustomEvent('pp:viewPart', { detail: { id: p.id } }));
            }}
          />
        )
      )}
    </div>
  );
};