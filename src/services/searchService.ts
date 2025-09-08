// src/services/searchService.ts - Compatible with sidebar PLP
import type { Part } from 'services/partsService';

interface SearchResponse {
  data: Part[];
  facets: Array<{
    id: string;
    name: string;
    count: number;
  }>;
  count: number;
}

// Main search function with facets for sidebar
export async function searchPartsWithFacets(
  query: string,
  category?: string,
  manufacturerId?: string
): Promise<{
  data: any[];
  facets: Array<{ id: string; name: string; count: number; }>;
  count: number;
}> {
  const cleanQuery = query?.trim();
  if (!cleanQuery || cleanQuery.length < 2) {
    return { data: [], facets: [], count: 0 };
  }

  try {
    const params = new URLSearchParams({
      q: cleanQuery,
      limit: '1000'
    });
    
    if (category && category !== 'all') {
      params.append('category', category);
    }
    
    if (manufacturerId && manufacturerId !== 'all') {
      params.append('manufacturerId', manufacturerId);
    }

    const response = await fetch(`/.netlify/functions/search?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    return {
      data: result.data || [],
      facets: result.facets || [],
      count: result.count || 0
    };

  } catch (error) {
    console.error('Search with facets error:', error);
    return { data: [], facets: [], count: 0 };
  }
}

// Simple search function without facets (for backward compatibility)
export async function searchParts(
  query: string,
  category?: string,
  manufacturerId?: string
): Promise<any[]> {
  const cleanQuery = query?.trim();
  if (!cleanQuery || cleanQuery.length < 2) {
    return [];
  }

  try {
    const params = new URLSearchParams({
      q: cleanQuery,
      limit: '1000'
    });
    
    if (category && category !== 'all') {
      params.append('category', category);
    }
    
    if (manufacturerId && manufacturerId !== 'all') {
      params.append('manufacturerId', manufacturerId);
    }

    const response = await fetch(`/.netlify/functions/search?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    return result.data || [];

  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

// Suggestions function
export async function getSearchSuggestions(query: string): Promise<Array<{
  type: 'part' | 'manufacturer';
  value: string;
  description: string;
}>> {
  const cleanQuery = query?.trim();
  if (!cleanQuery || cleanQuery.length < 2) {
    return [];
  }

  try {
    const response = await fetch(`/.netlify/functions/suggestions?q=${encodeURIComponent(cleanQuery)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    return result.data || [];

  } catch (error) {
    console.warn('Suggestions function error:', error);
    return [];
  }
}

// Cache utilities
export function clearSearchCache(): void {
  // No cache to clear in this implementation
}

export function getSearchStats() {
  return {
    searchCacheSize: 0,
    suggestionCacheSize: 0
  };
}

// Preload popular searches (optional performance optimization)
export async function preloadPopularSearches(): Promise<void> {
  const popularTerms = ['igniter', 'thermostat', 'pilot', 'gasket', 'frymaster'];
  
  // Run in background, don't await
  popularTerms.forEach(term => {
    searchPartsWithFacets(term).catch(() => {}); // Ignore errors
  });
}