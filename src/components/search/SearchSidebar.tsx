import React from 'react';
import { SearchBar } from 'components/search/SearchBarComponent';
import { X } from 'lucide-react';

interface Facet {
  id: string;
  name: string;
  count: number;
}

interface SearchSidebarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit: (query: string) => void;
  manufacturerFacets: Facet[];
  selectedManufacturerId: string | null;
  onManufacturerSelect: (manufacturerId: string | null) => void;
  totalResults: number;
}

export const SearchSidebar: React.FC<SearchSidebarProps> = ({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  manufacturerFacets,
  selectedManufacturerId,
  onManufacturerSelect,
  totalResults
}) => {
  return (
    <div className="w-80 bg-white border-r border-gray-200 p-6 h-full overflow-y-auto">
      {/* Search within results */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Search Parts</h3>
        <SearchBar
          value={searchQuery}
          onChange={onSearchChange}
          onSubmit={onSearchSubmit}
          placeholder="Search parts, manufacturers..."
        />
      </div>

      {/* Results count */}
      <div className="mb-6 text-sm text-gray-600">
        {totalResults.toLocaleString()} parts found
      </div>

      {/* Manufacturer filter */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Manufacturer</h3>
          {selectedManufacturerId && (
            <button
              onClick={() => onManufacturerSelect(null)}
              className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
            >
              <X size={12} />
              Clear
            </button>
          )}
        </div>
        
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {manufacturerFacets.map((facet) => (
            <button
              key={facet.id}
              onClick={() => onManufacturerSelect(
                selectedManufacturerId === facet.id ? null : facet.id
              )}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                selectedManufacturerId === facet.id
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium truncate">
                  {facet.name}
                </span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  selectedManufacturerId === facet.id
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {facet.count}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};