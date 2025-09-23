// src/services/partsService.ts - Optimized with better error handling and performance
import { supabase } from 'services/supabaseClient';

export interface Manufacturer { id: string; make: string; manufacturer: string }
export interface Part {
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
  // Add these flat fields that your RPC actually returns:
  manufacturer_name?: string;
  make?: string;
}

// Error types for better error handling
export class PartsServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'PartsServiceError';
  }
}

// Retry logic for failed requests
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 2,
  delay = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  
  throw lastError!;
}

// Enhanced manufacturers list with error handling and performance
export async function listManufacturers(): Promise<Manufacturer[]> {
  try {
    return await withRetry(async () => {
      const { data, error } = await supabase
        .from('manufacturers')
        .select('*')
        .order('manufacturer')
        .limit(500); // Reasonable limit for performance
      
      if (error) {
        throw new PartsServiceError(
          'Failed to load manufacturers',
          'MANUFACTURERS_FETCH_ERROR',
          error as unknown as Error
        );
      }
      
      return (data as Manufacturer[]) || [];
    });
  } catch (error) {
    console.error('Error fetching manufacturers:', error);
    if (error instanceof PartsServiceError) {
      throw error;
    }
    throw new PartsServiceError(
      'Unable to load manufacturers',
      'UNKNOWN_ERROR',
      error as Error
    );
  }
}

// Enhanced categories list with caching-friendly structure
export async function listCategories(): Promise<string[]> {
  try {
    return await withRetry(async () => {
      const { data, error } = await supabase
        .from('parts')
        .select('category')
        .not('category', 'is', null)
        .limit(1000); // Limit for performance
      
      if (error) {
        throw new PartsServiceError(
          'Failed to load categories',
          'CATEGORIES_FETCH_ERROR',
          error as unknown as Error
        );
      }
      
      // Use Set for deduplication and convert to sorted array
      const categories = Array.from(
        new Set((data || []).map(d => d.category).filter(Boolean))
      ).sort();
      
      return categories as string[];
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    if (error instanceof PartsServiceError) {
      throw error;
    }
    throw new PartsServiceError(
      'Unable to load categories',
      'UNKNOWN_ERROR',
      error as Error
    );
  }
}

// Enhanced search with better error handling and input validation
export async function searchPartsAdvanced(
  search: string, 
  category = 'all', 
  manufacturerId: string | null = null
): Promise<Part[]> {
  // Input validation
  if (!search || typeof search !== 'string') {
    throw new PartsServiceError(
      'Search query is required',
      'INVALID_SEARCH_QUERY'
    );
  }
  
  const trimmedSearch = search.trim();
  if (trimmedSearch.length === 0) {
    return [];
  }
  
  // Prevent extremely long search queries
  if (trimmedSearch.length > 100) {
    throw new PartsServiceError(
      'Search query is too long',
      'SEARCH_QUERY_TOO_LONG'
    );
  }
  
  try {
    return await withRetry(async () => {
      const { data, error } = await supabase.rpc('search_parts_with_manufacturers', {
        search_query: trimmedSearch,
        category_filter: category === 'all' ? null : category,
        manufacturer_filter: manufacturerId === 'all' ? null : manufacturerId
      });
      
      if (error) {
        throw new PartsServiceError(
          'Search failed',
          'SEARCH_RPC_ERROR',
          error as unknown as Error
        );
      }
      
      return (data || []).map(mapRPCToPart) as Part[];
    });
  } catch (error) {
    console.error('Error in searchPartsAdvanced:', error);
    if (error instanceof PartsServiceError) {
      throw error;
    }
    throw new PartsServiceError(
      'Unable to perform search',
      'UNKNOWN_SEARCH_ERROR',
      error as Error
    );
  }
}

// Enhanced fallback search with better performance
export async function fallbackSearch(
  search: string, 
  category = 'all', 
  manufacturerId = 'all'
): Promise<Part[]> {
  try {
    return await withRetry(async () => {
      let query = supabase
        .from('parts')
        .select(`*, manufacturer:manufacturer_id ( id, make, manufacturer )`)
        .limit(200) // Reasonable limit for performance
        .order('part_number');
      
      if (search.trim()) {
        const s = search.toLowerCase().trim();
        // Use more efficient search patterns
        query = query.or(
          `part_number.ilike.%${s}%, part_description.ilike.%${s}%, make_part_number.ilike.%${s}%`
        );
      }
      
      if (category !== 'all') {
        query = query.eq('category', category);
      }
      
      if (manufacturerId !== 'all') {
        query = query.eq('manufacturer_id', manufacturerId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw new PartsServiceError(
          'Fallback search failed',
          'FALLBACK_SEARCH_ERROR',
          error as unknown as Error
        );
      }
      
      return (data || []) as any as Part[];
    });
  } catch (error) {
    console.error('Error in fallbackSearch:', error);
    if (error instanceof PartsServiceError) {
      throw error;
    }
    throw new PartsServiceError(
      'Unable to perform fallback search',
      'UNKNOWN_FALLBACK_ERROR',
      error as Error
    );
  }
}

// Enhanced suggestions with input validation and better error handling
export async function suggest(query: string) {
  // Input validation
  if (!query || typeof query !== 'string') {
    return [];
  }
  
  const trimmedQuery = query.trim();
  if (trimmedQuery.length === 0 || trimmedQuery.length > 50) {
    return [];
  }
  
  try {
    return await withRetry(async () => {
      const [{ data: partS }, { data: mfgS }] = await Promise.all([
        supabase.rpc('suggest_part_numbers', { 
          search_prefix: trimmedQuery, 
          limit_count: 5 
        }),
        supabase.rpc('suggest_manufacturers', { 
          search_prefix: trimmedQuery, 
          limit_count: 3 
        }),
      ]);
      
      const out: { 
        type: 'part'|'manufacturer'; 
        value: string; 
        description: string; 
        score: number 
      }[] = [];
      
      // Process part suggestions
      (partS || []).forEach((i: any) => {
        if (i.part_number && i.part_description) {
          out.push({ 
            type: 'part', 
            value: i.part_number, 
            description: i.part_description, 
            score: i.similarity_score || 0 
          });
        }
      });
      
      // Process manufacturer suggestions
      (mfgS || []).forEach((i: any) => {
        if (i.manufacturer_name) {
          out.push({ 
            type: 'manufacturer', 
            value: `${i.manufacturer_name} ${i.make || ''}`.trim(), 
            description: `${i.parts_count || 0} parts available`, 
            score: i.similarity_score || 0 
          });
        }
      });
      
      return out
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);
    }, 1); // Only retry once for suggestions
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    // Don't throw for suggestions - just return empty array
    return [];
  }
}

// Enhanced recent parts with better error handling
export async function listRecentParts(limit = 50): Promise<Part[]> {
  try {
    // Validate limit
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    
    return await withRetry(async () => {
      const { data, error } = await supabase
        .from('parts')
        .select(`*, manufacturer:manufacturer_id ( id, make, manufacturer )`)
        .limit(safeLimit)
        .order('created_at', { ascending: false });
      
      if (error) {
        throw new PartsServiceError(
          'Failed to load recent parts',
          'RECENT_PARTS_ERROR',
          error as unknown as Error
        );
      }
      
      return (data || []) as any as Part[];
    });
  } catch (error) {
    console.error('Error fetching recent parts:', error);
    if (error instanceof PartsServiceError) {
      throw error;
    }
    throw new PartsServiceError(
      'Unable to load recent parts',
      'UNKNOWN_RECENT_ERROR',
      error as Error
    );
  }
}

// Enhanced mapping function with better error handling
function mapRPCToPart(item: any): Part {
  try {
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
  } catch (error) {
    console.error('Error mapping RPC result to Part:', error, item);
    // Return a minimal valid Part object
    return {
      id: item.id || 'unknown',
      part_number: 'N/A',
      part_description: 'Error loading part details',
      category: '',
      list_price: '0',
      compatible_models: [],
      in_stock: false,
      manufacturer_id: '',
      manufacturer: {
        id: '',
        manufacturer: '',
        make: ''
      }
    };
  }
}

// Utility function to check service health
export async function checkServiceHealth(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('parts')
      .select('id')
      .limit(1);
    
    return !error;
  } catch {
    return false;
  }
}