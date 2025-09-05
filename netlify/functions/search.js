// search.js - Optimized with Postgres trigram similarity
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

// IMPORTANT: Make sure you’ve enabled pg_trgm extension and indexes in your DB:
//   CREATE EXTENSION IF NOT EXISTS pg_trgm;
//   CREATE INDEX IF NOT EXISTS parts_part_number_trgm_idx ON parts USING gin (part_number gin_trgm_ops);
//   CREATE INDEX IF NOT EXISTS parts_description_trgm_idx ON parts USING gin (part_description gin_trgm_ops);
//   CREATE INDEX IF NOT EXISTS manufacturers_name_trgm_idx ON manufacturers USING gin (manufacturer gin_trgm_ops);

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

    const { data, error } = await supabaseAdmin.rpc('exec_sql', {
      sql,
      params
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
      body: JSON.stringify({ data, count: data?.length || 0 })
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
