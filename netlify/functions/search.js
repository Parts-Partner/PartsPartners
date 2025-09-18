// netlify/functions/search.js - Enhanced with manufacturer + part combinations
// IMPORTANT: This preserves all existing functionality while adding new features
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Parse search query to detect manufacturer + part combinations
function parseSearchQuery(query) {
  const trimmed = query.trim();
  
  // Common manufacturer names that users might type
  const commonMfgs = [
    'frymaster', 'hobart', 'vulcan', 'cleveland', 'manitowoc', 'southbend',
    'garland', 'imperial', 'wells', 'hatco', 'duke', 'alto', 'shaam', 'blodgett'
  ];
  
  // Check if query contains manufacturer + something else (word boundary matching)
  for (const mfg of commonMfgs) {
    const mfgLower = mfg.toLowerCase();
    const queryLower = trimmed.toLowerCase();
    
    // Create regex for word boundary matching to avoid partial matches
    const mfgRegex = new RegExp(`\\b${mfgLower}\\b`);
    const match = queryLower.match(mfgRegex);
    
    if (match) {
      const mfgIndex = match.index;
      
      // Extract manufacturer and remaining part
      const beforeMfg = trimmed.substring(0, mfgIndex).trim();
      const afterMfg = trimmed.substring(mfgIndex + mfg.length).trim();
      
      // Determine which part is the manufacturer and which is the search term
      let manufacturerName = mfg;
      let searchTerm = '';
      
      if (beforeMfg && afterMfg) {
        // Both sides have content, prefer after manufacturer
        searchTerm = afterMfg;
      } else if (beforeMfg) {
        searchTerm = beforeMfg;
      } else if (afterMfg) {
        searchTerm = afterMfg;
      }
      
      // Clean up search term (remove common separators)
      searchTerm = searchTerm.replace(/^[\s\-\+]+|[\s\-\+]+$/g, '');
      
      if (searchTerm.length >= 2) {
        return {
          type: 'manufacturer_plus_search',
          manufacturer: manufacturerName,
          searchTerm: searchTerm,
          originalQuery: trimmed
        };
      }
    }
  }
  
  // No manufacturer combination detected - use existing logic
  return {
    type: 'standard',
    searchTerm: trimmed,
    originalQuery: trimmed
  };
}

exports.handler = async (event, context) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const params = event.queryStringParameters || {};
    const rawQuery = params.q?.trim();
    const limit = parseInt(params.limit) || 50;
    const category = params.category;
    const manufacturerId = params.manufacturerId;

    if (!rawQuery || rawQuery.length < 2) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Query must be at least 2 characters long',
          data: [],
          facets: [],
          count: 0
        })
      };
    }

    // Parse the query to detect manufacturer combinations
    const parsedQuery = parseSearchQuery(rawQuery);
    
    let searchData;
    let searchError;

    if (parsedQuery.type === 'manufacturer_plus_search') {
      // Enhanced search: manufacturer + part/keyword
      console.log(`Enhanced search: ${parsedQuery.manufacturer} + ${parsedQuery.searchTerm}`);
      
      // First, get manufacturer ID
      const { data: mfgData, error: mfgError } = await supabase
        .from('manufacturers')
        .select('id')
        .ilike('manufacturer', `%${parsedQuery.manufacturer}%`)
        .limit(1);
      
      if (mfgError) {
        // Fall back to standard search if manufacturer lookup fails
        console.warn('Manufacturer lookup failed, falling back to standard search');
        const { data, error } = await supabase.rpc('search_parts_with_manufacturers', {
          search_query: parsedQuery.originalQuery,
          category_filter: category === 'all' || !category ? null : category,
          manufacturer_filter: manufacturerId === 'all' || !manufacturerId ? null : manufacturerId
        });
        searchData = data;
        searchError = error;
      } else if (mfgData && mfgData.length > 0) {
        // Search with specific manufacturer + search term
        const { data, error } = await supabase.rpc('search_parts_with_manufacturers', {
          search_query: parsedQuery.searchTerm,
          category_filter: category === 'all' || !category ? null : category,
          manufacturer_filter: mfgData[0].id
        });
        searchData = data;
        searchError = error;
      } else {
        // Manufacturer not found, fall back to standard search
        console.warn(`Manufacturer '${parsedQuery.manufacturer}' not found, falling back to standard search`);
        const { data, error } = await supabase.rpc('search_parts_with_manufacturers', {
          search_query: parsedQuery.originalQuery,
          category_filter: category === 'all' || !category ? null : category,
          manufacturer_filter: manufacturerId === 'all' || !manufacturerId ? null : manufacturerId
        });
        searchData = data;
        searchError = error;
      }
    } else {
      // Standard search (existing functionality - UNCHANGED)
      const { data, error } = await supabase.rpc('search_parts_with_manufacturers', {
        search_query: parsedQuery.searchTerm,
        category_filter: category === 'all' || !category ? null : category,
        manufacturer_filter: manufacturerId === 'all' || !manufacturerId ? null : manufacturerId
      });
      searchData = data;
      searchError = error;
    }

    if (searchError) {
      console.error('RPC search error:', searchError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Search failed',
          details: searchError.message,
          data: [],
          facets: [],
          count: 0
        })
      };
    }

    // Transform the data (UNCHANGED - preserves existing working logic)
    const transformedData = (searchData || []).map(item => ({
      id: item.id || 'unknown',
      part_number: item.part_number || 'N/A',
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
      manufacturer_name: item.manufacturer_name || '',
      make: item.make || ''
    }));

    // Safe sorting (UNCHANGED - preserves existing working logic)
    const sortedData = transformedData.sort((a, b) => {
      const nameA = a.part_number || '';
      const nameB = b.part_number || '';
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
    });

    // Limit results
    const limitedData = sortedData.slice(0, limit);

    // Generate facets (UNCHANGED - preserves existing working logic)
    const facets = [];
    const manufacturerCounts = {};
    
    limitedData.forEach(item => {
      const mfgName = item.manufacturer_name || 'Unknown';
      manufacturerCounts[mfgName] = (manufacturerCounts[mfgName] || 0) + 1;
    });

    Object.entries(manufacturerCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .forEach(([name, count]) => {
        facets.push({
          id: name.toLowerCase().replace(/\s+/g, '-'),
          name: name,
          count: count
        });
      });

    const response = {
      data: limitedData,
      facets: facets,
      count: limitedData.length
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('Unexpected search error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message,
        data: [],
        facets: [],
        count: 0
      })
    };
  }
};