const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { userId } = JSON.parse(event.body || '{}');

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'User ID required' })
      };
    }

    // Fetch addresses
    const { data: addresses, error: addrError } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', userId);

    // Fetch payment methods
    let paymentMethods = [];
    const { data: pmData } = await supabase
      .from('payment_methods')
      .select('id, brand, last4, exp_month, exp_year, is_default')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (pmData) {
      paymentMethods = pmData;
    }

    // Fetch orders - try different column names
    let orders = [];
    const orderQueries = ['user_id', 'profile_id', 'customer_id'];
    
    for (const col of orderQueries) {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('id, po_number, created_at, total_amount, status, payment_status')
        .eq(col, userId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (!error && data && data.length > 0) {
        orders = data;
        break;
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        addresses: addresses || [],
        paymentMethods: paymentMethods || [],
        orders: orders || []
      })
    };
  } catch (error) {
    console.error('Profile data error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};