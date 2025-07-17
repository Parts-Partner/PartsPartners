import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Search, 
  ShoppingCart, 
  Upload, 
  User, 
  LogOut, 
  Settings, 
  Package, 
  FileText,
  Menu,
  X
} from 'lucide-react';

// Import your components
import PartsSearch from './parts-search-component';
import CSVImportSystem from './csv_import_system';
import QuoteSubmission from './email_pdf_system';

// Supabase configuration
const SUPABASE_URL = 'https://xarnvryaicseavgnmtjn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhhcm52cnlhaWNzZWF2Z25tdGpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NjU3NzIsImV4cCI6MjA2ODI0MTc3Mn0.KD5zIW2WjE14Q4UcYIRc1rt5wtAweqMefIEgqHm1qtw';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// TypeScript interfaces
interface User {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
    user_type?: 'admin' | 'customer';
  };
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  company_name: string;
  phone: string;
  discount_percentage: number;
  user_type: 'admin' | 'customer';
}

interface Part {
  id: string;
  part_number: string;
  description: string;
  manufacturer: string;
  category: string;
  list_price: string | number;
  compatible_models: string[] | string;
  image_url?: string;
  in_stock: boolean;
}

interface CartItem extends Part {
  quantity: number;
  unit_price: number;
  discounted_price: number;
  line_total: number;
}

type ActivePage = 'search' | 'cart' | 'admin' | 'profile' | 'login';

const OEMPartsApp: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activePage, setActivePage] = useState<ActivePage>('search');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [showQuoteSubmission, setShowQuoteSubmission] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Auth state management
  useEffect(() => {
    // Check initial auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user as User);
        fetchUserProfile(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user as User);
          fetchUserProfile(session.user.id);
        } else {
          setUser(null);
          setUserProfile(null);
          setActivePage('login');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return;
      }

      setUserProfile(data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const handleLogin = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }

      setActivePage('search');
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const handleSignup = async (email: string, password: string, fullName: string, userType: 'admin' | 'customer' = 'customer') => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            user_type: userType
          }
        }
      });

      if (error) {
        throw error;
      }

      // User will be redirected to login after email confirmation
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
      }
      setCartItems([]);
      setActivePage('login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleAddToCart = (part: Part) => {
    const unitPrice = typeof part.list_price === 'string' ? parseFloat(part.list_price) : part.list_price;
    const discountPercentage = userProfile?.discount_percentage || 0;
    const discountedPrice = unitPrice * (1 - discountPercentage / 100);

    setCartItems(prev => {
      const existingItem = prev.find(item => item.id === part.id);
      
      if (existingItem) {
        return prev.map(item =>
          item.id === part.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                line_total: (item.quantity + 1) * discountedPrice
              }
            : item
        );
      } else {
        return [...prev, {
          ...part,
          quantity: 1,
          unit_price: unitPrice,
          discounted_price: discountedPrice,
          line_total: discountedPrice
        }];
      }
    });
  };

  const handleUpdateQuantity = (partId: string, quantity: number) => {
    if (quantity <= 0) {
      setCartItems(prev => prev.filter(item => item.id !== partId));
    } else {
      setCartItems(prev =>
        prev.map(item =>
          item.id === partId
            ? {
                ...item,
                quantity,
                line_total: quantity * item.discounted_price
              }
            : item
        )
      );
    }
  };

  const handleRemoveFromCart = (partId: string) => {
    setCartItems(prev => prev.filter(item => item.id !== partId));
  };

  const handleQuoteSubmitSuccess = () => {
    setCartItems([]);
    setShowQuoteSubmission(false);
    setActivePage('search');
  };

  const cartTotal = cartItems.reduce((sum, item) => sum + item.line_total, 0);
  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Login/Signup Component
  const LoginPage: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      setError('');

      try {
        if (isLogin) {
          await handleLogin(email, password);
        } else {
          await handleSignup(email, password, fullName);
          setError('Please check your email for a confirmation link.');
        }
      } catch (err: any) {
        setError(err.message || 'An error occurred');
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        {/* Background effects */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-600/10"></div>
        </div>
        
        <div className="relative w-full max-w-md">
          {/* Glass morphism card */}
          <div className="backdrop-blur-xl bg-white/10 rounded-2xl shadow-2xl border border-white/20 p-8 relative overflow-hidden">
            {/* Animated gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-pink-600/10 animate-pulse"></div>
            
            <div className="relative z-10">
              {/* Logo and title */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-lg mb-4 p-2">
                  <img 
                    src="https://xarnvryaicseavgnmtjn.supabase.co/storage/v1/object/sign/assets/Parts_Partner_Logo_Rev1.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8yMDYxNTk1OS0wYTk4LTRhZjYtODc1Yy0zOTA2Njg2NGQ1ZjQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhc3NldHMvUGFydHNfUGFydG5lcl9Mb2dvX1JldjEucG5nIiwiaWF0IjoxNzUyNzgzMjI4LCJleHAiOjE5MTA0NjMyMjh9.Iw-KturDVtOegf7MGlfpKprC5NgKhPts2DBUOZVd-9o"
                    alt="Parts Partner Logo" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">Parts Partner</h1>
                <p className="text-white/70 text-sm">Professional parts distribution system</p>
              </div>

              {/* Tab switcher */}
              <div className="flex rounded-xl bg-white/10 p-1 mb-6 backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() => setIsLogin(true)}
                  className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isLogin
                      ? 'bg-white text-gray-900 shadow-lg transform scale-105'
                      : 'text-white/80 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setIsLogin(false)}
                  className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                    !isLogin
                      ? 'bg-white text-gray-900 shadow-lg transform scale-105'
                      : 'text-white/80 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {/* Form */}
              <div className="space-y-4">
                {!isLogin && (
                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/60 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="John Doe"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/60 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/60 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="••••••••"
                  />
                </div>

                {error && (
                  <div className="p-4 bg-red-500/20 backdrop-blur-sm border border-red-500/30 rounded-xl">
                    <p className="text-sm text-red-200">{error}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-4 rounded-xl font-medium hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 shadow-lg"
                >
                  {isSubmitting ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Loading...
                    </div>
                  ) : (
                    isLogin ? 'Sign In' : 'Sign Up'
                  )}
                </button>
              </div>

              {/* Footer */}
              <div className="mt-6 text-center">
                <p className="text-white/60 text-xs">
                  Secure professional parts management system
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Cart Component
  const CartPage: React.FC = () => {
    return (
      <div className="max-w-4xl mx-auto px-4">
        <div className="backdrop-blur-xl bg-white/10 rounded-2xl shadow-2xl border border-white/20 p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Quote Cart</h1>
              <p className="text-white/70 text-sm">Review your selected parts</p>
            </div>
          </div>
          
          {cartItems.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 rounded-full mb-6">
                <ShoppingCart className="w-10 h-10 text-white/60" />
              </div>
              <h3 className="text-xl font-medium text-white mb-2">Your cart is empty</h3>
              <p className="text-white/60 mb-8">Start adding parts to create a quote</p>
              <button
                onClick={() => setActivePage('search')}
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-3 rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                Browse Parts
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {cartItems.map((item) => (
                <div key={item.id} className="backdrop-blur-sm bg-white/10 border border-white/20 rounded-xl p-6 hover:bg-white/15 transition-all duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-white text-lg">{item.part_number}</h3>
                      <p className="text-white/70 text-sm mt-1">{item.description}</p>
                      <p className="text-white/50 text-sm">{item.manufacturer}</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all duration-200"
                        >
                          -
                        </button>
                        <span className="w-12 text-center text-white font-medium">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all duration-200"
                        >
                          +
                        </button>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-white text-lg">${item.line_total.toFixed(2)}</div>
                        <div className="text-white/60 text-sm">
                          ${item.discounted_price.toFixed(2)} each
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFromCart(item.id)}
                        className="text-red-400 hover:text-red-300 p-2 rounded-lg hover:bg-red-500/20 transition-all duration-200"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="border-t border-white/20 pt-6 mt-8">
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold text-white">Total: ${cartTotal.toFixed(2)}</span>
                  <button
                    onClick={() => setShowQuoteSubmission(true)}
                    className="bg-gradient-to-r from-green-500 to-blue-500 text-white px-8 py-3 rounded-xl hover:from-green-600 hover:to-blue-600 transition-all duration-200 transform hover:scale-105 shadow-lg font-medium"
                  >
                    Submit Quote Request
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Profile Component
  const ProfilePage: React.FC = () => {
    return (
      <div className="max-w-2xl mx-auto px-4">
        <div className="backdrop-blur-xl bg-white/10 rounded-2xl shadow-2xl border border-white/20 p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Profile</h1>
              <p className="text-white/70 text-sm">Your account information</p>
            </div>
          </div>
          
          {userProfile && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="backdrop-blur-sm bg-white/10 rounded-xl p-6 border border-white/20">
                <label className="block text-sm font-medium text-white/80 mb-2">Full Name</label>
                <p className="text-white text-lg">{userProfile.full_name || 'Not set'}</p>
              </div>
              
              <div className="backdrop-blur-sm bg-white/10 rounded-xl p-6 border border-white/20">
                <label className="block text-sm font-medium text-white/80 mb-2">Email</label>
                <p className="text-white text-lg">{userProfile.email}</p>
              </div>
              
              <div className="backdrop-blur-sm bg-white/10 rounded-xl p-6 border border-white/20">
                <label className="block text-sm font-medium text-white/80 mb-2">Company</label>
                <p className="text-white text-lg">{userProfile.company_name || 'Not set'}</p>
              </div>
              
              <div className="backdrop-blur-sm bg-white/10 rounded-xl p-6 border border-white/20">
                <label className="block text-sm font-medium text-white/80 mb-2">Phone</label>
                <p className="text-white text-lg">{userProfile.phone || 'Not set'}</p>
              </div>
              
              <div className="backdrop-blur-sm bg-white/10 rounded-xl p-6 border border-white/20">
                <label className="block text-sm font-medium text-white/80 mb-2">Discount Rate</label>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-green-400">{userProfile.discount_percentage}%</span>
                  <div className="px-3 py-1 bg-green-500/20 rounded-full">
                    <span className="text-green-300 text-sm font-medium">Active</span>
                  </div>
                </div>
              </div>
              
              <div className="backdrop-blur-sm bg-white/10 rounded-xl p-6 border border-white/20">
                <label className="block text-sm font-medium text-white/80 mb-2">User Type</label>
                <div className="flex items-center gap-3">
                  <span className="text-white text-lg capitalize">{userProfile.user_type}</span>
                  {userProfile.user_type === 'admin' && (
                    <div className="px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full">
                      <span className="text-white text-sm font-medium">Administrator</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Main navigation
  const Navigation: React.FC = () => (
    <nav className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 shadow-2xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-white rounded-xl shadow-lg p-1">
                <img 
                  src="https://xarnvryaicseavgnmtjn.supabase.co/storage/v1/object/sign/assets/Parts_Partner_Logo_Rev1.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8yMDYxNTk1OS0wYTk4LTRhZjYtODc1Yy0zOTA2Njg2NGQ1ZjQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhc3NldHMvUGFydHNfUGFydG5lcl9Mb2dvX1JldjEucG5nIiwiaWF0IjoxNzUyNzgzMjI4LCJleHAiOjE5MTA0NjMyMjh9.Iw-KturDVtOegf7MGlfpKprC5NgKhPts2DBUOZVd-9o"
                  alt="Parts Partner Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Parts Partner</h1>
                <p className="text-xs text-blue-200">Professional Distribution</p>
              </div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-2">
            <button
              onClick={() => setActivePage('search')}
              className={`group flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                activePage === 'search'
                  ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/30'
                  : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <Search size={16} className="group-hover:scale-110 transition-transform" />
              Search Parts
            </button>

            <button
              onClick={() => setActivePage('cart')}
              className={`group flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 relative ${
                activePage === 'cart'
                  ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/30'
                  : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <ShoppingCart size={16} className="group-hover:scale-110 transition-transform" />
              Cart
              {cartItemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center shadow-lg animate-pulse">
                  {cartItemCount}
                </span>
              )}
            </button>

            {userProfile?.user_type === 'admin' && (
              <button
                onClick={() => setActivePage('admin')}
                className={`group flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activePage === 'admin'
                    ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/30'
                    : 'text-blue-200 hover:text-white hover:bg-white/10'
                }`}
              >
                <Upload size={16} className="group-hover:scale-110 transition-transform" />
                Admin
                <span className="px-2 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs rounded-full">
                  PRO
                </span>
              </button>
            )}

            <button
              onClick={() => setActivePage('profile')}
              className={`group flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                activePage === 'profile'
                  ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm border border-white/30'
                  : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <User size={16} className="group-hover:scale-110 transition-transform" />
              Profile
            </button>

            <div className="h-8 w-px bg-white/20 mx-2"></div>

            <button
              onClick={handleLogout}
              className="group flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-red-200 hover:text-red-100 hover:bg-red-500/20 transition-all duration-200"
            >
              <LogOut size={16} className="group-hover:scale-110 transition-transform" />
              Logout
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-blue-200 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-all duration-200"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 backdrop-blur-sm">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <button
                onClick={() => {
                  setActivePage('search');
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                  activePage === 'search'
                    ? 'bg-white/20 text-white'
                    : 'text-blue-200 hover:text-white hover:bg-white/10'
                }`}
              >
                <Search size={20} />
                Search Parts
              </button>
              <button
                onClick={() => {
                  setActivePage('cart');
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 relative ${
                  activePage === 'cart'
                    ? 'bg-white/20 text-white'
                    : 'text-blue-200 hover:text-white hover:bg-white/10'
                }`}
              >
                <ShoppingCart size={20} />
                Cart
                {cartItemCount > 0 && (
                  <span className="ml-auto bg-gradient-to-r from-red-500 to-pink-500 text-white text-sm rounded-full w-6 h-6 flex items-center justify-center">
                    {cartItemCount}
                  </span>
                )}
              </button>
              {userProfile?.user_type === 'admin' && (
                <button
                  onClick={() => {
                    setActivePage('admin');
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                    activePage === 'admin'
                      ? 'bg-white/20 text-white'
                      : 'text-blue-200 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Upload size={20} />
                  Admin
                  <span className="ml-auto px-2 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs rounded-full">
                    PRO
                  </span>
                </button>
              )}
              <button
                onClick={() => {
                  setActivePage('profile');
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                  activePage === 'profile'
                    ? 'bg-white/20 text-white'
                    : 'text-blue-200 hover:text-white hover:bg-white/10'
                }`}
              >
                <User size={20} />
                Profile
              </button>
              <div className="h-px bg-white/20 my-2"></div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl text-base font-medium text-red-200 hover:text-red-100 hover:bg-red-500/20 transition-all duration-200"
              >
                <LogOut size={20} />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );

  // Render login page if not authenticated
  if (!user) {
    return <LoginPage />;
  }

  // Main app layout
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <Navigation />
      
      <main className="relative">
        {/* Background effects for main content */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-purple-600/5 to-pink-600/5 pointer-events-none"></div>
        
        <div className="relative z-10 py-8">
          {activePage === 'search' && (
            <PartsSearch 
              onAddToCart={handleAddToCart}
              cartItems={cartItems}
            />
          )}
          
          {activePage === 'cart' && <CartPage />}
          
          {activePage === 'admin' && userProfile?.user_type === 'admin' && (
            <div className="max-w-6xl mx-auto px-4">
              <CSVImportSystem />
            </div>
          )}
          
          {activePage === 'profile' && <ProfilePage />}
        </div>
      </main>

      {/* Quote Submission Modal */}
      {showQuoteSubmission && (
        <QuoteSubmission
          cartItems={cartItems}
          userDiscount={userProfile?.discount_percentage || 0}
          onSubmitSuccess={handleQuoteSubmitSuccess}
          onClose={() => setShowQuoteSubmission(false)}
        />
      )}
    </div>
  );
};

export default OEMPartsApp;