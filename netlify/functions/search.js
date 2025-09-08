const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
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

    const cleanQuery = query.trim().toLowerCase();
    const searchTerms = cleanQuery.split(/\s+/);

    const { data, error } = await supabaseAdmin.rpc('search_parts', {
      search_terms: searchTerms,
      full_query: cleanQuery,
      category: category && category !== 'all' ? category : null,
      manufacturer_id: manufacturerId && manufacturerId !== 'all' ? manufacturerId : null,
      limit_count: Number(limit)
    });

    if (error) {
      console.error('Search error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Search failed' })
      };
    }

    // Generate manufacturer facets from the results
    const facetMap = new Map();
    (data || []).forEach(part => {
      if (part.manufacturer && part.manufacturer_id) {
        const id = part.manufacturer_id;
        const name = part.manufacturer;
        const current = facetMap.get(id) || { id, name, count: 0 };
        facetMap.set(id, { ...current, count: current.count + 1 });
      }
    });

    const facets = Array.from(facetMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        data: data || [], 
        facets: facets,
        count: data?.length || 0 
      })
    };

  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error: ' + err.message })
    };
  }
};