// src/app/MainShell.tsx - Clean version using external LoginPage
import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from 'context/AuthContext';
import { CartProvider, useCart } from 'context/CartContext';
import { Header } from 'app/layout/Header';
import { Footer } from 'app/layout/Footer';
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
// CLEAN: Import external LoginPage component
import LoginPage from './auth/LoginPage';
import ErrorBoundary from 'components/ErrorBoundary';
import OrderConfirmation from 'components/OrderConfirmation';


// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const ShellInner: React.FC = () => {
  const [page, setPage] = useState<
    'search' | 'admin' | 'privacy' | 'terms' | 'cookies' | 'accessibility' |
    'shipping' | 'contact' | 'login' | 'checkout' | 'product' | 'profile' | 'order-confirmation'
  >('search');
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [showBulk, setShowBulk] = useState(false);
  const [showTech, setShowTech] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [initialBulkText, setInitialBulkText] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const { profile } = useAuth();
  const { items, subtotal, add } = useCart();

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

  // Listen for bulk order modal requests from header
  useEffect(() => {
    const handler = (e: Event) => {
      console.log('🔥 MainShell: received pp:showBulkOrderModal event', e);
      const detail = (e as CustomEvent).detail || {};
      const text = detail.initialText as string;
      console.log('🔥 MainShell: extracted text:', text);
      if (text) {
        setInitialBulkText(text);
        setShowBulk(true);
        console.log('🔥 MainShell: opening bulk modal');
      }
    };
    window.addEventListener('pp:showBulkOrderModal' as any, handler);
    return () => window.removeEventListener('pp:showBulkOrderModal' as any, handler);
  }, []);

  const nav = (p: string) => setPage(p as any);

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
      case 'admin':
        return <CSVImportSystem />;
      case 'privacy':
        return <PrivacyPolicy onBack={() => nav('search')} />;
      case 'terms':
        return <TermsOfService onBack={() => nav('search')} />;
      case 'cookies':
        return <CookiePolicy onBack={() => nav('search')} />;
      case 'accessibility':
        return <Accessibility onBack={() => nav('search')} />;
      case 'shipping':
        return <ShippingPolicy onBack={() => nav('search')} />;
      case 'contact':
        return <Contact onBack={() => nav('search')} />;
      case 'login':
        // CLEAN: Use external LoginPage component
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
            No order selected. <button onClick={() => nav('search')} className="text-red-600 underline">Return to shopping</button>
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
            onBack={() => setPage('search')}
          />
        ) : (
          <div className="max-w-4xl mx-auto px-4 py-10 text-center text-gray-600">
            No product selected.
          </div>
        );
      default:
        return (
          <ErrorBoundary
            fallback={
              <div className="max-w-4xl mx-auto px-4 py-8 text-center">
                <div className="text-red-600">Search temporarily unavailable</div>
                <button onClick={() => window.location.reload()} className="mt-4 text-blue-600 underline">
                  Refresh page
                </button>
              </div>
            }
          >
            <ProductListingPage onNav={nav} />
          </ErrorBoundary>
        );
  }
};

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hide Header and Footer on login page for full-screen experience */}
      {page !== 'login' && <Header onNav={nav} onOpenCart={() => setCartOpen(true)} />}
      
      <main className={`flex-1 ${page !== 'login' ? 'bg-gradient-to-br from-slate-50 to-sky-50' : ''}`}>
        {body()}
      </main>
      
      {page !== 'login' && <Footer onNav={nav} />}

      {showBulk && (
        <BulkOrder
          isOpen={showBulk}
          onClose={() => {
            setShowBulk(false);
            setInitialBulkText(''); // Clear the initial text when closing
          }}
          onAddToCart={handleBulkAddToCart}
          userProfile={profile}
          initialText={initialBulkText} // Pass the initial text from header flyout
        />
      )}
      {showTech && (
        <TechFinder isOpen={showTech} onClose={() => setShowTech(false)} />
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