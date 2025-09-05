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
    const { q: query, category, manufacturerId, limit = 50 } =
      event.queryStringParameters || {};

    if (!query || query.trim().length < 2) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Query must be at least 2 characters' })
      };
    }

    const cleanQuery = query.trim().toLowerCase();
    const searchTerms = cleanQuery.split(/\s+/);

    const { data, error } = await supabaseAdmin.rpc('search_parts_with_facets', {
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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        data: data.data || [],
        facets: data.facets || [],
        count: data.data?.length || 0
      })
    };

  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};