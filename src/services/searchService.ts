// src/services/searchService.ts - Debug version to see what's happening
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
    console.log('🔍 SearchService: Query too short or empty:', cleanQuery);
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

    const url = `/.netlify/functions/search?${params.toString()}`;
    console.log('🔍 SearchService: Making request to:', url);

    const response = await fetch(url);
    
    console.log('🔍 SearchService: Response status:', response.status);
    console.log('🔍 SearchService: Response ok:', response.ok);
    
    if (!response.ok) {
      console.error('❌ SearchService: HTTP error:', response.status, response.statusText);
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    console.log('🔍 SearchService: Raw response:', result);
    console.log('🔍 SearchService: Data length:', result.data?.length);
    console.log('🔍 SearchService: Facets length:', result.facets?.length);
    
    const formattedResult = {
      data: result.data || [],
      facets: result.facets || [],
      count: result.count || 0
    };
    
    console.log('🔍 SearchService: Formatted result:', formattedResult);
    return formattedResult;

  } catch (error) {
    console.error('❌ SearchService: Search with facets error:', error);
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

    const url = `/.netlify/functions/search?${params.toString()}`;
    console.log('🔍 Simple SearchService: Making request to:', url);

    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('❌ Simple SearchService: HTTP error:', response.status);
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    console.log('🔍 Simple SearchService: Response:', result);
    return result.data || [];

  } catch (error) {
    console.error('❌ Simple SearchService: Search error:', error);
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
    const url = `/.netlify/functions/suggestions?q=${encodeURIComponent(cleanQuery)}`;
    console.log('🔍 Suggestions: Making request to:', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn('⚠️ Suggestions: HTTP error:', response.status);
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    console.log('🔍 Suggestions: Response:', result);
    return result.data || [];

  } catch (error) {
    console.warn('⚠️ Suggestions function error:', error);
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
    searchPartsWithFacets(term).catch((error) => {
      console.warn('Failed to preload search term:', term, error);
    });
  });
}