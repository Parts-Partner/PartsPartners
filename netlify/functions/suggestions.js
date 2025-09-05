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
    const { q: query } = event.queryStringParameters || {};

    if (!query || query.trim().length < 2) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data: [] })
      };
    }

    const cleanQuery = query.trim().toLowerCase();
    const searchTerm = `${cleanQuery}%`;
    const suggestions = [];

    const { data: partsData } = await supabaseAdmin
      .from('parts')
      .select('part_number, part_description')
      .ilike('part_number', searchTerm)
      .limit(6)
      .order('part_number');

    if (partsData) {
      partsData.forEach(part => {
        suggestions.push({
          type: 'part',
          value: part.part_number,
          description: part.part_description || ''
        });
      });
    }

    const { data: mfgData } = await supabaseAdmin
      .from('manufacturers')
      .select('manufacturer')
      .ilike('manufacturer', searchTerm)
      .limit(4)
      .order('manufacturer');

    if (mfgData) {
      mfgData.forEach(mfg => {
        suggestions.push({
          type: 'manufacturer',
          value: mfg.manufacturer,
          description: 'Manufacturer'
        });
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ data: suggestions })
    };

  } catch (error) {
    console.error('Suggestions error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};