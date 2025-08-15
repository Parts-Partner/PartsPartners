// src/components/search/Filters.tsx
import React from 'react';

export const Filters: React.FC<{
  categories: string[];
  manufacturers: { id: string; manufacturer: string }[];
  category: string; manufacturerId: string;
  onCategoryChange: (v:string)=>void; onManufacturerChange: (v:string)=>void; onApply: ()=>void;
}> = ({ categories, manufacturers, category, manufacturerId, onCategoryChange, onManufacturerChange, onApply }) => {
  return (
    <div className="flex gap-2 min-w-[460px]">
      <select value={category} onChange={e=>onCategoryChange(e.target.value)} className="px-3 py-3 border rounded-xl w-56">
        <option value="all">All Categories</option>
        {categories.map(c=> <option key={c} value={c}>{c}</option>)}
      </select>
      <select value={manufacturerId} onChange={e=>onManufacturerChange(e.target.value)} className="px-3 py-3 border rounded-xl w-56">
        <option value="all">All Manufacturers</option>
        {manufacturers.map(m=> <option key={m.id} value={m.id}>{m.manufacturer}</option>)}
      </select>
      <button onClick={onApply} className="px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold">Apply</button>
    </div>
  );
};