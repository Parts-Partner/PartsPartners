// netlify/functions/get-part.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const partId = event.queryStringParameters?.id;

    if (!partId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Part ID is required' })
      };
    }

    // Use the same RPC that works for search
    const { data, error } = await supabase.rpc('search_parts_with_manufacturers', {
      search_query: '',
      category_filter: null,
      manufacturer_filter: null
    });

    if (error) {
      console.error('RPC error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to fetch part' })
      };
    }

    // Find the specific part
    const part = data?.find(p => p.id === partId);

    if (!part) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Part not found' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ data: part })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};