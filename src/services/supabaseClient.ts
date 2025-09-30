// src/services/supabaseClient.ts - Clean and reliable
import { createClient } from '@supabase/supabase-js';

console.log('ENV CHECK:', {
  url: process.env.REACT_APP_SUPABASE_URL,
  key: process.env.REACT_APP_SUPABASE_ANON_KEY?.substring(0, 20) + '...'
});

// Add global type for debugging
declare global {
  interface Window {
    supabase: any;
  }
}

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY as string;

// Only log in development
if (process.env.NODE_ENV === 'development') {
  console.log('🔍 Supabase Config Check:');
  console.log('URL:', SUPABASE_URL ? '✅ Present' : '❌ Missing');
  console.log('Key:', SUPABASE_ANON_KEY ? '✅ Present' : '❌ Missing');
}

// Validate required environment variables
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  const message = 'Missing required Supabase environment variables. Check your .env file.';
  console.error('❌', message);
  
  // In development, show helpful error
  if (process.env.NODE_ENV === 'development') {
    console.error('Required variables:');
    console.error('- REACT_APP_SUPABASE_URL');
    console.error('- REACT_APP_SUPABASE_ANON_KEY');
  }
  
  // Don't crash the app - create a client that will gracefully fail
}

// Create the Supabase client
export const supabase = createClient(
  SUPABASE_URL || '',
  SUPABASE_ANON_KEY || '',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  }
);

// Simple connection test in development only
if (process.env.NODE_ENV === 'development' && SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase.auth.getSession()
    .then(({ error }) => {
      if (error) {
        console.error('❌ Supabase connection failed:', error.message);
      } else {
        console.log('✅ Supabase connected successfully');
      }
    })
    .catch(() => {
      console.error('❌ Supabase connection test failed');
    });
}

// Add to window for debugging
if (typeof window !== 'undefined') {
  window.supabase = supabase;
  console.log('✅ Supabase client attached to window');
}