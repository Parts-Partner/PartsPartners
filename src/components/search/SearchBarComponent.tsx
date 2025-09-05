// src/components/search/SearchBar.tsx - Simplified and reliable
import React, { useState, useRef, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { debounce } from 'lodash';
import { getSearchSuggestions } from 'services/searchService';

interface Suggestion {
  type: 'part' | 'manufacturer';
  value: string;
  description: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (query: string) => void;
  placeholder?: string;
}

// Export methods that the Header expects
export interface SearchBarRef {
  clearSuggestions: () => void;
}

const SearchBarComponent = forwardRef<SearchBarRef, Props>(({ 
  value, 
  onChange, 
  onSubmit, 
  placeholder = "Search parts, manufacturers, models..." 
}, ref) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [debouncedValue, setDebouncedValue] = useState('');
  
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Expose methods to parent component via ref
  useImperativeHandle(ref, () => ({
    clearSuggestions: () => {
      setShowSuggestions(false);
      setSelectedIndex(-1);
      setDebouncedValue('');
    }
  }));

  // Debounce input for suggestions
  const debouncedSetValue = useMemo(
    () => debounce((val: string) => setDebouncedValue(val), 300),
    []
  );

  useEffect(() => {
    debouncedSetValue(value);
    return () => debouncedSetValue.cancel();
  }, [value, debouncedSetValue]);

  // Fetch suggestions
  const { data: suggestions = [] } = useQuery({
    queryKey: ['suggestions', debouncedValue],
    queryFn: () => getSearchSuggestions(debouncedValue),
    enabled: debouncedValue.trim().length >= 2,
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
    retry: false // Don't retry suggestions
  });

  // Show/hide suggestions based on data and focus
  useEffect(() => {
    if (suggestions.length > 0 && debouncedValue.trim().length >= 2) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [suggestions, debouncedValue]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        inputRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') {
        onSubmit(value);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
        
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          const selected = suggestions[selectedIndex];
          onChange(selected.value);
          setShowSuggestions(false);
          setSelectedIndex(-1);
          onSubmit(selected.value);
        } else {
          onSubmit(value);
        }
        break;
        
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: Suggestion) => {
    onChange(suggestion.value);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    onSubmit(suggestion.value);
  };

  // Clear input
  const handleClear = () => {
    onChange('');
    setShowSuggestions(false);
    setSelectedIndex(-1);
    setDebouncedValue('');
    inputRef.current?.focus();
  };

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0 && debouncedValue.trim().length >= 2) {
            setShowSuggestions(true);
          }
        }}
        placeholder={placeholder}
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

      {/* Search button */}
      <button
        onClick={() => onSubmit(value)}
        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
        type="button"
      >
        <SearchIcon size={16} />
      </button>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 mt-1 w-full bg-white border-2 border-red-600 rounded-xl shadow-lg max-h-72 overflow-auto"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.type}-${suggestion.value}-${index}`}
              onClick={() => handleSuggestionClick(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`w-full text-left px-3 py-2 border-b last:border-b-0 transition-colors ${
                index === selectedIndex ? 'bg-red-50' : 'hover:bg-gray-50'
              }`}
              type="button"
            >
              <div className="flex items-center gap-2">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  suggestion.type === 'part' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-green-100 text-green-700'
                }`}>
                  {suggestion.type === 'part' ? 'PART' : 'MFG'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900 truncate">
                    {suggestion.value}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {suggestion.description}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

SearchBarComponent.displayName = 'SearchBar';

export { SearchBarComponent as SearchBar };
export default SearchBarComponent;