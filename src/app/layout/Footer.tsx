// src/app/layout/Footer.tsx
import React from 'react';

export const Footer: React.FC<{ onNav: (page: string)=>void }> = ({ onNav }) => (
  <footer className="bg-gray-50 border-t mt-auto">
    <div className="max-w-7xl mx-auto px-4 py-6 text-center text-sm text-gray-600 flex flex-wrap gap-3 justify-center">
      {[
        ['Privacy Policy','privacy'],['Terms of Service','terms'],['Cookie Policy','cookies'],
        ['Accessibility','accessibility'],['Shipping & Returns','shipping'],['Contact Us','contact']
      ].map(([label, page])=> (
        <button key={page} onClick={()=>onNav(page)} className="text-gray-600 hover:text-gray-900">{label}</button>
      ))}
      <span className="text-gray-400">|</span>
      <span>© 2025 Parts Partners. All rights reserved.</span>
    </div>
  </footer>
);