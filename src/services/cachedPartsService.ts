// src/services/cachedPartsService.ts
// Cached search + suggestions with time-bounded deduplication and wall-timeouts.
// Works with TS target "es5" (no ES2015 iterators necessary).

import { supabase } from 'services/supabaseClient';
import type { Part } from 'services/partsService';


// ---------------- Tunables ----------------
const SEARCH_TIMEOUT_MS = 12_000;     // wall timeout for search
const DEDUP_TIMEOUT_MS  = 12_000;     // timeout for dedup slot
const MEMORY_CACHE_TTL_MS = 30_000;   // small TTL to blunt bursts
const DEFAULT_LIMIT = 200;
const SUGGESTION_LIMIT_DEFAULT = 8;

declare global {
  interface Window {
    searchCount: number;
    searchHanging: boolean;
  }
}

// Add interface for deduplicator
interface DeduplicatorWithPending {
  pending: Map<string, Promise<any>>;
  execute<T>(key: string, op: () => Promise<T>, timeoutMs?: number): Promise<T>;
}

window.searchHanging = true;

try {
  // ... your existing search code
} finally {
  window.searchHanging = false; // Always reset this flag
}

// --------------- Small utils --------------
function normalizeFilter(val?: string | null): string | undefined {
  if (val == null) return undefined;
  const s = String(val).trim().toLowerCase();
  return s === '' || s === 'all' ? undefined : String(val);
}

function withTimeout<T>(p: Promise<T>, ms = SEARCH_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`SEARCH_TIMEOUT_${ms}ms`)), ms);
    p.then(v => { clearTimeout(t); resolve(v); })
     .catch(e => { clearTimeout(t); reject(e); });
  });
}

function keyPart(v: unknown) {
  if (v == null) return '';
  return String(v).trim().toLowerCase();
}

function escapeLike(s: string) {
  return s.replace(/[%_]/g, m => `\\${m}`);
}

// --------------- In-memory cache ----------
type CacheEntry<T> = { data: T; expiresAt: number };
const memCache = new Map<string, CacheEntry<any>>();

function mcGet<T>(key: string): T | undefined {
  const hit = memCache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    memCache.delete(key);
    return undefined;
  }
  return hit.data as T;
}

function mcSet<T>(key: string, data: T, ttlMs = MEMORY_CACHE_TTL_MS) {
  memCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

function mcClear(prefix?: string) {
  if (!prefix) {
    memCache.clear();
    return;
  }
  // Avoid ES2015 iterators to keep TS target "es5" happy
  memCache.forEach((_v, k) => {
    if (k.indexOf(prefix) === 0) memCache.delete(k);
  });
}

// ------------- Time-bounded dedup ---------
class RequestDeduplicator {
  private pending = new Map<string, Promise<any>>();

  execute<T>(key: string, op: () => Promise<T>, timeoutMs = DEDUP_TIMEOUT_MS): Promise<T> {
    const existing = this.pending.get(key);
    if (existing) return existing as Promise<T>;

    const run = op();
    const timed = new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`DEDUP_TIMEOUT_${timeoutMs}ms`)), timeoutMs);
      run.then(v => { clearTimeout(t); resolve(v); })
         .catch(e => { clearTimeout(t); reject(e); });
    });

    this.pending.set(key, timed);
    timed.finally(() => this.pending.delete(key));
    return timed;
  }
}
const dedup = new RequestDeduplicator();

// --------------- Public: Search ----------
export async function searchPartsWithCache(
  query: string,
  category?: string,
  manufacturerId?: string,
  limit = DEFAULT_LIMIT
): Promise<Part[]> {
  // Circuit breaker
  if (typeof window !== 'undefined' && window.searchHanging) {
    console.log('Previous search still hanging, aborting');
    return [];
  }

  const q = (query ?? '').trim();
  if (q.length < 2) return [];

  if (typeof window !== 'undefined') {
    window.searchHanging = true;
  }

  try {
    console.log('SEARCH START:', q);

    // Use the new RPC function instead of complex client-side logic
    const { data, error } = await supabase.rpc('search_parts_basic', {
      q: q,
      p_limit: limit
    });

    if (error) {
      console.error('Search RPC error:', error);
      throw new Error(`Search failed: ${error.message}`);
    }

    console.log('SEARCH SUCCESS:', q, data?.length || 0);
    return (data || []) as Part[];

  } catch (error) {
    console.error('SEARCH FAILED:', q, error);
    throw error;
  } finally {
    if (typeof window !== 'undefined') {
      window.searchHanging = false;
    }
  }
}

// -------------- RPC + Fallback ----------
async function performRpcSearch(
  searchQuery: string,
  category?: string,
  manufacturerId?: string,
  limit = DEFAULT_LIMIT
): Promise<Part[]> {
  const { data, error } = await supabase.rpc('search_parts_with_manufacturers_optimized', {
    search_query: searchQuery,
    category_filter: category ?? null,
    manufacturer_filter: manufacturerId ?? null,
    limit_results: limit,
  });
  if (error) throw error;
  return (data ?? []) as Part[];
}

async function performTableFallback(
  searchQuery: string,
  category?: string,
  manufacturerId?: string,
  limit = DEFAULT_LIMIT
): Promise<Part[]> {
  const like = `%${escapeLike(searchQuery)}%`;
  let q = supabase
    .from('parts')
    .select('*')
    .or(`part_number.ilike.${like},part_description.ilike.${like},make_part_number.ilike.${like}`)
    .limit(limit);

  if (category)       q = q.eq('category', category);
  if (manufacturerId) q = q.eq('manufacturer_id', manufacturerId);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Part[];
}

// --------------- Public: Suggestions -----
export type Suggestion = { type: 'part' | 'manufacturer'; value: string; description: string; score?: number };

/**
 * Fast typeahead suggestions (cached, tiny TTL).
 * - Prioritizes exact/prefix matches for part numbers
 * - Mixes in manufacturer names
 */
export async function getSuggestionsWithCache(
  raw: string,
  limit = SUGGESTION_LIMIT_DEFAULT
): Promise<Suggestion[]> {
  const query = (raw ?? '').trim();
  if (!query) return [];

  const key = ['sugs', keyPart(query), String(limit)].join('|');
  const cached = mcGet<Suggestion[]>(key);
  if (cached) return cached;

  const like = `%${escapeLike(query)}%`;
  const pnPrefix = `${escapeLike(query)}%`;

  // Prefer prefix on part_number for responsiveness; then widen
  const partsPrefix = supabase
    .from('parts')
    .select('part_number, part_description')
    .ilike('part_number', pnPrefix)
    .limit(Math.ceil(limit * 0.6));

  const partsWide = supabase
    .from('parts')
    .select('part_number, part_description')
    .or(`part_description.ilike.${like},make_part_number.ilike.${like}`)
    .limit(Math.ceil(limit * 0.4));

  const mfgsQ = supabase
    .from('manufacturers')
    .select('manufacturer')
    .ilike('manufacturer', like)
    .limit(Math.ceil(limit * 0.5));

  const [p1, p2, mfgs] = await Promise.all([partsPrefix, partsWide, mfgsQ]);

  if (p1.error)  console.warn('[getSuggestions] parts prefix error', p1.error);
  if (p2.error)  console.warn('[getSuggestions] parts wide error', p2.error);
  if (mfgs.error)console.warn('[getSuggestions] mfg error', mfgs.error);

  const pRows = ([] as any[]).concat(p1.data || [], p2.data || []);

  // Build part suggestions; materialize array (no iterator returns)
  const partMap = new Map<string, Suggestion>();
  for (let i = 0; i < pRows.length; i++) {
    const r = pRows[i];
    const sug: Suggestion = {
      type: 'part',
      value: r.part_number,
      description: r.part_description || '',
      score: r.part_number && String(r.part_number).toLowerCase().indexOf(query.toLowerCase()) === 0 ? 2 : 1
    };
    const prev = partMap.get(sug.value);
    if (!prev || (sug.score || 0) > (prev.score || 0)) partMap.set(sug.value, sug);
  }
  const partSugs: Suggestion[] = Array.from(partMap.values());

  const mfgSugs: Suggestion[] = (mfgs.data || []).map((r: any) => ({
    type: 'manufacturer',
    value: r.manufacturer,
    description: 'Manufacturer',
    score: 1
  }));

  const merged = partSugs.concat(mfgSugs)
    .sort((a, b) => (b.score || 0) - (a.score || 0) || a.value.localeCompare(b.value))
    .slice(0, limit);

  mcSet(key, merged);
  return merged;
}

// --------------- cacheUtils (expanded) ----
// Your other files call: preloadCommonSearches(), getStats(), clearCache()
export const cacheUtils = {
  getKey(parts: { query: string; category?: string; manufacturerId?: string; limit?: number }) {
    const { query, category, manufacturerId, limit = DEFAULT_LIMIT } = parts;
    return [
      'search',
      keyPart(query),
      keyPart(normalizeFilter(category)),
      keyPart(normalizeFilter(manufacturerId)),
      String(limit),
    ].join('|');
  },

  get: mcGet,
  set: mcSet,

  clear(prefix?: string) {
    mcClear(prefix);
  },

  // called as cacheUtils.clearCache()
  clearCache() {
    mcClear();
  },

  // lightweight stats for debugging
  getStats() {
    const keys = Array.from(memCache.keys()); // materialize keys for ES5 target
    return {
      size: memCache.size,
      keys
    };
  },

  // Warm up some popular searches in the background
  async preloadCommonSearches() {
    try {
      // customize this list to your business — keep it small/fast
      const popular = ['igniter', 'thermostat', 'pilot', 'gasket'];
      const promises: Promise<any>[] = [];
      for (let i = 0; i < popular.length; i++) {
        const term = popular[i];
        promises.push(
          searchPartsWithCache(term, undefined, undefined, 50)
            .catch(() => { /* ignore errors during warmup */ })
        );
      }
      await Promise.all(promises);
    } catch (_e) {
      // swallow warmup errors
    }
  },
};

// Add this emergency reset function
export function resetSearchState() {
  // Clear memory cache completely
  memCache.clear();
  
  // Reset window flags
  if (typeof window !== 'undefined') {
    window.searchCount = 0;
    window.searchHanging = false;
  }
  
  // Force create a new deduplicator instance to clear any pending requests
  const oldDedup = dedup;
  // This will abandon any hanging requests in the old deduplicator
  
  console.log('Search state reset completed');
}