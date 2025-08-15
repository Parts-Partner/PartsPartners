// src/components/search/NoResults.tsx
import React from 'react';

export const NoResults: React.FC<{ onReset: ()=>void }> = ({ onReset }) => (
  <div className="bg-white border rounded-xl p-10 text-center">
    <div className="text-xl font-semibold">No parts found</div>
    <p className="text-gray-600 mt-2">Try fewer terms, a manufacturer, or a model. You can also clear filters.</p>
    <button className="mt-4 px-4 py-2 rounded bg-gray-900 text-white" onClick={onReset}>Clear filters</button>
  </div>
);