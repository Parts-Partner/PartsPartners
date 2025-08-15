// src/services/cachedPartsService.ts
import { supabase } from 'services/supabaseClient';
import type { Part } from 'services/partsService';
// ADD THESE RATE LIMITING IMPORTS
import { 
  searchLimiter, 
  bulkLimiter, 
  suggestionsLimiter,
  getRateLimitKey, 
  checkRateLimit,
  RateLimitError,
  rateLimitMonitor
} from 'lib/rateLimiting';

// =============================================================================
// USER IDENTIFICATION UTILITY
// =============================================================================

// Add this function to get current user ID
async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch {
    return null;
  }
}

// =============================================================================
// IN-MEMORY SEARCH CACHE
// =============================================================================

interface CacheEntry {
  data: Part[];
  timestamp: number;
  hitCount: number;
}

class SearchCache {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_ENTRIES = 1000; // Prevent memory bloat
  private readonly POPULAR_THRESHOLD = 3; // Queries hit 3+ times are "popular"

  private getCacheKey(query: string, category: string, manufacturerId: string): string {
    return `${query.toLowerCase().trim()}:${category}:${manufacturerId}`;
  }

  get(query: string, category: string, manufacturerId: string): Part[] | null {
    const key = this.getCacheKey(query, category, manufacturerId);
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    // Check if expired
    if (Date.now() - cached.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    
    // Increment hit count for analytics
    cached.hitCount++;
    
    console.log(`🎯 Cache HIT for: "${query}" (${cached.hitCount} hits)`);
    return [...cached.data]; // Return copy to prevent mutations
  }

  set(query: string, category: string, manufacturerId: string, data: Part[]): void {
    const key = this.getCacheKey(query, category, manufacturerId);
    
    // Don't cache empty results or very large result sets
    if (data.length === 0 || data.length > 500) {
      return;
    }
    
    this.cache.set(key, {
      data: [...data], // Store copy to prevent mutations
      timestamp: Date.now(),
      hitCount: 0
    });
    
    console.log(`💾 Cached search: "${query}" (${data.length} results)`);
    
    // Cleanup old entries if we're over the limit
    this.cleanup();
  }

  private cleanup(): void {
    if (this.cache.size <= this.MAX_ENTRIES) return;
    
    // Get all entries sorted by timestamp (oldest first)
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => {
      // Prioritize keeping popular searches (high hit count)
      if (a[1].hitCount >= this.POPULAR_THRESHOLD && b[1].hitCount < this.POPULAR_THRESHOLD) {
        return 1; // Keep 'a', remove 'b'
      }
      if (b[1].hitCount >= this.POPULAR_THRESHOLD && a[1].hitCount < this.POPULAR_THRESHOLD) {
        return -1; // Keep 'b', remove 'a'
      }
      // Otherwise sort by age (oldest first for removal)
      return a[1].timestamp - b[1].timestamp;
    });
    
    // Remove oldest 20% of entries
    const toRemove = Math.floor(this.cache.size * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
    
    console.log(`🧹 Cache cleanup: Removed ${toRemove} old entries`);
  }

  clear(): void {
    this.cache.clear();
    console.log('🗑️ Cache cleared');
  }

  getStats(): { size: number; hitRate: number; popularQueries: string[] } {
    const entries = Array.from(this.cache.entries());
    const totalHits = entries.reduce((sum, [, entry]) => sum + entry.hitCount, 0);
    const popular = entries
      .filter(([, entry]) => entry.hitCount >= this.POPULAR_THRESHOLD)
      .map(([key]) => key.split(':')[0]) // Extract just the query part
      .slice(0, 10);
    
    return {
      size: this.cache.size,
      hitRate: totalHits > 0 ? totalHits / this.cache.size : 0,
      popularQueries: popular
    };
  }
}

// =============================================================================
// REQUEST DEDUPLICATION
// =============================================================================

class RequestDeduplicator {
  private pendingRequests = new Map<string, Promise<Part[]>>();

  async execute<T>(key: string, operation: () => Promise<T>): Promise<T> {
    // Check if same request is already in flight
    const existing = this.pendingRequests.get(key);
    if (existing) {
      console.log(`⏳ Deduplicating request: ${key}`);
      return existing as unknown as T;
    }

    // Execute the operation
    const promise = operation();
    this.pendingRequests.set(key, promise as unknown as Promise<Part[]>);

    try {
      const result = await promise;
      return result;
    } finally {
      // Clean up the pending request
      this.pendingRequests.delete(key);
    }
  }
}

// =============================================================================
// PERFORMANCE MONITORING
// =============================================================================

class PerformanceMonitor {
  private searchTimes: number[] = [];
  private readonly MAX_SAMPLES = 100;

  trackSearch(duration: number, query: string, cacheHit: boolean): void {
    this.searchTimes.push(duration);
    
    // Keep only last 100 samples
    if (this.searchTimes.length > this.MAX_SAMPLES) {
      this.searchTimes.shift();
    }

    // Log slow searches
    if (duration > 1000) {
      console.warn(`🐌 Slow search: "${query}" took ${duration}ms (cache: ${cacheHit})`);
    } else if (duration < 100 && cacheHit) {
      console.log(`⚡ Fast cached search: "${query}" in ${duration}ms`);
    }
  }

  getStats(): { avgTime: number; p95Time: number; slowQueries: number } {
    if (this.searchTimes.length === 0) return { avgTime: 0, p95Time: 0, slowQueries: 0 };
    
    const sorted = [...this.searchTimes].sort((a, b) => a - b);
    const avg = this.searchTimes.reduce((sum, time) => sum + time, 0) / this.searchTimes.length;
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95 = sorted[p95Index] || 0;
    const slow = this.searchTimes.filter(time => time > 1000).length;
    
    return {
      avgTime: Math.round(avg),
      p95Time: Math.round(p95),
      slowQueries: slow
    };
  }
}

// =============================================================================
// MAIN CACHED SEARCH SERVICE WITH RATE LIMITING
// =============================================================================

const searchCache = new SearchCache();
const deduplicator = new RequestDeduplicator();
const perfMonitor = new PerformanceMonitor();

export async function searchPartsWithCache(
  search: string,
  category = 'all',
  manufacturerId = 'all'
): Promise<Part[]> {
  const startTime = Date.now();
  
  // Input validation
  if (!search?.trim() || search.trim().length < 2) {
    return [];
  }

  const trimmedSearch = search.trim();
  
  try {
    // 1. CHECK RATE LIMIT FIRST
    const userId = await getCurrentUserId();
    const rateLimitKey = getRateLimitKey('search', userId || undefined);
    
    checkRateLimit(searchLimiter, rateLimitKey);
    
    console.log(`🔍 Search rate limit check passed for key: ${rateLimitKey.substring(0, 20)}...`);

    // 2. Check cache
    const cached = searchCache.get(trimmedSearch, category, manufacturerId);
    if (cached) {
      const duration = Date.now() - startTime;
      perfMonitor.trackSearch(duration, trimmedSearch, true);
      return cached;
    }

    // 3. Execute search with deduplication
    const requestKey = `${trimmedSearch}:${category}:${manufacturerId}`;
    const results = await deduplicator.execute(requestKey, () =>
      performActualSearch(trimmedSearch, category, manufacturerId)
    );

    // 4. Cache the results
    searchCache.set(trimmedSearch, category, manufacturerId, results);

    // 5. Track performance
    const duration = Date.now() - startTime;
    perfMonitor.trackSearch(duration, trimmedSearch, false);

    return results;
    
  } catch (error) {
    if (error instanceof RateLimitError) {
      console.warn(`🚫 Search rate limited: ${error.message} (retry in ${error.getRetryAfterHuman()})`);
      throw error; // Let the UI handle the rate limit error
    }
    
    console.error('Cached search failed:', error);
    
    // Fallback to direct search without caching
    return performFallbackSearch(trimmedSearch, category, manufacturerId);
  }
}

// =============================================================================
// SUGGESTIONS WITH RATE LIMITING
// =============================================================================

const suggestionsCache = new Map<string, { data: any[]; timestamp: number }>();
const SUGGESTIONS_TTL = 10 * 60 * 1000; // 10 minutes

export async function getSuggestionsWithCache(query: string): Promise<any[]> {
  if (!query?.trim() || query.trim().length < 1) return [];
  
  try {
    // Rate limit check for suggestions
    const userId = await getCurrentUserId();
    const rateLimitKey = getRateLimitKey('suggestions', userId || undefined);
    
    checkRateLimit(suggestionsLimiter, rateLimitKey);
    
    const key = query.toLowerCase().trim();
    const cached = suggestionsCache.get(key);
    
    // Check cache
    if (cached && Date.now() - cached.timestamp < SUGGESTIONS_TTL) {
      return cached.data;
    }
    
    // Fetch new suggestions
    const [{ data: partS }, { data: mfgS }] = await Promise.all([
      supabase.rpc('suggest_part_numbers', { 
        search_prefix: query, 
        limit_count: 5 
      }),
      supabase.rpc('suggest_manufacturers', { 
        search_prefix: query, 
        limit_count: 3 
      }),
    ]);
    
    const suggestions = [
      ...(partS || []).map((i: any) => ({
        type: 'part',
        value: i.part_number,
        description: i.part_description,
        score: i.similarity_score || 0
      })),
      ...(mfgS || []).map((i: any) => ({
        type: 'manufacturer',
        value: `${i.manufacturer_name} ${i.make || ''}`.trim(),
        description: `${i.parts_count || 0} parts available`,
        score: i.similarity_score || 0
      }))
    ].sort((a, b) => b.score - a.score).slice(0, 8);
    
    // Cache the result
    suggestionsCache.set(key, {
      data: suggestions,
      timestamp: Date.now()
    });
    
    return suggestions;
    
  } catch (error) {
    if (error instanceof RateLimitError) {
      console.warn(`🚫 Suggestions rate limited: ${error.message}`);
      // For suggestions, we can be more lenient and return empty array
      return [];
    }
    
    console.error('Suggestions failed:', error);
    return [];
  }
}

// =============================================================================
// BULK OPERATIONS WITH RATE LIMITING
// =============================================================================

export async function validateBulkOrderWithRateLimit(partNumbers: string[]): Promise<any[]> {
  try {
    // Rate limit check for bulk operations
    const userId = await getCurrentUserId();
    const rateLimitKey = getRateLimitKey('bulk', userId || undefined);
    
    checkRateLimit(bulkLimiter, rateLimitKey);
    
    console.log(`📦 Bulk validation rate limit check passed for ${partNumbers.length} parts`);
    
    // Call your existing bulk validation logic
    const { data, error } = await supabase.rpc('validate_bulk_skus', {
      part_numbers: partNumbers,
      customer_id: userId
    });
    
    if (error) throw error;
    
    return data || [];
    
  } catch (error) {
    if (error instanceof RateLimitError) {
      console.warn(`🚫 Bulk operation rate limited: ${error.message}`);
      throw error; // Let the UI handle the rate limit error
    }
    
    throw error; // Re-throw other errors
  }
}

// =============================================================================
// SEARCH IMPLEMENTATION
// =============================================================================

async function performActualSearch(
  search: string,
  category: string,
  manufacturerId: string
): Promise<Part[]> {
  console.log(`🔍 Database search: "${search}"`);
  
  try {
    // Use your optimized RPC function with the indexes we created
    const { data, error } = await supabase.rpc('search_parts_with_manufacturers_optimized', {
      search_query: search,
      category_filter: category === 'all' ? null : category,
      manufacturer_filter: manufacturerId === 'all' ? null : manufacturerId,
      limit_results: 200 // Reasonable limit for performance
    });

    if (error) throw error;

    return (data || []).map(mapRPCToPart);
  } catch (error) {
    console.warn('RPC search failed, using fallback:', error);
    return performFallbackSearch(search, category, manufacturerId);
  }
}

async function performFallbackSearch(
  search: string,
  category: string,
  manufacturerId: string
): Promise<Part[]> {
  console.log(`🔄 Fallback search: "${search}"`);
  
  let query = supabase
    .from('parts')
    .select(`*, manufacturer:manufacturer_id ( id, make, manufacturer )`)
    .limit(200)
    .order('part_number');

  // Add search conditions (leveraging our new indexes)
  if (search) {
    query = query.or(
      `part_number.ilike.%${search}%,part_description.ilike.%${search}%,make_part_number.ilike.%${search}%`
    );
  }

  if (category !== 'all') {
    query = query.eq('category', category);
  }

  if (manufacturerId !== 'all') {
    query = query.eq('manufacturer_id', manufacturerId);
  }

  const { data, error } = await query;
  
  if (error) throw error;
  
  return (data || []) as any as Part[];
}

function mapRPCToPart(item: any): Part {
  return {
    id: item.id || '',
    part_number: item.part_number || '',
    part_description: item.part_description || '',
    category: item.category || '',
    list_price: item.list_price || '0',
    compatible_models: item.compatible_models || [],
    image_url: item.image_url,
    in_stock: Boolean(item.in_stock),
    created_at: item.created_at,
    updated_at: item.updated_at,
    manufacturer_id: item.manufacturer_id || '',
    make_part_number: item.make_part_number,
    search_rank: item.search_rank,
    manufacturer: {
      id: item.manufacturer_id || '',
      manufacturer: item.manufacturer_name || '',
      make: item.make || ''
    }
  };
}

// =============================================================================
// ENHANCED CACHE UTILITIES WITH RATE LIMIT MONITORING
// =============================================================================

export const cacheUtils = {
  // Clear cache (useful for admin or debugging)
  clearCache: () => searchCache.clear(),
  
  // Get cache statistics
  getStats: () => ({
    cache: searchCache.getStats(),
    performance: perfMonitor.getStats()
  }),
  
  // Get comprehensive stats including rate limiting
  getDetailedStats: () => {
    const cacheStats = cacheUtils.getStats();
    const rateLimitStats = rateLimitMonitor.getAllStats();
    const currentLoad = rateLimitMonitor.getCurrentLoad();
    
    return {
      cache: cacheStats,
      rateLimits: rateLimitStats,
      load: currentLoad,
      timestamp: Date.now()
    };
  },
  
  // Check if system is under heavy load
  isUnderHeavyLoad: (): boolean => {
    const load = rateLimitMonitor.getCurrentLoad();
    return load.blockRate > 10; // More than 10% of users are rate limited
  },
  
  // Get system health status
  getSystemHealth: (): 'healthy' | 'warning' | 'critical' => {
    const load = rateLimitMonitor.getCurrentLoad();
    
    if (load.blockRate > 25) return 'critical';
    if (load.blockRate > 10) return 'warning';
    return 'healthy';
  },
  
  // Warm up cache with popular searches
  warmupCache: async (popularQueries: string[]) => {
    console.log('🔥 Warming up cache with popular queries...');
    
    for (const query of popularQueries) {
      try {
        await searchPartsWithCache(query, 'all', 'all');
        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.warn(`Failed to warm up cache for "${query}":`, error);
      }
    }
    
    console.log('✅ Cache warmup complete');
  },
  
  // Preload common searches
  preloadCommonSearches: async () => {
    const commonQueries = [
      'igniter', 'compressor', 'thermostat', 'valve', 'control',
      'motor', 'pump', 'fan', 'filter', 'sensor', 'switch'
    ];
    
    await cacheUtils.warmupCache(commonQueries);
  }
};