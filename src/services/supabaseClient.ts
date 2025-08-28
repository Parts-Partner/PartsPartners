// src/services/supabaseClient.ts - Debug version
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY as string;

// Debug: Log the environment variables
console.log('🔍 Supabase URL:', SUPABASE_URL);
console.log('🔍 Supabase Key:', SUPABASE_ANON_KEY ? `Present (${SUPABASE_ANON_KEY.length} chars)` : 'Missing');
console.log('🔍 Environment variables loaded:', {
  hasUrl: !!SUPABASE_URL,
  hasKey: !!SUPABASE_ANON_KEY,
  nodeEnv: process.env.NODE_ENV
});

// Check if environment variables are properly loaded
if (!SUPABASE_URL) {
  console.error('❌ REACT_APP_SUPABASE_URL is not defined');
  console.error('❌ Check your .env file and restart your dev server');
}

if (!SUPABASE_ANON_KEY) {
  console.error('❌ REACT_APP_SUPABASE_ANON_KEY is not defined');
  console.error('❌ Check your .env file and restart your dev server');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Debug: Test the client connection immediately
console.log('🔄 Testing Supabase connection...');
supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    console.error('❌ Supabase client connection error:', error);
  } else {
    console.log('✅ Supabase client connected successfully');
    console.log('✅ Current session:', data.session ? 'User logged in' : 'No active session');
  }
}).catch(err => {
  console.error('❌ Supabase client initialization failed:', err);
});