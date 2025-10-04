// src/app/MainShell.tsx - Updated to use simplified search service
import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from 'context/AuthContext';
import { CartProvider, useCart } from 'context/CartContext';
import { Header } from 'app/layout/Header';
import { Footer } from 'app/layout/Footer';
import HomeMinimal from 'components/HomeMinimal';
import BulkOrder from 'features/bulk/BulkOrder';
import CSVImportSystem from 'features/csv/CSVImportSystem';
import TechFinder from 'features/tech/TechFinder';
import PrivacyPolicy from 'app/legal/PrivacyPolicy';
import TermsOfService from 'app/legal/TermsOfService';
import CookiePolicy from 'app/legal/CookiePolicy';
import Accessibility from 'app/legal/Accessibility';
import ShippingPolicy from 'app/legal/ShippingPolicy';
import Contact from 'app/legal/Contact';
import CheckoutPage from 'app/CheckoutPage';
import { CartDrawer } from 'components/CartDrawer';
import { ProductListingPage } from 'features/parts/ProductListingPage';
import ProductDetailPage from 'features/parts/ProductDetailPage';
import ProfilePage from './ProfilePage';
import LoginPage from './auth/LoginPage';
import ErrorBoundary from 'components/ErrorBoundary';
import OrderConfirmation from 'components/OrderConfirmation';

// Create React Query client with simplified settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: (failureCount, error: any) => {
        // Don't retry rate limited requests
        if (error?.message === 'RATE_LIMITED') return false;
        return failureCount < 2; // Retry up to 2 times
      },
      refetchOnWindowFocus: false,
    },
  },
});

const ShellInner: React.FC = () => {
  const [isHydrated, setIsHydrated] = useState(false);
  const [page, setPage] = useState<
    'home' | 'search' | 'admin' | 'privacy' | 'terms' | 'cookies' | 'accessibility' |
    'shipping' | 'contact' | 'login' | 'checkout' | 'product' | 'profile' | 'order-confirmation'
  >('home');
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [showBulk, setShowBulk] = useState(false);
  const [showTech, setShowTech] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [initialBulkText, setInitialBulkText] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const { profile } = useAuth();
  const { items, subtotal, add } = useCart();

  // Listen for search events and navigate to search page
  useEffect(() => {
    const handleSearchNavigation = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.q?.trim()) {
        // Navigate to search page if not already there
        if (page !== 'search') {
          setPage('search');
        }
      }
    };

    window.addEventListener('pp:search', handleSearchNavigation);
    window.addEventListener('pp:do-search', handleSearchNavigation);

    return () => {
      window.removeEventListener('pp:search', handleSearchNavigation);
      window.removeEventListener('pp:do-search', handleSearchNavigation);
    };
  }, [page]);


    useEffect(() => {
    setIsHydrated(true);
    }, []);

    // Listen for part view requests
    useEffect(() => {
      const onView = (e: Event) => {
        const { id } = (e as CustomEvent).detail || {};
        if (!id) return;
        setSelectedPartId(String(id));
        setPage('product');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
      window.addEventListener('pp:viewPart' as any, onView);
      return () => window.removeEventListener('pp:viewPart' as any, onView);
    }, []);

  // Listen for bulk order modal requests
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const text = detail.initialText as string;
      if (text !== undefined) {
        setInitialBulkText(text);
        setShowBulk(true);
      }
    };
    window.addEventListener('pp:showBulkOrderModal' as any, handler);
    return () => window.removeEventListener('pp:showBulkOrderModal' as any, handler);
  }, []);

  // Listen for tech finder requests
  useEffect(() => {
    const handler = () => setShowTech(true);
    window.addEventListener('pp:openTechFinder' as any, handler);
    return () => window.removeEventListener('pp:openTechFinder' as any, handler);
  }, []);

  // Listen for navigation requests
  useEffect(() => {
    const handler = (e: Event) => {
      const { page } = (e as CustomEvent).detail || {};
      if (page) {
        setPage(page);
      }
    };
    window.addEventListener('pp:navigate' as any, handler);
    return () => window.removeEventListener('pp:navigate' as any, handler);
  }, []);

  if (!isHydrated) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
    </div>
    );
  }

  const nav = (p: string) => setPage(p as any);

  // In MainShell.tsx, add this new event listener after the existing ones:

  // Handle search from HomeMinimal - transition to ProductListingPage
  const handleHomepageSearch = (query: string) => {
    setPage('search');
    // Dispatch search event after state update
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('pp:do-search', { 
        detail: { q: query, category: 'all', manufacturerId: 'all' } 
      }));
    }, 0);
  };

  const handleBulkAddToCart = (items: any[]) => {
    // Add each item to the cart using the cart context
    items.forEach(item => {
      if (item.id && item.quantity) {
        // Convert the bulk order item to the format expected by the cart
        const cartItem = {
          id: item.id,
          part_number: item.part_number,
          part_description: item.part_description,
          category: item.category || '',
          list_price: item.list_price || item.price || 0,
          compatible_models: item.compatible_models || [],
          image_url: item.image_url,
          in_stock: item.in_stock || false,
          manufacturer_id: item.manufacturer_id || '',
          make_part_number: item.make_part_number,
          manufacturer: item.manufacturer
        };
        add(cartItem, item.quantity);
      }
    });
  };

  const body = () => {
    switch (page) {
      case 'home':
        return <HomeMinimal onNav={nav} onSearch={handleHomepageSearch} onOpenCart={() => setCartOpen(true)} />;
      case 'search':
        return (
          <ErrorBoundary
            fallback={
              <div className="max-w-4xl mx-auto px-4 py-8 text-center">
                <div className="text-red-600">Search temporarily unavailable</div>
                <button onClick={() => setPage('home')} className="mt-4 text-blue-600 underline">
                  Return to homepage
                </button>
              </div>
            }
          >
            <ProductListingPage onNav={nav} />
          </ErrorBoundary>
        );
      case 'admin':
        return <CSVImportSystem />;
      case 'privacy':
        return <PrivacyPolicy onBack={() => nav('home')} />;
      case 'terms':
        return <TermsOfService onBack={() => nav('home')} />;
      case 'cookies':
        return <CookiePolicy onBack={() => nav('home')} />;
      case 'accessibility':
        return <Accessibility onBack={() => nav('home')} />;
      case 'shipping':
        return <ShippingPolicy onBack={() => nav('home')} />;
      case 'contact':
        return <Contact onBack={() => nav('home')} />;
      case 'login':
        return <LoginPage onNav={nav} />;
      case 'profile':
        return <ProfilePage onNav={nav} />;
      case 'order-confirmation':
        return selectedOrderId ? (
          <OrderConfirmation
            orderId={selectedOrderId}
            onBackToShopping={() => {
              setSelectedOrderId(null);
              setPage('search');
            }}
          />
        ) : (
          <div className="max-w-4xl mx-auto px-4 py-10 text-center text-gray-600">
            No order selected. <button onClick={() => nav('home')} className="text-red-600 underline">Return to homepage</button>
          </div>
        );
      case 'checkout':
        return (
          <ErrorBoundary
            fallback={
              <div className="max-w-4xl mx-auto px-4 py-8 text-center">
                <div className="text-red-600">Checkout temporarily unavailable</div>
                <button onClick={() => setPage('search')} className="mt-4 text-blue-600 underline">
                  Return to shopping
                </button>
              </div>
            }
          >
          <CheckoutPage
            onBack={() => setPage('search')}
            onComplete={(orderId: string) => {
              setSelectedOrderId(orderId);
              setPage('order-confirmation');
              setCartOpen(false);
            }}
          />
          </ErrorBoundary>
        );
      case 'product':
        return selectedPartId ? (
          <ProductDetailPage
            partId={selectedPartId}
            onBack={() => {
              setSelectedPartId(null);
              setPage('search');
            }}
          />
        ) : (
          <div className="max-w-4xl mx-auto px-4 py-10 text-center text-gray-600">
            No product selected.
          </div>
        );
      default:
        return <HomeMinimal onNav={nav} onSearch={handleHomepageSearch} onOpenCart={() => setCartOpen(true)} />;
    }
  };

  // Determine if we should show header/footer
  const isMinimalPage = page === 'home' || page === 'login';
  const showHeaderFooter = !isMinimalPage;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Show Header only for non-minimal pages */}
      {showHeaderFooter && <Header onNav={nav} onOpenCart={() => setCartOpen(true)} />}
      
      <main className={`flex-1 ${showHeaderFooter ? 'bg-gradient-to-br from-slate-50 to-sky-50' : ''}`}>
        {body()}
      </main>
      
      {/* Show Footer only for non-minimal pages */}
      {showHeaderFooter && <Footer onNav={nav} />}

      {/* Modals */}
      {showBulk && (
        <BulkOrder
          isOpen={showBulk}
          onClose={() => {
            setShowBulk(false);
            setInitialBulkText('');
          }}
          onAddToCart={handleBulkAddToCart}
          userProfile={profile}
          initialText={initialBulkText}
        />
      )}
      
      {showTech && (
        <TechFinder 
          isOpen={showTech} 
          onClose={() => setShowTech(false)} 
        />
      )}
      
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onCheckout={() => {
          setPage('checkout');
          setCartOpen(false);
        }}
      />
    </div>
  );
};

const MainShell: React.FC = () => (
  <ErrorBoundary
    onError={(error, errorInfo) => {
      console.error('Application-level error:', error);
      
      // Send to error monitoring service
      if (typeof window !== 'undefined' && (window as any).Sentry) {
        (window as any).Sentry.captureException(error, {
          contexts: {
            react: {
              componentStack: errorInfo.componentStack
            }
          },
          tags: {
            level: 'application',
            section: 'main-shell'
          }
        });
      }
    }}
    showDetails={process.env.NODE_ENV === 'development'}
  >
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <ShellInner />
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default MainShell;