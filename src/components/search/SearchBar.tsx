// src/components/search/SearchBar.tsx
import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle, useMemo } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { debounce } from 'lodash';
import { getSuggestionsWithCache } from 'services/cachedPartsService';
import { rateLimitUtils, RateLimitError } from 'lib/rateLimiting';

type Suggestion = { type: 'part' | 'manufacturer'; value: string; description: string; score?: number };

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (q: string) => void;
  placeholder?: string;
}

const SearchBarComponent = forwardRef<{ clearSuggestions: () => void }, Props>(({ value, onChange, onSubmit, placeholder }, ref) => {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(-1);
  const [debouncedValue, setDebouncedValue] = useState(value);
  const [suggestionsRateLimited, setSuggestionsRateLimited] = useState(false);
  const [rateLimitRetryAfter, setRateLimitRetryAfter] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounce the search value to reduce API calls
  const debouncedSetValue = useMemo(
    () => debounce((val: string) => {
      setDebouncedValue(val);
    }, 300), // 300ms delay
    []
  );

  // Update debounced value when input changes
  useEffect(() => {
    debouncedSetValue(value);
    return () => {
      debouncedSetValue.cancel();
    };
  }, [value, debouncedSetValue]);

  // Rate limit countdown timer
  useEffect(() => {
    if (rateLimitRetryAfter > 0) {
      const timer = setInterval(() => {
        setRateLimitRetryAfter(prev => {
          if (prev <= 1) {
            setSuggestionsRateLimited(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [rateLimitRetryAfter]);

  // React Query for suggestions with caching and rate limiting
  const { 
    data: sugs = [], 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['suggestions', debouncedValue],
    queryFn: async () => {
      try {
        setSuggestionsRateLimited(false); // Reset rate limit state on new request
        return await getSuggestionsWithCache(debouncedValue);
      } catch (error) {
        if (rateLimitUtils.isRateLimitError(error)) {
          const rateLimitError = error as RateLimitError;
          setSuggestionsRateLimited(true);
          setRateLimitRetryAfter(rateLimitError.getRetryAfterSeconds());
          
          console.warn(`🚫 Suggestions rate limited: ${rateLimitError.message}`);
          
          // Return empty array instead of throwing - less disruptive for suggestions
          return [];
        }
        throw error; // Re-throw other errors for React Query to handle
      }
    },
    enabled: debouncedValue.trim().length > 0 && !suggestionsRateLimited, // Don't fetch if rate limited
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (was cacheTime in v4)
    retry: (failureCount, error) => {
      // Don't retry rate limit errors
      if (rateLimitUtils.isRateLimitError(error)) {
        return false;
      }
      return failureCount < 1; // Only retry once for other errors
    },
    retryDelay: 1000, // Wait 1 second before retry
  });

  // Show suggestions when we have them and not loading
  useEffect(() => {
    if (sugs.length > 0 && !isLoading && !suggestionsRateLimited) {
      setOpen(true);
    } else if (!debouncedValue.trim() || suggestionsRateLimited) {
      setOpen(false);
    }
  }, [sugs, isLoading, debouncedValue, suggestionsRateLimited]);

  // Expose clearSuggestions method to parent
  useImperativeHandle(ref, () => ({
    clearSuggestions: () => {
      setOpen(false);
      setIdx(-1);
      setDebouncedValue('');
      setSuggestionsRateLimited(false);
      setRateLimitRetryAfter(0);
    }
  }));

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (!listRef.current || !inputRef.current) return;
      if (!listRef.current.contains(e.target as Node) && !inputRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, []);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === 'Enter') onSubmit(value);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIdx((i) => Math.min(i + 1, sugs.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (idx >= 0 && sugs[idx]) {
        const v = sugs[idx].value;
        onChange(v);
        setOpen(false);
        onSubmit(v);
      } else {
        onSubmit(value);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setIdx(-1);
    }
  };

  const handleClear = () => {
    onChange('');
    setOpen(false);
    setIdx(-1);
    setDebouncedValue('');
    setSuggestionsRateLimited(false);
    setRateLimitRetryAfter(0);
    inputRef.current?.focus();
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    onChange(suggestion.value);
    setOpen(false);
    setIdx(-1);
    onSubmit(suggestion.value);
  };

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        onFocus={() => { 
          if (sugs.length > 0 && debouncedValue.trim() && !suggestionsRateLimited) {
            setOpen(true); 
          }
        }}
        placeholder={placeholder || "Search parts, manufacturers, models… (try: vulcan igniter, AT0A-2779)"}
        className="w-full pl-4 pr-28 py-3 border-2 border-red-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
        autoComplete="off"
      />

      {/* Clear button */}
      {value && (
        <button
          onClick={handleClear}
          className="absolute right-24 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Clear search"
          type="button"
        >
          <X size={16} />
        </button>
      )}

      {/* Right red search button with rate limit indicator */}
      <button
        onClick={() => onSubmit(value)}
        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
        type="button"
      >
        <SearchIcon size={16} />
      </button>

      {/* Loading indicator */}
      {isLoading && debouncedValue.trim() && !suggestionsRateLimited && (
        <div className="absolute right-28 top-1/2 -translate-y-1/2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
        </div>
      )}

      {/* Rate limit indicator */}
      {suggestionsRateLimited && (
        <div 
          className="absolute right-28 top-1/2 -translate-y-1/2 text-orange-500" 
          title={`Suggestions temporarily limited. Try again in ${rateLimitRetryAfter}s`}
        >
          ⚠️
        </div>
      )}

      {/* Suggestions dropdown */}
      {open && sugs.length > 0 && !suggestionsRateLimited && (
        <div
          ref={listRef}
          className="absolute z-[60] mt-1 w-full bg-white border-2 border-red-600 rounded-xl shadow-lg max-h-72 overflow-auto"
        >
          {sugs.map((s, i) => (
            <button
              key={`${s.type}-${s.value}-${i}`}
              onMouseDown={(e) => { 
                e.preventDefault(); 
                handleSuggestionClick(s);
              }}
              onMouseEnter={() => setIdx(i)}
              className={`w-full text-left px-3 py-2 border-b last:border-b-0 transition-colors ${
                i === idx ? 'bg-red-50' : 'hover:bg-gray-50'
              }`}
              type="button"
            >
              <div className="flex items-center gap-2">
                <span className={`text-[10px] leading-4 px-1 rounded font-medium ${
                  s.type === 'part' 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'bg-green-50 text-green-700'
                }`}>
                  {s.type === 'part' ? 'PART' : 'MFG'}
                </span>
                <div className="flex-1">
                  <div className="font-medium text-sm text-gray-900">{s.value}</div>
                  <div className="text-xs text-gray-500">{s.description}</div>
                </div>
                {s.score && (
                  <div className="text-xs text-gray-400">
                    {Math.round(s.score * 100)}%
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Rate limit notification */}
      {suggestionsRateLimited && debouncedValue.trim() && (
        <div className="absolute z-[60] mt-1 w-full bg-orange-50 border-2 border-orange-200 rounded-xl shadow-lg p-3">
          <div className="flex items-center gap-2">
            <span className="text-orange-500">⚠️</span>
            <div className="flex-1">
              <div className="text-sm text-orange-800 font-medium">Suggestions Temporarily Limited</div>
              <div className="text-xs text-orange-700">
                Please slow down your typing. Suggestions will resume in {rateLimitRetryAfter}s.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error state (for non-rate-limit errors) */}
      {error && debouncedValue.trim() && !suggestionsRateLimited && !rateLimitUtils.isRateLimitError(error) && (
        <div className="absolute z-[60] mt-1 w-full bg-white border-2 border-red-200 rounded-xl shadow-lg p-3">
          <div className="text-sm text-red-600">
            Unable to load suggestions. Please try again.
          </div>
        </div>
      )}
    </div>
  );
});

SearchBarComponent.displayName = 'SearchBar';

export { SearchBarComponent as SearchBar };
export default SearchBarComponent;