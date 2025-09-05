// Your exact original + facets only
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
    const { q: query, category, manufacturerId, limit = 1000 } =
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

    // Build raw SQL with trigram similarity
    // Strategy:
    //  - Match manufacturer name, part number, part description
    //  - Rank by highest similarity
    //  - Support multi-term (manufacturer + keyword/part number)
    const sql = `
      WITH manufacturer_matches AS (
        SELECT id
        FROM manufacturers
        WHERE manufacturer % ANY($1)
        ORDER BY GREATEST(${searchTerms.map((_, i) => `similarity(manufacturer, $1[${i + 1}])`).join(', ')}) DESC
        LIMIT 20
      )
      SELECT 
        p.*,
        m.manufacturer,
        GREATEST(
          similarity(p.part_number, $2),
          similarity(p.part_description, $2),
          similarity(m.manufacturer, $2)
        ) AS relevance
      FROM parts p
      JOIN manufacturers m ON p.manufacturer_id = m.id
      WHERE 
        (
          p.part_number % $2 OR 
          p.part_description % $2 OR
          m.manufacturer % $2 OR
          p.manufacturer_id IN (SELECT id FROM manufacturer_matches)
        )
        ${category && category !== 'all' ? `AND p.category = $3` : ''}
        ${manufacturerId && manufacturerId !== 'all' ? `AND p.manufacturer_id = $4` : ''}
      ORDER BY relevance DESC
      LIMIT $5;
    `;

    const params = [
      searchTerms, // $1: array of search tokens
      cleanQuery,  // $2: full query string
    ];

    if (category && category !== 'all') params.push(category); // $3
    if (manufacturerId && manufacturerId !== 'all') params.push(manufacturerId); // $4
    params.push(Number(limit)); // $5

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
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};