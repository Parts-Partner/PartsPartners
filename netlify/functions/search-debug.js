// netlify/functions/search-debug.js - Simple version to isolate the error
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

exports.handler = async (event, context) => {
  console.log('🔍 DEBUG: Search function started');
  console.log('Query params:', event.queryStringParameters);

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Step 1: Check environment variables
    console.log('🔍 ENV CHECK:');
    console.log('URL exists:', !!supabaseUrl);
    console.log('Key exists:', !!supabaseAnonKey);

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ Missing Supabase environment variables');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Missing environment variables',
          data: [], facets: [], count: 0
        })
      };
    }

    // Step 2: Create Supabase client
    console.log('🔍 Creating Supabase client...');
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Step 3: Get query parameters
    const params = event.queryStringParameters || {};
    const query = params.q?.trim() || '150'; // Default to '150' for testing
    
    console.log('🔍 Search query:', query);

    // Step 4: Test simple query first
    console.log('🔍 Testing simple parts query...');
    const { data: simpleData, error: simpleError } = await supabase
      .from('parts')
      .select('id, part_number, part_description')
      .ilike('part_number', `%${query}%`)
      .limit(5);

    if (simpleError) {
      console.error('❌ Simple query failed:', simpleError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Simple query failed',
          details: simpleError.message,
          data: [], facets: [], count: 0
        })
      };
    }

    console.log('✅ Simple query success:', simpleData?.length, 'results');

    // Step 5: Test RPC function
    console.log('🔍 Testing RPC function...');
    const { data: rpcData, error: rpcError } = await supabase.rpc('search_parts_with_manufacturers', {
      search_query: query,
      category_filter: null,
      manufacturer_filter: null
    });

    if (rpcError) {
      console.error('❌ RPC query failed:', rpcError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'RPC query failed',
          details: rpcError.message,
          data: simpleData || [], // Fall back to simple data
          facets: [],
          count: simpleData?.length || 0
        })
      };
    }

    console.log('✅ RPC query success:', rpcData?.length, 'results');

    // Step 6: Test data processing (this is where sorting might fail)
    console.log('🔍 Testing data processing...');
    
    const processedData = (rpcData || []).map((item, index) => {
      console.log(`Processing item ${index}:`, {
        id: item.id,
        part_number: item.part_number,
        manufacturer_name: item.manufacturer_name
      });

      return {
        id: item.id || 'unknown',
        part_number: item.part_number || 'N/A',
        part_description: item.part_description || '',
        category: item.category || '',
        list_price: item.list_price || '0',
        compatible_models: item.compatible_models || [],
        image_url: item.image_url,
        in_stock: Boolean(item.in_stock),
        manufacturer_name: item.manufacturer_name || '',
        make: item.make || ''
      };
    });

    console.log('✅ Data processing success:', processedData.length, 'items');

    // Step 7: Test sorting (this is likely where it crashes)
    console.log('🔍 Testing sorting...');
    
    // Safe sorting without localeCompare
    const sortedData = processedData.sort((a, b) => {
      const nameA = String(a.part_number || '');
      const nameB = String(b.part_number || '');
      return nameA.localeCompare(nameB);
    });

    console.log('✅ Sorting success');

    // Step 8: Test facet generation
    console.log('🔍 Testing facet generation...');
    
    const facets = [];
    const manufacturerCounts = {};
    
    sortedData.forEach(item => {
      const mfgName = item.manufacturer_name || 'Unknown';
      manufacturerCounts[mfgName] = (manufacturerCounts[mfgName] || 0) + 1;
    });

    Object.entries(manufacturerCounts).forEach(([name, count]) => {
      facets.push({
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name: name,
        count: count
      });
    });

    console.log('✅ Facet generation success:', facets.length, 'facets');

    const response = {
      data: sortedData.slice(0, 50), // Limit results
      facets: facets,
      count: sortedData.length
    };

    console.log('✅ DEBUG: Function completed successfully');
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('❌ DEBUG: Unexpected error:', error);
    console.error('Error stack:', error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Debug function failed',
        message: error.message,
        stack: error.stack,
        data: [], facets: [], count: 0
      })
    };
  }
};