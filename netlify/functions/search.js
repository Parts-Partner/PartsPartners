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
    const { q: query, category, manufacturerId, limit = 200 } = event.queryStringParameters || {};

    if (!query || query.trim().length < 2) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Query must be at least 2 characters' })
      };
    }

    const cleanQuery = query.trim();
    const searchTerm = `%${cleanQuery.toLowerCase()}%`;
    
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
      .or(`part_number.ilike.${searchTerm},part_description.ilike.${searchTerm}`)
      .limit(Number(limit));

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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        data: data || [],
        count: data?.length || 0 
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