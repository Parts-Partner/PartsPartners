// src/app/MainShell.tsx
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
import { ProfilePage } from './ProfilePage';
import { Eye, EyeOff, Mail, Lock, ArrowRight, Shield, Users, Truck } from 'lucide-react';

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

// Modern Login Component
const ModernLoginPage: React.FC<{ onNav: (page: string) => void }> = ({ onNav }) => {
  const { login, signup } = useAuth(); // Use real auth functions
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    company: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login'); // 'login' or 'register'
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      if (activeTab === 'login') {
        await login(formData.email, formData.password);
        console.log('✅ Login successful');
      } else {
        await signup(formData.email, formData.password, formData.fullName);
        console.log('✅ Registration successful');
      }
      // Navigate back to search after successful login/register
      onNav('search');
    } catch (error: any) {
      console.error('❌ Auth error:', error);
      setError(error.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div 
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `radial-gradient(circle, #e2e8f0 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />
      
      <div className="relative w-full max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          
          {/* Left Side - Branding & Benefits */}
          <div className="hidden lg:block space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <img
                  src="https://xarnvryaicseavgnmtjn.supabase.co/storage/v1/object/public/assets//Logo_Rev1.png"
                  alt="Parts Partners Logo"
                  className="h-16 w-16 rounded-xl bg-white p-2 shadow-lg"
                />
                <div>
                  <h1 className="text-3xl font-extrabold text-slate-900">Parts Partners</h1>
                  <p className="text-slate-600 font-medium">OEM Parts • Fast Shipping</p>
                </div>
              </div>
              
              <h2 className="text-4xl font-bold text-slate-900 leading-tight">
                Welcome to the future of 
                <span className="text-red-600"> parts sourcing</span>
              </h2>
              
              <p className="text-xl text-slate-600 leading-relaxed">
                Join thousands of technicians and businesses who trust us for their OEM parts needs.
              </p>
            </div>

            {/* Benefits */}
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">Exclusive Discounts</h3>
                  <p className="text-slate-600">Get up to 25% off on all OEM parts with your professional account.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Truck className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">Fast Shipping</h3>
                  <p className="text-slate-600">Same-day processing and expedited shipping to get you back to work.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">Expert Support</h3>
                  <p className="text-slate-600">Connect with our parts specialists and technician network.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Login Form */}
          <div className="w-full">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 lg:p-10">
              
              {/* Tab Switcher */}
              <div className="flex bg-slate-100 rounded-2xl p-1 mb-8">
                <button
                  onClick={() => setActiveTab('login')}
                  className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
                    activeTab === 'login'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => setActiveTab('register')}
                  className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
                    activeTab === 'register'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Register
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  
                  {/* Email Field */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        onKeyPress={handleKeyPress}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all placeholder-slate-400"
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        onKeyPress={handleKeyPress}
                        className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all placeholder-slate-400"
                        placeholder="Enter your password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Additional fields for registration */}
                  {activeTab === 'register' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">
                          Full Name
                        </label>
                        <input
                          type="text"
                          name="fullName"
                          value={formData.fullName}
                          onChange={handleInputChange}
                          onKeyPress={handleKeyPress}
                          className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all placeholder-slate-400"
                          placeholder="Your full name"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">
                          Company (Optional)
                        </label>
                        <input
                          type="text"
                          name="company"
                          value={formData.company}
                          onChange={handleInputChange}
                          onKeyPress={handleKeyPress}
                          className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all placeholder-slate-400"
                          placeholder="Your company name"
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Remember Me / Forgot Password */}
                {activeTab === 'login' && (
                  <div className="flex items-center justify-between">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 text-red-600 bg-slate-50 border-slate-300 rounded focus:ring-red-500 focus:ring-2" />
                      <span className="text-sm text-slate-600">Remember me</span>
                    </label>
                    <button type="button" className="text-sm text-red-600 hover:text-red-700 font-medium">
                      Forgot password?
                    </button>
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {activeTab === 'login' ? 'Sign In' : 'Create Account'}
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>

                {/* Continue as Guest */}
                <div className="text-center pt-4">
                  <button
                    type="button"
                    onClick={() => onNav('search')}
                    className="text-slate-600 hover:text-slate-900 font-medium text-sm transition-colors"
                  >
                    Continue as Guest
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile Logo */}
            <div className="lg:hidden text-center mt-8">
              <div className="flex items-center justify-center gap-3 mb-4">
                <img
                  src="https://xarnvryaicseavgnmtjn.supabase.co/storage/v1/object/public/assets//Logo_Rev1.png"
                  alt="Parts Partners Logo"
                  className="h-12 w-12 rounded-lg bg-white p-1 shadow-lg"
                />
                <div className="text-left">
                  <h1 className="text-xl font-extrabold text-slate-900">Parts Partners</h1>
                  <p className="text-sm text-slate-600">OEM Parts • Fast Shipping</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ShellInner: React.FC = () => {
  const [page, setPage] = useState<
    'search' | 'admin' | 'privacy' | 'terms' | 'cookies' | 'accessibility' |
    'shipping' | 'contact' | 'login' | 'checkout' | 'product' | 'profile'
  >('search');
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [showBulk, setShowBulk] = useState(false);
  const [showTech, setShowTech] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [initialBulkText, setInitialBulkText] = useState('');

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
        return <ModernLoginPage onNav={nav} />;
      case 'profile':
        return <ProfilePage onNav={nav} />;
      case 'checkout':
        return (
          <CheckoutPage
            onBack={() => setPage('search')}
            onComplete={() => {
              setPage('search');
              setCartOpen(false);
            }}
          />
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
        return <ProductListingPage />;
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
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CartProvider>
        <ShellInner />
      </CartProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default MainShell;