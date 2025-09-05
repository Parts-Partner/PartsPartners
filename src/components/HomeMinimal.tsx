// src/components/HomeMinimal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { SearchBar } from 'components/search/SearchBarComponent';
import { Footer } from 'app/layout/Footer';
import { UserPlus, MapPin, ShoppingBag, ShoppingCart, User, LogOut } from 'lucide-react';
import { useCart } from 'context/CartContext';
import { useAuth } from 'context/AuthContext';

interface HomeMinimalProps {
  onNav: (page: string) => void;
  onSearch: (query: string) => void;
  onOpenCart: () => void;
}

export const HomeMinimal: React.FC<HomeMinimalProps> = ({ onNav, onSearch, onOpenCart }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [placeholderText, setPlaceholderText] = useState('');
  const [animationComplete, setAnimationComplete] = useState(false);
  const searchBarRef = useRef<{ clearSuggestions: () => void }>(null);
  const { count } = useCart();
  const { user, logout } = useAuth();

  const fullPlaceholder = "Search for parts, manufacturers, models...";

  // Simple one-time typing animation
  useEffect(() => {
    if (animationComplete) return;

    let currentIndex = 0;
    const typeText = () => {
      if (currentIndex <= fullPlaceholder.length) {
        setPlaceholderText(fullPlaceholder.slice(0, currentIndex));
        currentIndex++;
        setTimeout(typeText, 50); // Consistent typing speed
      } else {
        setAnimationComplete(true);
      }
    };

    // Start animation after a brief delay
    const timer = setTimeout(typeText, 800);
    return () => clearTimeout(timer);
  }, []);

  const handleSearchSubmit = (query: string) => {
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const handleNavClick = (page: string) => {
    // Clear search suggestions when navigating away
    if (searchBarRef.current?.clearSuggestions) {
      searchBarRef.current.clearSuggestions();
    }
    onNav(page);
  };

  const handleLogout = async () => {
    try {
      await logout();
      // Stay on homepage after logout
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleBulkOrder = () => {
    // Dispatch event to show bulk order modal
    window.dispatchEvent(new CustomEvent('pp:showBulkOrderModal', { 
      detail: { initialText: '' } 
    }));
  };

  const handleFindTech = () => {
    // Dispatch event to show tech finder modal
    window.dispatchEvent(new CustomEvent('pp:openTechFinder'));
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top right corner buttons */}
      <div className="absolute top-4 right-4 z-10">
        <div className="flex items-center gap-2">
          {/* Cart Button */}
          <button
            className="relative p-2 rounded text-gray-700 hover:bg-gray-100 transition-colors"
            onClick={onOpenCart}
            aria-label="Open cart"
          >
            <ShoppingCart size={20} />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 text-[10px] bg-red-600 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                {count}
              </span>
            )}
          </button>

          {/* Authentication Buttons */}
          {user ? (
            // User is logged in - show profile and logout buttons
            <>
              <button
                className="p-2 rounded text-gray-700 hover:bg-gray-100 transition-colors"
                onClick={() => handleNavClick('profile')}
                aria-label="Profile"
                title="View Profile"
              >
                <User size={20} />
              </button>
              <button
                className="flex items-center gap-1 px-3 py-2 rounded text-gray-700 hover:bg-gray-100 text-sm font-medium transition-colors"
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
              onClick={() => handleNavClick('login')}
              aria-label="Login"
            >
              Login
            </button>
          )}
        </div>
      </div>

      {/* Main content area - centered and minimal */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-16">
        <div className="w-full max-w-2xl text-center space-y-8">
          
          {/* Logo and Brand Name */}
          <div className="space-y-4">
            <img
              src="https://xarnvryaicseavgnmtjn.supabase.co/storage/v1/object/public/assets//Logo_Rev1.png"
              alt="Parts Partners Logo"
              className="h-32 w-32 mx-auto object-contain"
            />
            <h1 className="text-5xl text-gray-900 tracking-wide">
              Parts Partners
            </h1>
          </div>

          {/* Search Bar with Hand-drawn Annotation */}
          <div className="w-full max-w-xl mx-auto">
            <div className="relative group">
              {/* Hand-drawn annotation positioned upper-left */}
              <div className="absolute -top-12 -left-12 flex flex-col items-start">
                {/* Handwritten text - ONLY this wiggles */}
                <span 
                  className={`text-red-600 select-none mb-0 ${
                    animationComplete ? 'wiggle-animation' : ''
                  }`}
                  style={{
                    fontFamily: '"Permanent Marker", cursive',
                    fontSize: '20px',
                    fontWeight: 700,
                    marginLeft: '-70px',
                    lineHeight: '1',
                    marginTop: '-10px',
                    color: '#E53935',
                    transform: 'rotate(-12deg)',
                    transformOrigin: 'left center',
                  }}
                >
                  Find parts <br /> here!
                </span>
                
                {/* Red arrow image - NO wiggle animation */}
                <img 
                  src="https://xarnvryaicseavgnmtjn.supabase.co/storage/v1/object/public/assets/red_arrow.svg"
                  alt=""
                  className="w-32 h-20"
                  style={{ scale: '1.1', 
                    marginLeft: '-20px', 
                    marginTop: '-50px', 
                    transform: 'rotate(20deg)' }}
                  aria-hidden="true"
                />
              </div>
              
              <SearchBar
                ref={searchBarRef}
                value={searchQuery}
                onChange={setSearchQuery}
                onSubmit={handleSearchSubmit}
                placeholder={placeholderText || "Search for parts, manufacturers, models..."}
              />
            </div>
          </div>

          {/* Load Permanent Marker font and CSS for wiggle animation */}
          <style dangerouslySetInnerHTML={{
            __html: `
              @import url('https://fonts.googleapis.com/css2?family=Permanent+Marker&display=swap');
              
              @keyframes wiggle {
                0%, 100% { transform: rotate(-12deg) translateX(0px) translateY(0px); }
                25% { transform: rotate(-13deg) translateX(-1px) translateY(1px); }
                50% { transform: rotate(-11deg) translateX(1px) translateY(-1px); }
                75% { transform: rotate(-13deg) translateX(-1px) translateY(1px); }
              }
              .wiggle-animation {
                animation: wiggle 0.7s ease-in-out 3;
              }
            `
          }} />

          {/* Navigation Buttons */}
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            <button
              onClick={() => handleNavClick('contact')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200"
            >
              <UserPlus size={18} />
              Become a Partner
            </button>
            
            <button
              onClick={handleFindTech}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200"
            >
              <MapPin size={18} />
              Find a Technician
            </button>
            
            <button
              onClick={handleBulkOrder}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200"
            >
              <ShoppingBag size={18} />
              Bulk Order
            </button>
          </div>

          {/* Subtle tagline */}
          <p className="text-gray-500 text-sm mt-6 max-w-md mx-auto">
            Your trusted source for genuine OEM parts
          </p>
        </div>
      </div>

      {/* Minimal Footer */}
      <Footer variant="minimal" onNav={handleNavClick} />
    </div>
  );
};

export default HomeMinimal;