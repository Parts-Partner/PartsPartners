// src/app/layout/Header.tsx - Complete updated version with onSearch prop
import React, { useEffect, useRef, useState } from 'react';
import { ShoppingCart, User, LogOut } from 'lucide-react';
import { useCart } from 'context/CartContext';
import { useAuth } from 'context/AuthContext';
import { SearchBar, SearchBarRef } from 'components/search/SearchBarComponent';
import { Filters } from 'components/search/Filters';
import { listCategories, listManufacturers } from 'services/partsService';

// UPDATED: Add onSearch to Props interface
type Props = { 
  onNav: (page: string) => void; 
  onOpenCart: () => void;
  onSearch: (query: string, category?: string, manufacturerId?: string) => void;
};

export const Header: React.FC<Props> = ({ onNav, onOpenCart, onSearch }) => {
  const { count } = useCart();
  const { user, logout } = useAuth();

  const [q, setQ] = useState('');
  const [qCompact, setQCompact] = useState('');
  const [category, setCategory] = useState('all');
  const [manufacturerId, setManufacturerId] = useState('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [manufacturers, setManufacturers] = useState<{ id: string; manufacturer: string }[]>([]);

  const [showCompact, setShowCompact] = useState(false);
  const compactSearchRef = useRef<SearchBarRef>(null);

  const [showBulkMain, setShowBulkMain] = useState(false);
  const [showBulkCompact, setShowBulkCompact] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const flyoutMainRef = useRef<HTMLDivElement>(null);
  const flyoutCompactRef = useRef<HTMLDivElement>(null);
  const btnMainRef = useRef<HTMLButtonElement>(null);
  const btnCompactRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const [cats, mfgs] = await Promise.all([listCategories(), listManufacturers()]);
        setCategories(cats);
        setManufacturers(mfgs);
      } catch (e) {
        console.error('Header filters load failed', e);
      }
    })();
  }, []);

  // Watch the main header to toggle compact header
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        const wasCompact = showCompact;
        const isCompact = !entry.isIntersecting;
        
        setShowCompact(isCompact);
        
        if (wasCompact && !isCompact && compactSearchRef.current?.clearSuggestions) {
          compactSearchRef.current.clearSuggestions();
        }
      },
      { 
        rootMargin: '0px',
        threshold: 0
      }
    );
    
    if (headerRef.current) {
      observer.observe(headerRef.current);
    }
    
    return () => observer.disconnect();
  }, [showCompact]);

  // Close bulk flyouts on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      
      if (showBulkMain) {
        if (!flyoutMainRef.current?.contains(t) && !btnMainRef.current?.contains(t)) {
          setShowBulkMain(false);
        }
      }
      
      if (showBulkCompact) {
        if (!flyoutCompactRef.current?.contains(t) && !btnCompactRef.current?.contains(t)) {
          setShowBulkCompact(false);
        }
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [showBulkMain, showBulkCompact]);

  // UPDATED: Use direct function calls instead of events
  const handleMainSearchSubmit = (val: string) => {
    onSearch(val, category, manufacturerId);
  };

  const handleCompactSearchSubmit = (val: string) => {
    onSearch(val, category, manufacturerId);
  };

  const handleLogout = async () => {
    try {
      await logout();
      onNav('home');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const goToHomepage = () => {
    // Reset header search state
    setQ('');
    setQCompact('');
    setCategory('all');
    setManufacturerId('all');
    
    if (compactSearchRef.current?.clearSuggestions) {
      compactSearchRef.current.clearSuggestions();
    }
    
    onNav('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitBulk = () => {
    if (!bulkText.trim()) return;
    
    console.log('📋 Header: Submitting bulk text:', bulkText);
    
    setShowBulkMain(false);
    setShowBulkCompact(false);
    
    window.dispatchEvent(new CustomEvent('pp:showBulkOrderModal', { 
      detail: { initialText: bulkText } 
    }));
    
    setBulkText('');
  };

  // Apply filters and trigger search
  const applyFilters = () => {
    const searchQuery = q || qCompact;
    if (searchQuery.trim()) {
      onSearch(searchQuery, category, manufacturerId);
    }
  };

  const Brand = (
    <button
      onClick={goToHomepage}
      className="group flex items-center gap-2 cursor-pointer"
      aria-label="Go to home"
    >
      <img
        src="https://xarnvryaicseavgnmtjn.supabase.co/storage/v1/object/public/assets//Logo_Rev1.png"
        alt="Parts Partner Logo"
        className="h-24 w-24 rounded bg-white object-contain"
      />
      <div className="leading-tight text-left">
        <div className="text-3xl font-bold tracking-tight text-slate-900">Parts Partners</div>
      </div>
    </button>
  );

  const Icons = (
    <div className="flex items-center gap-2">
      <button
        className="relative p-2 rounded text-slate-700 hover:bg-gray-100"
        onClick={onOpenCart}
        aria-label="Open cart"
      >
        <ShoppingCart />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 text-[10px] bg-red-600 text-white rounded-full px-1">
            {count}
          </span>
        )}
      </button>

      {user ? (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNav('profile')}
            className="flex items-center gap-2 px-3 py-2 rounded text-slate-700 hover:bg-gray-100"
          >
            <User size={18} />
            <span className="hidden sm:inline text-sm">Profile</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded text-slate-700 hover:bg-gray-100"
          >
            <LogOut size={18} />
            <span className="hidden sm:inline text-sm">Logout</span>
          </button>
        </div>
      ) : (
        <button
          onClick={() => onNav('login')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-sm"
        >
          <User size={18} />
          <span>Sign In</span>
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Main Header */}
      <header ref={headerRef} className="bg-white border-b-2 border-red-600 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-6">
            {Brand}
            
            <div className="hidden lg:flex items-center gap-4 flex-1 max-w-4xl">
              <SearchBar
                value={q}
                onChange={setQ}
                onSubmit={handleMainSearchSubmit}
              />
              
              <Filters
                categories={categories}
                manufacturers={manufacturers}
                category={category}
                manufacturerId={manufacturerId}
                onCategoryChange={setCategory}
                onManufacturerChange={setManufacturerId}
                onApply={applyFilters}
              />

              {/* Bulk Order Button */}
              <div className="relative">
                <button
                  ref={btnMainRef}
                  onClick={() => setShowBulkMain(!showBulkMain)}
                  className="flex items-center gap-2 px-4 py-3 border-2 border-blue-600 rounded-xl text-blue-600 hover:bg-blue-50 font-semibold transition-colors"
                >
                  <span>Bulk Order</span>
                </button>

                {showBulkMain && (
                  <div
                    ref={flyoutMainRef}
                    className="absolute right-0 top-full mt-2 w-80 bg-white border-2 border-blue-600 rounded-xl shadow-lg p-4 z-50"
                  >
                    <div className="mb-3 text-sm font-semibold text-gray-900">
                      Paste part numbers (one per line)
                    </div>
                    <textarea
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      placeholder="Part1&#10;Part2&#10;Part3"
                      className="w-full h-32 p-3 border rounded-lg text-sm resize-none"
                    />
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={submitBulk}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
                      >
                        Search All
                      </button>
                      <button
                        onClick={() => setShowBulkMain(false)}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {Icons}
          </div>
        </div>
      </header>

      {/* Compact Header (when scrolled) */}
      {showCompact && (
        <div className="fixed top-0 left-0 right-0 bg-white border-b-2 border-red-600 z-50 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <button onClick={goToHomepage} className="flex items-center gap-2">
                <img
                  src="https://xarnvryaicseavgnmtjn.supabase.co/storage/v1/object/public/assets//Logo_Rev1.png"
                  alt="Parts Partner"
                  className="h-8 w-8 rounded"
                />
                <span className="font-bold text-slate-900 hidden sm:inline">Parts Partners</span>
              </button>
              
              <div className="flex-1 max-w-md">
                <SearchBar
                  ref={compactSearchRef}
                  value={qCompact}
                  onChange={setQCompact}
                  onSubmit={handleCompactSearchSubmit}
                />
              </div>

              {/* Compact Bulk Order */}
              <div className="relative">
                <button
                  ref={btnCompactRef}
                  onClick={() => setShowBulkCompact(!showBulkCompact)}
                  className="flex items-center gap-1 px-3 py-2 border border-blue-600 rounded-lg text-blue-600 hover:bg-blue-50 text-sm font-semibold"
                >
                  Bulk
                </button>

                {showBulkCompact && (
                  <div
                    ref={flyoutCompactRef}
                    className="absolute right-0 top-full mt-2 w-80 bg-white border-2 border-blue-600 rounded-xl shadow-lg p-4 z-50"
                  >
                    <div className="mb-3 text-sm font-semibold text-gray-900">
                      Paste part numbers (one per line)
                    </div>
                    <textarea
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      placeholder="Part1&#10;Part2&#10;Part3"
                      className="w-full h-32 p-3 border rounded-lg text-sm resize-none"
                    />
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={submitBulk}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
                      >
                        Search All
                      </button>
                      <button
                        onClick={() => setShowBulkCompact(false)}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {Icons}
            </div>
          </div>
        </div>
      )}
    </>
  );
};