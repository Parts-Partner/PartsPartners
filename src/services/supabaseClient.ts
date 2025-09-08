// src/services/supabaseClient.ts - Fixed with better error handling
import { createClient } from '@supabase/supabase-js';

// Add this at the top of supabaseClient.ts
declare global {
  interface Window {
    supabase: any;
  }
}

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY as string;

// Debug: Log the environment variables
console.log('🔍 Supabase URL:', SUPABASE_URL ? `Present (${SUPABASE_URL.length} chars)` : 'Missing');
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
  // Don't throw in production - let the app try to continue
  if (process.env.NODE_ENV === 'development') {
    throw new Error('Missing REACT_APP_SUPABASE_URL environment variable');
  }
}

if (!SUPABASE_ANON_KEY) {
  console.error('❌ REACT_APP_SUPABASE_ANON_KEY is not defined');
  console.error('❌ Check your .env file and restart your dev server');
  // Don't throw in production - let the app try to continue
  if (process.env.NODE_ENV === 'development') {
    throw new Error('Missing REACT_APP_SUPABASE_ANON_KEY environment variable');
  }
}

// Create client with fallback values to prevent crashes
const supabaseUrl = SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Debug: Test the client connection immediately with error handling
console.log('🔄 Testing Supabase connection...');

// Wrap the connection test in a try-catch and timeout
const testConnection = async () => {
  try {
    // Add a timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), 10000)
    );
    
    const sessionPromise = supabase.auth.getSession();
    
    const { data, error } = await Promise.race([sessionPromise, timeoutPromise]) as any;
    
    if (error) {
      console.error('❌ Supabase client connection error:', error);
      // Don't throw - just log the error
    } else {
      console.log('✅ Supabase client connected successfully');
      console.log('✅ Current session:', data?.session ? 'User logged in' : 'No active session');
    }
  } catch (err) {
    console.error('❌ Supabase client initialization failed:', err);
    // Don't throw - just log the error to prevent app crashes
  }
};

// Only test connection in development or if we have valid credentials
if ((SUPABASE_URL && SUPABASE_ANON_KEY) || process.env.NODE_ENV === 'development') {
  testConnection();
}

// Add this at the bottom of src/services/supabaseClient.ts
if (typeof window !== 'undefined') {
  window.supabase = supabase;
}