// src/hooks/useEmergencyReset.ts
// Emergency reset hook for when search gets stuck
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { resetSearchState } from 'services/cachedPartsService';

// Extend the global Window interface to include all search-related properties
declare global {
  interface Window {
    searchCount: number;
    searchHanging?: boolean;
    searchHangingTimeout?: ReturnType<typeof setTimeout>;
    lastSearchTime: number;
  }
}

export function useEmergencyReset() {
  const queryClient = useQueryClient();

  const emergencyReset = useCallback(() => {
    console.log('🚨 EMERGENCY RESET TRIGGERED');
    
    try {
      // 1. Reset search service state
      resetSearchState();
      
      // 2. Clear React Query cache
      queryClient.clear();
      
      // 3. Reset window search flags
      if (typeof window !== 'undefined') {
        window.searchCount = 0;
        window.searchHanging = false;
        window.lastSearchTime = 0;
        
        // Clear any hanging timeout
        if (window.searchHangingTimeout) {
          clearTimeout(window.searchHangingTimeout);
          delete window.searchHangingTimeout;
        }
      }
      
      // 4. Force garbage collection if available
      if (typeof window !== 'undefined' && (window as any).gc) {
        (window as any).gc();
      }
      
      // 5. Clear any pending timeouts/intervals (more conservative approach)
      // Note: This is aggressive and might clear legitimate timers
      // Consider removing this if it causes issues with other parts of your app
      const maxTimerId = 1000; // Reasonable upper bound
      for (let i = 1; i < maxTimerId; i++) {
        try {
          window.clearTimeout(i);
          window.clearInterval(i);
        } catch (e) {
          // Ignore errors from clearing non-existent timers
        }
      }
      
      console.log('✅ Emergency reset completed');
      
      // 6. Dispatch reset completion event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pp:resetComplete'));
      }
      
    } catch (error) {
      console.error('❌ Emergency reset failed:', error);
    }
  }, [queryClient]);

  return emergencyReset;
}