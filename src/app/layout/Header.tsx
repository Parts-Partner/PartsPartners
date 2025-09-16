// src/app/layout/Header.tsx - Fixed implicit any type errors
import React, { useEffect, useRef, useState } from 'react';
import { ShoppingCart, User, LogOut } from 'lucide-react';
import { useCart } from 'context/CartContext';
import { useAuth } from 'context/AuthContext';
import { SearchBar, SearchBarRef } from 'components/search/SearchBarComponent';
import { Filters } from 'components/search/Filters';
import { listCategories, listManufacturers } from 'services/partsService';

type Props = { onNav: (page: string) => void; onOpenCart: () => void };

export const Header: React.FC<Props> = ({ onNav, onOpenCart }) => {
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
        
        // Show compact header when main header is NOT intersecting (i.e., scrolled past)
        setShowCompact(isCompact);
        
        // If transitioning from compact to main header, clear compact search suggestions
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
      
      // Check main flyout
      if (showBulkMain) {
        if (!flyoutMainRef.current?.contains(t) && !btnMainRef.current?.contains(t)) {
          setShowBulkMain(false);
        }
      }
      
      // Check compact flyout
      if (showBulkCompact) {
        if (!flyoutCompactRef.current?.contains(t) && !btnCompactRef.current?.contains(t)) {
          setShowBulkCompact(false);
        }
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [showBulkMain, showBulkCompact]);

  const fireSearch = (payload?: { q?: string; category?: string; manufacturerId?: string }) => {
    const searchQuery = payload?.q || q || qCompact;
    const searchCategory = payload?.category || category;
    const searchManufacturerId = payload?.manufacturerId || manufacturerId;
    
    const detail = { 
      q: searchQuery, 
      category: searchCategory, 
      manufacturerId: searchManufacturerId,
      ...payload 
    };
    
    console.log('🔥 Header: Dispatching search event with detail:', detail);
    
    // Dispatch both events for compatibility
    window.dispatchEvent(new CustomEvent('pp:search', { detail }));
    window.dispatchEvent(new CustomEvent('pp:do-search', { detail }));
  };

  const handleLogout = async () => {
    try {
      await logout();
      onNav('home'); // Navigate to home instead of search
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Handle homepage navigation - updated to go to 'home' page
  const goToHomepage = () => {
    // Reset header search state
    setQ('');
    setQCompact('');
    setCategory('all');
    setManufacturerId('all');
    
    // Clear compact search suggestions if they exist
    if (compactSearchRef.current?.clearSuggestions) {
      compactSearchRef.current.clearSuggestions();
    }
    
    // Navigate to home page (not search)
    onNav('home');
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitBulk = () => {
    if (!bulkText.trim()) return;
    
    console.log('🔥 Header: Submitting bulk text:', bulkText);
    
    // Close flyouts first
    setShowBulkMain(false);
    setShowBulkCompact(false);
    
    // Dispatch event to show bulk order modal with the text
    window.dispatchEvent(new CustomEvent('pp:showBulkOrderModal', { 
      detail: { initialText: bulkText } 
    }));
    
    // Clear the text after dispatching
    setBulkText('');
  };

  // Handle search submit with explicit typing
  const handleMainSearchSubmit = (val: string) => {
    fireSearch({ q: val });
  };

  const handleCompactSearchSubmit = (val: string) => {
    fireSearch({ q: val });
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
      {/* Cart Button */}
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

      {/* Authentication Buttons */}
      {user ? (
        // User is logged in - show profile and logout buttons
        <>
          <button
            className="p-2 rounded text-slate-700 hover:bg-gray-100"
            onClick={() => onNav('profile')}
            aria-label="Profile"
            title="View Profile"
          >
            <User />
          </button>
          <button
            className="flex items-center gap-1 px-3 py-2 rounded text-slate-700 hover:bg-gray-100 text-sm font-medium"
            onClick={handleLogout}
            aria-label="Logout"
            title="Sign Out"
          >
            <LogOut size={16} />
            Logout
          </button>
        </>
      ) : (
        // User is not logged in - show login button
        <button
          className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 text-sm font-medium transition-colors"
          onClick={() => onNav('login')}
          aria-label="Login"
        >
          Login
        </button>
      )}
    </div>
  );

  const BulkFlyoutMain = showBulkMain && (
    <div
      ref={flyoutMainRef}
      onMouseEnter={() => setShowBulkMain(true)}
      onMouseLeave={() => setShowBulkMain(false)}
      className="absolute right-0 mt-2 w-[420px] border rounded-xl shadow-xl p-4 z-50 bg-white border-slate-200"
    >
      <div className="font-semibold mb-2">Simply copy & paste all your parts</div>
      <textarea
        value={bulkText}
        onChange={(e) => setBulkText(e.target.value)}
        className="w-full h-32 border rounded-lg p-2 text-sm outline-none bg-white text-slate-900 placeholder:text-slate-400 border-slate-300"
        placeholder="PART123, 2&#10;IGN-445, 1&#10;…"
      />
      <div className="mt-3 flex justify-end gap-2">
        <button
          className="px-3 py-2 text-sm rounded-lg border text-slate-700 border-slate-300 hover:bg-slate-50"
          onClick={() => setShowBulkMain(false)}
        >
          Cancel
        </button>
        <button
          className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold"
          onClick={submitBulk}
        >
          Continue
        </button>
      </div>
    </div>
  );

  const BulkFlyoutCompact = showBulkCompact && (
    <div
      ref={flyoutCompactRef}
      onMouseEnter={() => setShowBulkCompact(true)}
      onMouseLeave={() => setShowBulkCompact(false)}
      className="absolute right-0 mt-2 w-[420px] border rounded-xl shadow-xl p-4 z-50 bg-white border-slate-200"
    >
      <div className="font-semibold mb-2">Simply copy & paste all your parts</div>
      <textarea
        value={bulkText}
        onChange={(e) => setBulkText(e.target.value)}
        className="w-full h-32 border rounded-lg p-2 text-sm outline-none bg-white text-slate-900 placeholder:text-slate-400 border-slate-300"
        placeholder="PART123, 2&#10;IGN-445, 1&#10;…"
      />
      <div className="mt-3 flex justify-end gap-2">
        <button
          className="px-3 py-2 text-sm rounded-lg border text-slate-700 border-slate-300 hover:bg-slate-50"
          onClick={() => setShowBulkCompact(false)}
        >
          Cancel
        </button>
        <button
          className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold"
          onClick={submitBulk}
        >
          Continue
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* MAIN HEADER (scrolls away normally) */}
      <header ref={headerRef} className="border-b bg-white border-slate-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="py-2">
            <div className="flex items-center gap-6">
              {/* Large Logo/Brand on Left */}
              <div className="flex-shrink-0">
                {Brand}
              </div>
              
              {/* Centered Search Bar */}
              <div className="flex-1 max-w-2xl mx-auto">
                <SearchBar 
                  value={q} 
                  onChange={setQ} 
                  onSubmit={handleMainSearchSubmit}
                />
              </div>
              
              {/* Icons on Right */}
              <div className="flex-shrink-0 flex items-center gap-4">
                <div className="relative">
                  <button
                    ref={btnMainRef}
                    className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold shadow-sm transition-colors"
                    onMouseEnter={() => setShowBulkMain(true)}
                    onClick={() => setShowBulkMain((s) => !s)}
                  >
                    Bulk Order
                  </button>
                  {BulkFlyoutMain}
                </div>
                {Icons}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* COMPACT HEADER (sticky, only shows when main header is scrolled past) */}
      <div
        className={`fixed top-0 left-0 right-0 z-40 bg-slate-900 border-b border-slate-800 transform transition-transform duration-300 ease-in-out ${
          showCompact ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-2 py-1">
          {/* Brand Text */}
          <button
            onClick={goToHomepage}
            className="group cursor-pointer"
          >
            <div className="font-bold text-white text-lg">Parts Partners</div>
          </button>

          {/* Condensed search */}
          <div className="flex-1 min-w-[200px] max-w-[420px]">
            <div className="scale-75 origin-center">
              <SearchBar
                ref={compactSearchRef}
                value={qCompact}
                onChange={setQCompact}
                onSubmit={handleCompactSearchSubmit}
              />
            </div>
          </div>

          {/* Bulk Order */}
          <div className="relative">
            <button
              ref={btnCompactRef}
              className="h-full px-4 py-1 rounded-xl border bg-white border-slate-300 text-slate-800 hover:bg-gray-50"
              onMouseEnter={() => setShowBulkCompact(true)}
              onClick={() => setShowBulkCompact((s) => !s)}
            >
              Bulk Order
            </button>
            {BulkFlyoutCompact}
          </div>

          {/* Icons for compact header */}
          <div className="ml-auto flex items-center gap-2">
            {/* Cart Button */}
            <button
              className="relative p-2 rounded text-white hover:bg-white/10"
              onClick={onOpenCart}
            >
              <ShoppingCart />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 text-[10px] bg-red-600 text-white rounded-full px-1">
                  {count}
                </span>
              )}
            </button>

            {/* Authentication Buttons for compact header */}
            {user ? (
              <>
                <button
                  className="p-2 rounded text-white hover:bg-white/10"
                  onClick={() => onNav('profile')}
                  title="Profile"
                >
                  <User />
                </button>
                <button
                  className="flex items-center gap-1 px-2 py-1 rounded text-white hover:bg-white/10 text-sm"
                  onClick={handleLogout}
                  title="Logout"
                >
                  <LogOut size={14} />
                  Logout
                </button>
              </>
            ) : (
              <button
                className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 text-sm"
                onClick={() => onNav('login')}
              >
                Login
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};