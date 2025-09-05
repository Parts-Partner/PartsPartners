const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Simple fuzzy matching function
function generateFuzzyVariants(term) {
  const variants = [term];
  
  // Remove one character at each position (handles extra characters)
  for (let i = 0; i < term.length; i++) {
    variants.push(term.slice(0, i) + term.slice(i + 1));
  }
  
  // Add one character at each position (handles missing characters)
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  for (let i = 0; i <= term.length; i++) {
    for (const char of chars) {
      variants.push(term.slice(0, i) + char + term.slice(i));
    }
  }
  
  // Swap adjacent characters (handles transpositions)
  for (let i = 0; i < term.length - 1; i++) {
    variants.push(
      term.slice(0, i) + 
      term[i + 1] + 
      term[i] + 
      term.slice(i + 2)
    );
  }
  
  // Remove duplicates and filter by reasonable length
  return [...new Set(variants)].filter(v => 
    v.length >= 2 && v.length <= term.length + 2
  );
}

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
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
    const { q: query, category, manufacturerId, limit = 1000 } = event.queryStringParameters || {};

    if (!query || query.trim().length < 2) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Query must be at least 2 characters' })
      };
    }

    const cleanQuery = query.trim();
    const searchTerms = cleanQuery.toLowerCase().split(/\s+/);
    const fullSearchTerm = `%${cleanQuery.toLowerCase()}%`;

    // Generate fuzzy variants for each search term
    const allSearchVariants = [];
    searchTerms.forEach(term => {
      if (term.length >= 3) { // Only generate variants for terms 3+ chars
        const variants = generateFuzzyVariants(term);
        allSearchVariants.push(...variants);
      } else {
        allSearchVariants.push(term); // Short terms, no fuzzy matching
      }
    });

    // Find manufacturer IDs that match search terms (including fuzzy variants)
    const manufacturerPromises = allSearchVariants.map(term => 
      supabaseAdmin
        .from('manufacturers')
        .select('id, manufacturer')
        .ilike('manufacturer', `%${term}%`)
    );

    const manufacturerResults = await Promise.all(manufacturerPromises);
    const allManufacturerIds = new Set();
    manufacturerResults.forEach(result => {
      result.data?.forEach(m => allManufacturerIds.add(m.id));
    });

    const manufacturerIds = Array.from(allManufacturerIds);

    // Build comprehensive search query
    let queryBuilder = supabaseAdmin
      .from('parts')
      .select(`
        *,
        manufacturer:manufacturer_id (
          id,
          manufacturer,
          make
        )
      `)
      .limit(Number(limit));

    // Create OR conditions for multiple search strategies
    const orConditions = [];

    // 1. Exact full query matches (highest priority)
    orConditions.push(`part_number.ilike.${fullSearchTerm}`);
    orConditions.push(`part_description.ilike.${fullSearchTerm}`);

    // 2. Individual exact term matches
    searchTerms.forEach(term => {
      orConditions.push(`part_number.ilike.%${term}%`);
      orConditions.push(`part_description.ilike.%${term}%`);
    });

    // 3. Fuzzy matching for individual terms
    allSearchVariants.forEach(variant => {
      if (variant !== variant.toLowerCase() || variant.length >= 3) {
        orConditions.push(`part_number.ilike.%${variant}%`);
        orConditions.push(`part_description.ilike.%${variant}%`);
      }
    });

    // 4. Manufacturer matches (from fuzzy manufacturer search)
    if (manufacturerIds.length > 0) {
      orConditions.push(`manufacturer_id.in.(${manufacturerIds.join(',')})`);
    }

    // Apply the search conditions
    queryBuilder = queryBuilder.or(orConditions.join(','));

    // Apply additional filters
    if (category && category !== 'all') {
      queryBuilder = queryBuilder.eq('category', category);
    }

    if (manufacturerId && manufacturerId !== 'all') {
      queryBuilder = queryBuilder.eq('manufacturer_id', manufacturerId);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      console.error('Search error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Search failed' })
      };
    }

    // Sort results by relevance (exact matches first)
    const sortedData = (data || []).sort((a, b) => {
      const aPartExact = a.part_number?.toLowerCase().includes(cleanQuery.toLowerCase()) ? 1 : 0;
      const bPartExact = b.part_number?.toLowerCase().includes(cleanQuery.toLowerCase()) ? 1 : 0;
      const aDescExact = a.part_description?.toLowerCase().includes(cleanQuery.toLowerCase()) ? 1 : 0;
      const bDescExact = b.part_description?.toLowerCase().includes(cleanQuery.toLowerCase()) ? 1 : 0;
      
      const aScore = aPartExact * 2 + aDescExact;
      const bScore = bPartExact * 2 + bDescExact;
      
      return bScore - aScore;
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        data: sortedData,
        count: sortedData.length 
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};