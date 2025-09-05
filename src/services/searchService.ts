import type { Part } from 'services/partsService';

export async function searchParts(
  query: string,
  category?: string,
  manufacturerId?: string
): Promise<Part[]> {
  const cleanQuery = query?.trim();
  if (!cleanQuery || cleanQuery.length < 2) {
    return [];
  }

  try {
    const params = new URLSearchParams({
      q: cleanQuery,
      limit: '200'
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
    console.error('Search function error:', error);
    return [];
  }
}

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

export function clearSearchCache(): void {
  // No cache to clear
}

export function getSearchStats() {
  return {
    searchCacheSize: 0,
    suggestionCacheSize: 0
  };
}