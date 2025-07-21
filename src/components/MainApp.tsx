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
import QuoteSubmission from './QuoteSubmission';

// Supabase configuration
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// TypeScript interfaces - Updated to match new database structure
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

interface Manufacturer {
  id: string;
  make: string;
  manufacturer: string;
}

interface Part {
  id: string;
  part_number: string;
  part_description: string; // Updated from 'description'
  category: string;
  list_price: string | number;
  compatible_models: string[] | string;
  image_url?: string;
  in_stock: boolean;
  created_at?: string;
  updated_at?: string;
  manufacturer_id: string; // New field
  make_part_number?: string; // New field
  manufacturer?: Manufacturer; // Joined manufacturer data
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
      console.log('Fetching user profile for ID:', userId);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      console.log('Profile fetch response:', { data, error });

      if (error) {
        console.error('Error fetching user profile:', error);
        return;
      }

      console.log('Setting user profile:', data);
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
                    src="https://xarnvryaicseavgnmtjn.supabase.co/storage/v1/object/public/assets/Parts_Partner_Logo_Rev1.png"
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
      <div style={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)',
        padding: '32px 16px'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Header Section */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e5e7eb',
            padding: '32px',
            marginBottom: '32px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
              <div style={{
                padding: '12px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}>
                <ShoppingCart style={{ width: '24px', height: '24px', color: 'white' }} />
              </div>
              <div>
                <h1 style={{
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  color: '#111827',
                  margin: 0,
                  lineHeight: '1.2'
                }}>
                  Quote Cart
                </h1>
                <p style={{
                  color: '#6b7280',
                  fontSize: '1rem',
                  margin: 0
                }}>
                  Review your selected parts and request a quote
                </p>
              </div>
            </div>
            
            {cartItems.length > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '24px',
                padding: '16px 20px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e40af' }}>
                    {cartItemCount}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    {cartItemCount === 1 ? 'Item' : 'Items'}
                  </div>
                </div>
                <div style={{ width: '1px', height: '40px', backgroundColor: '#e2e8f0' }}></div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#059669' }}>
                    ${cartTotal.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    Total Value
                  </div>
                </div>
                {userProfile?.discount_percentage && userProfile.discount_percentage > 0 && (
                  <>
                    <div style={{ width: '1px', height: '40px', backgroundColor: '#e2e8f0' }}></div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#dc2626' }}>
                        {userProfile.discount_percentage}%
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                        Discount
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          
          {cartItems.length === 0 ? (
            /* Empty Cart State */
            <div style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e5e7eb',
              padding: '64px 32px',
              textAlign: 'center'
            }}>
              <div style={{
                width: '80px',
                height: '80px',
                backgroundColor: '#f1f5f9',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px'
              }}>
                <ShoppingCart style={{ width: '40px', height: '40px', color: '#94a3b8' }} />
              </div>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: '600',
                color: '#111827',
                marginBottom: '8px'
              }}>
                Your cart is empty
              </h3>
              <p style={{
                color: '#6b7280',
                fontSize: '1rem',
                marginBottom: '32px',
                maxWidth: '400px',
                margin: '0 auto 32px'
              }}>
                Start adding parts to create a professional purchase order
              </p>
              <button
                onClick={() => setActivePage('search')}
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  color: 'white',
                  padding: '12px 32px',
                  borderRadius: '12px',
                  border: 'none',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(59, 130, 246, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                }}
              >
                Browse Parts Catalog
              </button>
            </div>
          ) : (
            /* Cart Items */
            <div style={{ display: 'grid', gap: '24px' }}>
              {cartItems.map((item, index) => (
                <div key={item.id} style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                  border: '1px solid #e5e7eb',
                  padding: '24px',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                    {/* Product Image */}
                    <div style={{
                      width: '80px',
                      height: '80px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      flexShrink: 0,
                      border: '1px solid #e2e8f0'
                    }}>
                      <img
                        src={item.image_url || '/No_Product_Image_Filler.png'}
                        alt={item.part_description}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                    </div>

                    {/* Product Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{
                        fontSize: '1.25rem',
                        fontWeight: '600',
                        color: '#111827',
                        marginBottom: '4px',
                        lineHeight: '1.3'
                      }}>
                        {item.part_number}
                      </h3>
                      <p style={{
                        color: '#6b7280',
                        fontSize: '0.875rem',
                        marginBottom: '8px',
                        lineHeight: '1.4'
                      }}>
                        {item.part_description}
                      </p>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '0.875rem' }}>
                        <span style={{ color: '#64748b' }}>
                          <strong>OEM:</strong> {item.manufacturer?.manufacturer || 'N/A'}
                        </span>
                        <span style={{ color: '#64748b' }}>
                          <strong>Make:</strong> {item.manufacturer?.make || 'N/A'}
                        </span>
                      </div>
                    </div>

                    {/* Quantity Controls */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px 16px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0'
                    }}>
                      <button
                        onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          border: '1px solid #d1d5db',
                          backgroundColor: 'white',
                          color: '#374151',
                          fontSize: '1rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f3f4f6';
                          e.currentTarget.style.borderColor = '#9ca3af';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'white';
                          e.currentTarget.style.borderColor = '#d1d5db';
                        }}
                      >
                        −
                      </button>
                      <span style={{
                        minWidth: '32px',
                        textAlign: 'center',
                        fontSize: '1rem',
                        fontWeight: '600',
                        color: '#111827'
                      }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          border: '1px solid #d1d5db',
                          backgroundColor: 'white',
                          color: '#374151',
                          fontSize: '1rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f3f4f6';
                          e.currentTarget.style.borderColor = '#9ca3af';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'white';
                          e.currentTarget.style.borderColor = '#d1d5db';
                        }}
                      >
                        +
                      </button>
                    </div>

                    {/* Pricing */}
                    <div style={{ textAlign: 'right', minWidth: '120px' }}>
                      <div style={{
                        fontSize: '1.25rem',
                        fontWeight: 'bold',
                        color: '#111827',
                        marginBottom: '4px'
                      }}>
                        ${item.line_total.toFixed(2)}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        ${item.discounted_price.toFixed(2)} each
                      </div>
                      {userProfile?.discount_percentage && userProfile.discount_percentage > 0 && (
                        <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: '500' }}>
                          {userProfile.discount_percentage}% off
                        </div>
                      )}
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => handleRemoveFromCart(item.id)}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        border: '1px solid #fecaca',
                        backgroundColor: '#fef2f2',
                        color: '#dc2626',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#fee2e2';
                        e.currentTarget.style.borderColor = '#f87171';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#fef2f2';
                        e.currentTarget.style.borderColor = '#fecaca';
                      }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ))}
              
              {/* Cart Summary & Checkout */}
              <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                border: '1px solid #e5e7eb',
                padding: '32px'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '24px'
                }}>
                  <div>
                    <h3 style={{
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                      color: '#111827',
                      marginBottom: '8px'
                    }}>
                      Ready to submit your purchase order?
                    </h3>
                    <p style={{
                      color: '#6b7280',
                      fontSize: '1rem',
                      margin: 0
                    }}>
                      Total: <span style={{ fontWeight: '600', color: '#111827' }}>${cartTotal.toFixed(2)}</span>
                      {userProfile?.discount_percentage && userProfile.discount_percentage > 0 && (
                        <span style={{ color: '#059669', fontSize: '0.875rem', marginLeft: '8px' }}>
                          ({userProfile.discount_percentage}% discount applied)
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowQuoteSubmission(true)}
                    style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: 'white',
                      padding: '16px 32px',
                      borderRadius: '12px',
                      border: 'none',
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                      transition: 'all 0.2s ease',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 20px rgba(16, 185, 129, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                    }}
                  >
                    Submit Purchase Order
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
    console.log('ProfilePage rendering, userProfile:', userProfile);
    console.log('User object:', user);
    
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)',
        padding: '32px 16px'
      }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          {/* Header Section */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e5e7eb',
            padding: '32px',
            marginBottom: '32px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
              <div style={{
                padding: '12px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}>
                <User style={{ width: '24px', height: '24px', color: 'white' }} />
              </div>
              <div>
                <h1 style={{
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  color: '#111827',
                  margin: 0,
                  lineHeight: '1.2'
                }}>
                  Account Profile
                </h1>
                <p style={{
                  color: '#6b7280',
                  fontSize: '1rem',
                  margin: 0
                }}>
                  Manage your account information and preferences
                </p>
              </div>
            </div>

            {/* Account Status */}
            {userProfile && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '24px',
                padding: '16px 20px',
                backgroundColor: '#f0fdf4',
                borderRadius: '12px',
                border: '1px solid #bbf7d0'
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <User style={{ width: '24px', height: '24px', color: 'white' }} />
                </div>
                <div>
                  <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#065f46' }}>
                    Account Active
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#047857' }}>
                    {userProfile.user_type === 'admin' ? 'Administrator Access' : 'Customer Account'} • {userProfile.discount_percentage}% Discount Rate
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {userProfile ? (
            <div style={{ display: 'grid', gap: '24px' }}>
              {/* Personal Information Card */}
              <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                border: '1px solid #e5e7eb',
                padding: '32px'
              }}>
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: '600',
                  color: '#111827',
                  marginBottom: '24px',
                  paddingBottom: '16px',
                  borderBottom: '2px solid #f3f4f6'
                }}>
                  Personal Information
                </h2>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
                  gap: '24px' 
                }}>
                  {/* Full Name */}
                  <div style={{
                    padding: '20px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <User size={16} style={{ color: '#64748b' }} />
                      <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#475569' }}>
                        Full Name
                      </label>
                    </div>
                    <p style={{
                      fontSize: '1.125rem',
                      fontWeight: '600',
                      color: '#111827',
                      margin: 0
                    }}>
                      {userProfile.full_name || 'Not provided'}
                    </p>
                  </div>
                  
                  {/* Email */}
                  <div style={{
                    padding: '20px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Package size={16} style={{ color: '#64748b' }} />
                      <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#475569' }}>
                        Email Address
                      </label>
                    </div>
                    <p style={{
                      fontSize: '1.125rem',
                      fontWeight: '600',
                      color: '#111827',
                      margin: 0,
                      wordBreak: 'break-word'
                    }}>
                      {userProfile.email}
                    </p>
                  </div>
                  
                  {/* Company */}
                  <div style={{
                    padding: '20px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Package size={16} style={{ color: '#64748b' }} />
                      <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#475569' }}>
                        Company Name
                      </label>
                    </div>
                    <p style={{
                      fontSize: '1.125rem',
                      fontWeight: '600',
                      color: '#111827',
                      margin: 0
                    }}>
                      {userProfile.company_name || 'Not provided'}
                    </p>
                  </div>
                  
                  {/* Phone */}
                  <div style={{
                    padding: '20px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Package size={16} style={{ color: '#64748b' }} />
                      <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#475569' }}>
                        Phone Number
                      </label>
                    </div>
                    <p style={{
                      fontSize: '1.125rem',
                      fontWeight: '600',
                      color: '#111827',
                      margin: 0
                    }}>
                      {userProfile.phone || 'Not provided'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Account Details Card */}
              <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                border: '1px solid #e5e7eb',
                padding: '32px'
              }}>
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: '600',
                  color: '#111827',
                  marginBottom: '24px',
                  paddingBottom: '16px',
                  borderBottom: '2px solid #f3f4f6'
                }}>
                  Account Details
                </h2>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                  gap: '24px' 
                }}>
                  {/* Discount Rate */}
                  <div style={{
                    padding: '24px',
                    background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)',
                    borderRadius: '12px',
                    border: '1px solid #bbf7d0',
                    textAlign: 'center'
                  }}>
                    <div style={{
                      fontSize: '2.5rem',
                      fontWeight: 'bold',
                      color: '#059669',
                      marginBottom: '8px'
                    }}>
                      {userProfile.discount_percentage}%
                    </div>
                    <div style={{
                      fontSize: '1rem',
                      fontWeight: '500',
                      color: '#065f46',
                      marginBottom: '8px'
                    }}>
                      Discount Rate
                    </div>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '6px 12px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      borderRadius: '20px'
                    }}>
                      ✓ ACTIVE
                    </div>
                  </div>
                  
                  {/* User Type */}
                  <div style={{
                    padding: '24px',
                    background: userProfile.user_type === 'admin' 
                      ? 'linear-gradient(135deg, #fdf4ff 0%, #faf5ff 100%)'
                      : 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)',
                    borderRadius: '12px',
                    border: userProfile.user_type === 'admin' 
                      ? '1px solid #e9d5ff'
                      : '1px solid #bfdbfe',
                    textAlign: 'center'
                  }}>
                    <div style={{
                      fontSize: '1.25rem',
                      fontWeight: '600',
                      color: userProfile.user_type === 'admin' ? '#7c3aed' : '#2563eb',
                      marginBottom: '8px',
                      textTransform: 'capitalize'
                    }}>
                      {userProfile.user_type}
                    </div>
                    <div style={{
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: userProfile.user_type === 'admin' ? '#6b21a8' : '#1e40af',
                      marginBottom: '12px'
                    }}>
                      Account Type
                    </div>
                    {userProfile.user_type === 'admin' && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '6px 12px',
                        background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)',
                        color: 'white',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        borderRadius: '20px'
                      }}>
                        🛡️ ADMIN ACCESS
                      </div>
                    )}
                  </div>

                  {/* Account Status */}
                  <div style={{
                    padding: '24px',
                    background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                    borderRadius: '12px',
                    border: '1px solid #bbf7d0',
                    textAlign: 'center'
                  }}>
                    <div style={{
                      fontSize: '1.25rem',
                      fontWeight: '600',
                      color: '#059669',
                      marginBottom: '8px'
                    }}>
                      Active
                    </div>
                    <div style={{
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#065f46',
                      marginBottom: '12px'
                    }}>
                      Account Status
                    </div>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '6px 12px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      borderRadius: '20px'
                    }}>
                      ✓ VERIFIED
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions Card */}
              <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                border: '1px solid #e5e7eb',
                padding: '32px'
              }}>
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: '600',
                  color: '#111827',
                  marginBottom: '24px',
                  paddingBottom: '16px',
                  borderBottom: '2px solid #f3f4f6'
                }}>
                  Quick Actions
                </h2>
                
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setActivePage('search')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '16px 24px',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                      color: 'white',
                      borderRadius: '12px',
                      border: 'none',
                      fontSize: '1rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 20px rgba(59, 130, 246, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                    }}
                  >
                    <Search size={18} />
                    Browse Parts
                  </button>

                  <button
                    onClick={() => setActivePage('cart')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '16px 24px',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: 'white',
                      borderRadius: '12px',
                      border: 'none',
                      fontSize: '1rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 20px rgba(16, 185, 129, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                    }}
                  >
                    <ShoppingCart size={18} />
                    View Cart {cartItemCount > 0 && `(${cartItemCount})`}
                  </button>

                  <button
                    onClick={handleLogout}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '16px 24px',
                      backgroundColor: '#f8fafc',
                      color: '#dc2626',
                      borderRadius: '12px',
                      border: '1px solid #fecaca',
                      fontSize: '1rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#fef2f2';
                      e.currentTarget.style.borderColor = '#f87171';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                      e.currentTarget.style.borderColor = '#fecaca';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <LogOut size={18} />
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e5e7eb',
              padding: '64px 32px',
              textAlign: 'center'
            }}>
              <div style={{
                width: '80px',
                height: '80px',
                backgroundColor: '#f1f5f9',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px'
              }}>
                <User style={{ width: '40px', height: '40px', color: '#94a3b8' }} />
              </div>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: '600',
                color: '#111827',
                marginBottom: '8px'
              }}>
                Profile not loaded
              </h3>
              <p style={{
                color: '#6b7280',
                fontSize: '1rem',
                marginBottom: '32px'
              }}>
                Please try refreshing the page or contact support if the issue persists.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Main navigation
  const Navigation: React.FC = () => (
    <nav style={{ 
      backgroundColor: 'white', 
      borderBottom: '1px solid #e5e7eb', 
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', 
      position: 'sticky', 
      top: 0, 
      zIndex: 50 
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '144px' }}>
          {/* Logo Section */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              {/* Logo Container */}
              <div className="flex items-center justify-center h-32 w-auto">
                <img 
                  src="https://xarnvryaicseavgnmtjn.supabase.co/storage/v1/object/public/assets//Logo_Rev1.png"
                  alt="Parts Partner" 
                  className="h-full w-auto object-contain"
                />
              </div>
              
              {/* Brand Text */}
              <div className="hidden sm:block">
                <h1 className="text-4xl font-bold text-gray-900 leading-tight font-bold">Parts Partner</h1>
                <p className="text-sm text-gray-600 font-medium">Right Part. Right Now.</p>
              </div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div style={{ display: window.innerWidth >= 1024 ? 'flex' : 'none', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={() => setActivePage('search')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: '8px',
                fontSize: '1.125rem',
                fontWeight: '500',
                transition: 'all 0.2s',
                backgroundColor: activePage === 'search' ? '#eff6ff' : 'transparent',
                color: activePage === 'search' ? '#374151' : '#374151',
                border: activePage === 'search' ? '1px solid #dbeafe' : '1px solid transparent',
                boxShadow: activePage === 'search' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                if (activePage !== 'search') {
                  e.currentTarget.style.color = '#1d4ed8';
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                }
              }}
              onMouseLeave={(e) => {
                if (activePage !== 'search') {
                  e.currentTarget.style.color = '#374151';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <Search size={16} style={{ transition: 'transform 0.2s' }} />
              Search Parts
            </button>

            <button
              onClick={() => setActivePage('cart')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: '8px',
                fontSize: '1.125rem',
                fontWeight: '500',
                transition: 'all 0.2s',
                backgroundColor: activePage === 'cart' ? '#eff6ff' : 'transparent',
                color: activePage === 'cart' ? '#374151' : '#374151',
                border: activePage === 'cart' ? '1px solid #dbeafe' : '1px solid transparent',
                boxShadow: activePage === 'cart' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                cursor: 'pointer',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                if (activePage !== 'cart') {
                  e.currentTarget.style.color = '#1d4ed8';
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                }
              }}
              onMouseLeave={(e) => {
                if (activePage !== 'cart') {
                  e.currentTarget.style.color = '#374151';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <ShoppingCart size={16} style={{ transition: 'transform 0.2s' }} />
              Cart
              {cartItemCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  fontSize: '0.75rem',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '500',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  {cartItemCount}
                </span>
              )}
            </button>

            {userProfile?.user_type === 'admin' && (
              <button
                onClick={() => setActivePage('admin')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                  backgroundColor: activePage === 'admin' ? '#faf5ff' : 'transparent',
                  color: activePage === 'admin' ? '#7c3aed' : '#374151',
                  border: activePage === 'admin' ? '1px solid #e9d5ff' : '1px solid transparent',
                  boxShadow: activePage === 'admin' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  if (activePage !== 'admin') {
                    e.currentTarget.style.color = '#7c3aed';
                    e.currentTarget.style.backgroundColor = '#faf5ff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activePage !== 'admin') {
                    e.currentTarget.style.color = '#374151';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <Upload size={16} style={{ transition: 'transform 0.2s' }} />
                Admin
                <span style={{
                  marginLeft: '4px',
                  padding: '2px 8px',
                  background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)',
                  color: 'white',
                  fontSize: '0.75rem',
                  borderRadius: '12px',
                  fontWeight: '500',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}>
                  ADMIN
                </span>
              </button>
            )}

            <button
              onClick={() => setActivePage('profile')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: '8px',
                fontSize: '1.125rem',
                fontWeight: '500',
                transition: 'all 0.2s',
                backgroundColor: activePage === 'profile' ? '#eff6ff' : 'transparent',
                color: activePage === 'profile' ? '#374151' : '#374151',
                border: activePage === 'profile' ? '1px solid #dbeafe' : '1px solid transparent',
                boxShadow: activePage === 'profile' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                if (activePage !== 'profile') {
                  e.currentTarget.style.color = '#1d4ed8';
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                }
              }}
              onMouseLeave={(e) => {
                if (activePage !== 'profile') {
                  e.currentTarget.style.color = '#374151';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <User size={16} style={{ transition: 'transform 0.2s' }} />
              Profile
            </button>

            {/* Divider */}
            <div style={{ height: '24px', width: '1px', backgroundColor: '#d1d5db', margin: '0 12px' }}></div>

            {/* User Info */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '6px 12px',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #7c3aed 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <User size={14} style={{ color: 'white' }} />
              </div>
              <div style={{ display: window.innerWidth >= 1280 ? 'block' : 'none', fontSize: '0.875rem' }}>
                <div style={{ fontWeight: '500', color: '#111827', lineHeight: '1.2' }}>
                  {userProfile?.full_name || 'User'}
                </div>
                <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                  {userProfile?.discount_percentage || 0}% discount
                </div>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#dc2626',
                border: '1px solid transparent',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#b91c1c';
                e.currentTarget.style.backgroundColor = '#fef2f2';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#dc2626';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <LogOut size={16} style={{ transition: 'transform 0.2s' }} />
              <span style={{ display: window.innerWidth >= 1280 ? 'inline' : 'none' }}>Logout</span>
            </button>
          </div>

          {/* Mobile/Tablet Navigation */}
          <div className="lg:hidden flex items-center gap-3">
            {/* Cart Badge for Mobile */}
            <button
              onClick={() => setActivePage('cart')}
              className="relative p-2 text-gray-700 hover:text-blue-700 hover:bg-gray-50 rounded-lg transition-all duration-200"
            >
              <ShoppingCart size={20} />
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                  {cartItemCount}
                </span>
              )}
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-gray-700 hover:text-blue-700 hover:bg-gray-50 rounded-lg transition-all duration-200 border border-gray-200"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 bg-white">
            <div className="px-4 py-3 space-y-1">
              <button
                onClick={() => {
                  setActivePage('search');
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activePage === 'search'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-gray-700 hover:text-blue-700 hover:bg-gray-50'
                }`}
              >
                <Search size={18} />
                Search Parts
              </button>
              
              <button
                onClick={() => {
                  setActivePage('cart');
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activePage === 'cart'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-gray-700 hover:text-blue-700 hover:bg-gray-50'
                }`}
              >
                <ShoppingCart size={18} />
                Cart
                {cartItemCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
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
                  className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                    activePage === 'admin'
                      ? 'bg-purple-50 text-purple-700 border border-purple-200'
                      : 'text-gray-700 hover:text-purple-700 hover:bg-purple-50'
                  }`}
                >
                  <Upload size={18} />
                  Admin Panel
                  <span className="ml-auto px-2 py-0.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs rounded-full font-medium">
                    ADMIN
                  </span>
                </button>
              )}

              <button
                onClick={() => {
                  setActivePage('profile');
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activePage === 'profile'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-gray-700 hover:text-blue-700 hover:bg-gray-50'
                }`}
              >
                <User size={18} />
                Profile
              </button>

              {/* User Info Section */}
              <div className="px-4 py-3 bg-gray-50 rounded-lg border border-gray-200 mt-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <User size={16} className="text-white" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 text-sm">
                      {userProfile?.full_name || 'User'}
                    </div>
                    <div className="text-gray-600 text-xs">
                      {userProfile?.discount_percentage}% discount • {userProfile?.user_type}
                    </div>
                  </div>
                </div>
              </div>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 transition-all duration-200 mt-2"
              >
                <LogOut size={18} />
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
    <div className="min-h-screen bg-white-50">
      <Navigation />
      
      <main className="relative">
        <div className="py-8">
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