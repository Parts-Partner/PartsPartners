// src/providers/QueryProvider.tsx - Simple React Query setup
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create query client with optimized settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes by default
      staleTime: 5 * 60 * 1000,
      // Keep unused data in cache for 10 minutes
      gcTime: 10 * 60 * 1000,
      // Retry failed requests twice
      retry: 2,
      // Don't refetch on window focus for better UX
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Retry mutations once
      retry: 1,
    },
  },
});

// Main provider component
export const QueryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

// Export query client for manual usage if needed
export { queryClient };