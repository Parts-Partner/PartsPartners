// src/services/searchService.ts - Direct HTTP to Supabase
export async function searchParts(query: string, category?: string, manufacturerId?: string): Promise<any[]> {
  const cleanQuery = query?.trim();
  if (!cleanQuery || cleanQuery.length < 2) return [];

  try {
    const searchTerm = encodeURIComponent(`%${cleanQuery.toLowerCase()}%`);
    let url = `${process.env.REACT_APP_SUPABASE_URL}/rest/v1/parts?select=*,manufacturer:manufacturer_id(*)&or=(part_number.ilike.${searchTerm},part_description.ilike.${searchTerm})&limit=200`;
    
    if (category && category !== 'all') {
      url += `&category=eq.${encodeURIComponent(category)}`;
    }
    
    if (manufacturerId && manufacturerId !== 'all') {
      url += `&manufacturer_id=eq.${encodeURIComponent(manufacturerId)}`;
    }
    
    console.log('Fetching:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': process.env.REACT_APP_SUPABASE_ANON_KEY!,
        'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY!}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    console.log('Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Search data:', data);
    return data || [];
  } catch (error) {
    console.error('Search failed:', error);
    return [];
  }
}

export async function getSearchSuggestions(query: string): Promise<any[]> {
  const cleanQuery = query?.trim();
  if (!cleanQuery || cleanQuery.length < 2) return [];

  try {
    const searchTerm = `${cleanQuery}%`;
    const response = await fetch(
      `${process.env.REACT_APP_SUPABASE_URL}/rest/v1/parts?select=part_number,part_description&part_number=ilike.${searchTerm}&limit=6`,
      {
        headers: {
          'apikey': process.env.REACT_APP_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
        }
      }
    );

    const data = await response.json();
    return (data || []).map((part: any) => ({
      type: 'part',
      value: part.part_number,
      description: part.part_description || ''
    }));
  } catch (error) {
    console.warn('Suggestions failed:', error);
    return [];
  }
}

export function clearSearchCache(): void {
  // No cache to clear in direct HTTP approach
}

export function getSearchStats() { 
  return {
    searchCacheSize: 0,
    suggestionCacheSize: 0
  }; 
}
