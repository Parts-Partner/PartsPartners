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
  X,
  ArrowLeft
} from 'lucide-react';

// Import your components
import PartsSearch from './parts-search-component';
import CSVImportSystem from './csv_import_system';
import PaymentFlow from './PaymentFlow';
import TechFinder from './GoogleMapsTechFinder';
import MockUPSFreightCalculator from './MockUPSFreightCalculator';
import BulkOrder from './BulkOrder';


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
  weight?: number;    
  length?: number;      
  width?: number;     
  height?: number;    
  hazmat?: boolean;   
}

interface UPSService {
  service_code: string;
  service_name: string;
  total_charges: number;
  customer_rate: number;
  transit_days?: string;
  delivery_date?: string;
}

type ActivePage = 'search' | 'cart' | 'admin' | 'profile' | 'login' | 'privacy' | 'terms' | 'cookies' | 'accessibility' | 'shipping' | 'contact';

const OEMPartsApp: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activePage, setActivePage] = useState<ActivePage>('search');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [showPaymentFlow, setShowPaymentFlow] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showTechFinder, setShowTechFinder] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedFreight, setSelectedFreight] = useState<UPSService | null>(null);
  const [showBulkOrder, setShowBulkOrder] = useState(false);

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
      setActivePage('search');
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

  const handleBulkAddToCart = (items: any[]) => {
  items.forEach(item => {
    const unitPrice = typeof item.list_price === 'string' ? parseFloat(item.list_price) : item.list_price;
    const discountPercentage = userProfile?.discount_percentage || 0;
    const discountedPrice = unitPrice * (1 - discountPercentage / 100);

    setCartItems(prev => {
      const existingItem = prev.find(cartItem => cartItem.id === item.id);
      
      if (existingItem) {
        return prev.map(cartItem =>
          cartItem.id === item.id
            ? {
                ...cartItem,
                quantity: cartItem.quantity + item.quantity,
                line_total: (cartItem.quantity + item.quantity) * discountedPrice
              }
            : cartItem
        );
      } else {
        return [...prev, {
          ...item,
          quantity: item.quantity,
          unit_price: unitPrice,
          discounted_price: discountedPrice,
          line_total: item.quantity * discountedPrice
        }];
      }
    });
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

  const handlePaymentSuccess = () => {
    setCartItems([]);
    setShowPaymentFlow(false);
    setActivePage('search');
  };

  const handleCartSubmit = () => {
    if (!user) {
      setShowLoginModal(true);
    } else if (!selectedFreight && cartItems.length > 0) {
      alert('Please select a shipping method first');
    } else {
      setShowPaymentFlow(true);
    }
  };

  const cartSubtotal = cartItems.reduce((sum, item) => sum + item.line_total, 0);
  const freightCost = selectedFreight?.customer_rate || 0;
  const cartTotal = cartSubtotal + freightCost;
  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Legal Pages Components
const LegalPage: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ 
    minHeight: '100vh', 
    background: 'linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)',
    padding: '32px 16px'
  }}>
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e5e7eb',
        padding: '48px',
        marginBottom: '32px'
      }}>
        <div style={{ marginBottom: '32px' }}>
          <button
            onClick={() => setActivePage('search')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              backgroundColor: '#f8fafc',
              color: '#4b5563',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              marginBottom: '24px'
            }}
          >
            <ArrowLeft size={16} />
            Back to Parts Search
          </button>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            color: '#111827',
            margin: 0,
            marginBottom: '16px'
          }}>
            {title}
          </h1>
        </div>
        <div style={{
          lineHeight: '1.6',
          color: '#374151',
          fontSize: '1rem'
        }}>
          {children}
        </div>
      </div>
    </div>
  </div>
);

const PrivacyPolicyPage: React.FC = () => (
  <LegalPage title="Privacy Policy">
    <div style={{ marginBottom: '24px' }}>
      <strong>Effective Date:</strong> January 1, 2025
    </div>
    
    <p>At Parts Partners, we respect your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our services.</p>

    <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', marginTop: '32px', marginBottom: '16px' }}>
      Information We Collect
    </h2>
    
    <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827', marginTop: '24px', marginBottom: '12px' }}>
      Personal Information You Provide:
    </h3>
    <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
      <li>Name, email address, phone number</li>
      <li>Company name and business information</li>
      <li>Billing and shipping addresses</li>
      <li>Account credentials and preferences</li>
      <li>Order history and part inquiries</li>
      <li>Communications with our support team</li>
    </ul>

    <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827', marginTop: '24px', marginBottom: '12px' }}>
      Information Automatically Collected:
    </h3>
    <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
      <li>IP address and device information</li>
      <li>Browser type and operating system</li>
      <li>Pages visited and time spent on our site</li>
      <li>Referral sources and search terms</li>
      <li>Cookies and similar tracking technologies</li>
    </ul>

    <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', marginTop: '32px', marginBottom: '16px' }}>
      How We Use Your Information
    </h2>
    <p>We use your information to:</p>
    <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
      <li>Process orders and provide customer service</li>
      <li>Maintain your account and preferences</li>
      <li>Send order confirmations and shipping updates</li>
      <li>Provide technical support and troubleshooting</li>
      <li>Improve our website and services</li>
      <li>Send marketing communications (with your consent)</li>
      <li>Comply with legal obligations</li>
      <li>Prevent fraud and ensure security</li>
    </ul>

    <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', marginTop: '32px', marginBottom: '16px' }}>
      Your Rights and Choices
    </h2>
    <p><strong>For All Users:</strong></p>
    <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
      <li><strong>Access and Correction:</strong> Request access to or correction of your personal information</li>
      <li><strong>Deletion:</strong> Request deletion of your personal information (subject to legal requirements)</li>
      <li><strong>Data Portability:</strong> Request a copy of your data in a portable format</li>
      <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications</li>
    </ul>

    <p><strong>For EU Residents (GDPR):</strong></p>
    <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
      <li>Right to object to processing</li>
      <li>Right to restrict processing</li>
      <li>Right to lodge complaints with supervisory authorities</li>
    </ul>

    <p><strong>For California Residents (CCPA/CPRA):</strong></p>
    <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
      <li>Right to know what personal information is collected</li>
      <li>Right to delete personal information</li>
      <li>Right to opt-out of sale of personal information</li>
      <li>Right to non-discrimination for exercising privacy rights</li>
    </ul>

    <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', marginTop: '32px', marginBottom: '16px' }}>
      Contact Us
    </h2>
    <p>For questions about this Privacy Policy or to exercise your rights, contact us at:</p>
    <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
      <li><strong>Email:</strong> privacy@partspartners.com</li>
      <li><strong>Phone:</strong> [Your Phone Number]</li>
      <li><strong>Address:</strong> [Your Business Address]</li>
    </ul>

    <div style={{ 
      marginTop: '32px', 
      padding: '16px', 
      backgroundColor: '#f3f4f6', 
      borderRadius: '8px',
      fontSize: '0.875rem',
      fontStyle: 'italic',
      color: '#6b7280'
    }}>
      This policy is for informational purposes and may be updated. It is not legal advice.
    </div>
  </LegalPage>
);

const TermsOfServicePage: React.FC = () => (
  <LegalPage title="Terms of Service">
    <div style={{ marginBottom: '24px' }}>
      <strong>Effective Date:</strong> January 1, 2025
    </div>
    
    <p>Welcome to Parts Partners. These Terms of Service ("Terms") govern your use of our website and services. By accessing or using our services, you agree to be bound by these Terms.</p>

    <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', marginTop: '32px', marginBottom: '16px' }}>
      Description of Services
    </h2>
    <p>Parts Partners provides an online platform for searching, quoting, and purchasing OEM parts and related products. We facilitate transactions between buyers and authorized suppliers.</p>

    <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', marginTop: '32px', marginBottom: '16px' }}>
      Account Registration
    </h2>
    <p>To use certain features, you must create an account and provide accurate, complete information. You are responsible for:</p>
    <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
      <li>Maintaining the confidentiality of your account credentials</li>
      <li>All activities that occur under your account</li>
      <li>Notifying us immediately of unauthorized use</li>
    </ul>

    <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', marginTop: '32px', marginBottom: '16px' }}>
      Orders and Pricing
    </h2>
    <p><strong>Pricing:</strong> All prices are subject to change without notice. Account-specific pricing and discounts apply where applicable.</p>
    <p><strong>Orders:</strong> By placing an order, you make an offer to purchase products at the listed prices. We reserve the right to accept or decline any order.</p>
    <p><strong>Payment:</strong> Payment is processed through Stripe. You authorize us to charge your payment method for all fees and taxes.</p>

    <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', marginTop: '32px', marginBottom: '16px' }}>
      Returns and Refunds
    </h2>
    <p><strong>Non-Returnable Items:</strong> Most OEM parts are non-returnable due to their specialized nature and industry standards.</p>
    <p><strong>Defective or Damaged Items:</strong> We will replace or refund items that arrive defective or damaged, provided you notify us within 7 days of delivery.</p>

    <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', marginTop: '32px', marginBottom: '16px' }}>
      Limitation of Liability
    </h2>
    <p>To the maximum extent permitted by law, Parts Partners and its affiliates shall not be liable for:</p>
    <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
      <li>Indirect, incidental, special, or consequential damages</li>
      <li>Loss of profits, data, or business opportunities</li>
      <li>Damages exceeding the amount paid for products or services</li>
    </ul>

    <div style={{ 
      marginTop: '32px', 
      padding: '16px', 
      backgroundColor: '#f3f4f6', 
      borderRadius: '8px',
      fontSize: '0.875rem',
      fontStyle: 'italic',
      color: '#6b7280'
    }}>
      This policy is for informational purposes and may be updated. It is not legal advice.
    </div>
  </LegalPage>
);

const CookiePolicyPage: React.FC = () => (
  <LegalPage title="Cookie Policy">
    <div style={{ marginBottom: '24px' }}>
      <strong>Effective Date:</strong> January 1, 2025
    </div>
    
    <p>This Cookie Policy explains how Parts Partners uses cookies and similar technologies on our website.</p>

    <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', marginTop: '32px', marginBottom: '16px' }}>
      What Are Cookies
    </h2>
    <p>Cookies are small text files stored on your device when you visit websites. They help websites remember your preferences and improve your browsing experience.</p>

    <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', marginTop: '32px', marginBottom: '16px' }}>
      Types of Cookies We Use
    </h2>
    
    <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827', marginTop: '24px', marginBottom: '12px' }}>
      Essential Cookies (Required)
    </h3>
    <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
      <li>Authentication and security cookies</li>
      <li>Shopping cart and session management</li>
      <li>Load balancing and performance optimization</li>
      <li>These cookies are necessary for basic website functionality</li>
    </ul>

    <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827', marginTop: '24px', marginBottom: '12px' }}>
      Analytics Cookies (Optional)
    </h3>
    <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
      <li>Google Analytics: Track website usage and performance</li>
      <li>Cloudflare Analytics: Monitor site security and performance</li>
      <li>Help us understand how visitors use our site</li>
    </ul>

    <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', marginTop: '32px', marginBottom: '16px' }}>
      Managing Cookie Preferences
    </h2>
    <p>You can control cookies through your browser settings:</p>
    <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
      <li><strong>Chrome:</strong> Settings → Privacy and Security → Cookies</li>
      <li><strong>Firefox:</strong> Settings → Privacy & Security → Cookies</li>
      <li><strong>Safari:</strong> Preferences → Privacy → Cookies</li>
      <li><strong>Edge:</strong> Settings → Cookies and Site Permissions</li>
    </ul>

    <div style={{ 
      marginTop: '32px', 
      padding: '16px', 
      backgroundColor: '#f3f4f6', 
      borderRadius: '8px',
      fontSize: '0.875rem',
      fontStyle: 'italic',
      color: '#6b7280'
    }}>
      This policy is for informational purposes and may be updated. It is not legal advice.
    </div>
  </LegalPage>
);

const AccessibilityPage: React.FC = () => (
  <LegalPage title="Accessibility Statement">
    <div style={{ marginBottom: '24px' }}>
      <strong>Effective Date:</strong> January 1, 2025
    </div>
    
    <p>Parts Partners is committed to ensuring digital accessibility for people with disabilities. We continually improve the user experience for everyone and apply relevant accessibility standards.</p>

    <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', marginTop: '32px', marginBottom: '16px' }}>
      Our Commitment
    </h2>
    <p>We strive to make our website accessible to all users, including those who rely on assistive technologies. Our goal is to meet or exceed Web Content Accessibility Guidelines (WCAG) 2.1 Level AA standards.</p>

    <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', marginTop: '32px', marginBottom: '16px' }}>
      Accessibility Features
    </h2>
    <p>Our website includes:</p>
    <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
      <li>Keyboard navigation support</li>
      <li>Screen reader compatibility</li>
      <li>Alternative text for images</li>
      <li>Consistent navigation structure</li>
      <li>Clear headings and labels</li>
      <li>Sufficient color contrast</li>
      <li>Resizable text up to 200%</li>
    </ul>

    <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', marginTop: '32px', marginBottom: '16px' }}>
      Feedback and Contact
    </h2>
    <p>We welcome feedback on the accessibility of our website. If you encounter accessibility barriers or need assistance:</p>
    <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
      <li><strong>Email:</strong> accessibility@partspartners.com</li>
      <li><strong>Phone:</strong> [Your Phone Number]</li>
      <li><strong>Address:</strong> [Your Business Address]</li>
    </ul>

    <div style={{ 
      marginTop: '32px', 
      padding: '16px', 
      backgroundColor: '#f3f4f6', 
      borderRadius: '8px',
      fontSize: '0.875rem',
      fontStyle: 'italic',
      color: '#6b7280'
    }}>
      This statement is for informational purposes and may be updated. It is not legal advice.
    </div>
  </LegalPage>
);

const ShippingPolicyPage: React.FC = () => (
  <LegalPage title="Shipping & Returns Policy">
    <div style={{ marginBottom: '24px' }}>
      <strong>Effective Date:</strong> January 1, 2025
    </div>

    <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', marginTop: '32px', marginBottom: '16px' }}>
      Shipping Policy
    </h2>
    <p><strong>Processing Time:</strong> Orders are typically processed within 1-2 business days after payment confirmation.</p>
    
    <p><strong>Shipping Methods:</strong></p>
    <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
      <li>Standard Shipping: 3-7 business days</li>
      <li>Expedited Shipping: 1-3 business days</li>
      <li>Freight Shipping: 5-10 business days for large items</li>
    </ul>

    <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', marginTop: '32px', marginBottom: '16px' }}>
      Return Policy
    </h2>
    <div style={{ 
      padding: '16px', 
      backgroundColor: '#fef3c7', 
      border: '1px solid #f59e0b', 
      borderRadius: '8px',
      marginBottom: '16px'
    }}>
      <strong>Important:</strong> Most OEM parts are manufactured to specific equipment requirements and are considered special-order items. Due to industry standards and the specialized nature of these products, <strong>most parts are non-returnable and non-refundable</strong> once ordered.
    </div>

    <p><strong>Non-Returnable Items:</strong></p>
    <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
      <li>Custom or special-order parts</li>
      <li>Electrical components and electronic parts</li>
      <li>Parts that have been installed or used</li>
      <li>Items without original packaging</li>
      <li>Hazardous materials</li>
    </ul>

    <p><strong>Returnable Items (Limited Circumstances):</strong></p>
    <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
      <li>Items that arrive damaged or defective</li>
      <li>Products that are significantly different from description</li>
      <li>Items shipped in error by our team</li>
    </ul>

    <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', marginTop: '32px', marginBottom: '16px' }}>
      Contact for Returns and Shipping
    </h2>
    <p>For questions about shipping or to initiate a return:</p>
    <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
      <li><strong>Email:</strong> returns@partspartners.com</li>
      <li><strong>Phone:</strong> [Your Phone Number]</li>
      <li><strong>Address:</strong> [Your Business Address]</li>
    </ul>

    <div style={{ 
      marginTop: '32px', 
      padding: '16px', 
      backgroundColor: '#f3f4f6', 
      borderRadius: '8px',
      fontSize: '0.875rem',
      fontStyle: 'italic',
      color: '#6b7280'
    }}>
      This policy is for informational purposes and may be updated. It is not legal advice.
    </div>
  </LegalPage>
);

const ContactPage: React.FC = () => (
  <LegalPage title="Contact Us">
    <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', marginTop: '32px', marginBottom: '16px' }}>
      Customer Service
    </h2>
    <p><strong>Email:</strong> support@partspartners.com</p>
    <p><strong>Phone:</strong> [Your Phone Number]</p>
    <p><strong>Hours:</strong> Monday - Friday, 8:00 AM - 6:00 PM EST</p>

    <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', marginTop: '32px', marginBottom: '16px' }}>
      Business Address
    </h2>
    <p>Parts Partners<br />
    [Your Street Address]<br />
    [City, State ZIP Code]<br />
    [Country]</p>

    <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', marginTop: '32px', marginBottom: '16px' }}>
      Specialized Contact
    </h2>
    <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
      <li><strong>Technical Support:</strong> tech@partspartners.com</li>
      <li><strong>Returns & Refunds:</strong> returns@partspartners.com</li>
      <li><strong>Privacy Questions:</strong> privacy@partspartners.com</li>
      <li><strong>Accessibility Support:</strong> accessibility@partspartners.com</li>
      <li><strong>Sales Inquiries:</strong> sales@partspartners.com</li>
    </ul>
  </LegalPage>
);

  // Footer Component
  const Footer: React.FC = () => (
    <footer style={{ 
      backgroundColor: '#f9fafb', 
      borderTop: '1px solid #e5e7eb', 
      padding: '32px 16px',
      marginTop: 'auto'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          justifyContent: 'center', 
          gap: '24px', 
          fontSize: '14px', 
          marginBottom: '16px' 
        }}>
          <button 
            onClick={() => setActivePage('privacy')}
            style={{ 
              color: '#6b7280', 
              textDecoration: 'none',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Privacy Policy
          </button>
          <span style={{ color: '#9ca3af' }}>|</span>
          <button 
            onClick={() => setActivePage('terms')}
            style={{ 
              color: '#6b7280', 
              textDecoration: 'none',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Terms of Service
          </button>
          <span style={{ color: '#9ca3af' }}>|</span>
          <button 
            onClick={() => setActivePage('cookies')}
            style={{ 
              color: '#6b7280', 
              textDecoration: 'none',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Cookie Policy
          </button>
          <span style={{ color: '#9ca3af' }}>|</span>
          <button 
            onClick={() => setActivePage('accessibility')}
            style={{ 
              color: '#6b7280', 
              textDecoration: 'none',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Accessibility
          </button>
          <span style={{ color: '#9ca3af' }}>|</span>
          <button 
            onClick={() => setActivePage('shipping')}
            style={{ 
              color: '#6b7280', 
              textDecoration: 'none',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Shipping & Returns
          </button>
          <span style={{ color: '#9ca3af' }}>|</span>
          <button 
            onClick={() => setActivePage('contact')}
            style={{ 
              color: '#6b7280', 
              textDecoration: 'none',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Contact Us
          </button>
        </div>
        <div style={{ color: '#6b7280', fontSize: '12px' }}>
          © 2025 Parts Partners. All rights reserved.
        </div>
      </div>
    </footer>
  );

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
                  onClick={() => {
                    setShowLoginModal(false);
                    setActivePage('login'); // This will show your existing login page
                  }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
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

// CartPage component
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
                Review your selected parts and get shipping quote
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
                  ${cartSubtotal.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                  Parts Subtotal
                </div>
              </div>
              {selectedFreight && (
                <>
                  <div style={{ width: '1px', height: '40px', backgroundColor: '#e2e8f0' }}></div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#dc2626' }}>
                      ${selectedFreight.customer_rate.toFixed(2)}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                      Shipping
                    </div>
                  </div>
                </>
              )}
              <div style={{ width: '1px', height: '40px', backgroundColor: '#e2e8f0' }}></div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#111827' }}>
                  ${cartTotal.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                  Total
                </div>
              </div>
              {userProfile?.discount_percentage && userProfile.discount_percentage > 0 && (
                <>
                  <div style={{ width: '1px', height: '40px', backgroundColor: '#e2e8f0' }}></div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#059669' }}>
                      {userProfile.discount_percentage}%
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                      Discount Applied
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
          /* Cart Items and Freight Calculator */
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '32px' }}>
            {/* Left Column - Cart Items */}
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
            </div>

            {/* Right Column - Freight Calculator */}
            <div style={{ position: 'sticky', top: '32px', height: 'fit-content' }}>
              <MockUPSFreightCalculator
                cartItems={cartItems.map(item => ({
                  id: item.id,
                  part_number: item.part_number,
                  quantity: item.quantity,
                  weight: item.weight || 1, // Default weight if not set
                  length: item.length || 12,
                  width: item.width || 12,
                  height: item.height || 6,
                  hazmat: item.hazmat || false
                }))}
                onFreightSelect={(freight) => setSelectedFreight(freight)}
                selectedFreight={selectedFreight}
              />
            </div>
          </div>
        )}

        {/* Checkout Section - Only show if cart has items */}
        {cartItems.length > 0 && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e5e7eb',
            padding: '32px',
            marginTop: '32px'
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
                <div style={{ color: '#6b7280', fontSize: '1rem' }}>
                  <div style={{ marginBottom: '4px' }}>
                    Parts Subtotal: <span style={{ fontWeight: '600', color: '#111827' }}>${cartSubtotal.toFixed(2)}</span>
                  </div>
                  {selectedFreight && (
                    <div style={{ marginBottom: '4px' }}>
                      Shipping ({selectedFreight.service_name}): <span style={{ fontWeight: '600', color: '#111827' }}>${selectedFreight.customer_rate.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#111827', marginTop: '8px' }}>
                    Total: ${cartTotal.toFixed(2)}
                  </div>
                  {userProfile?.discount_percentage && userProfile.discount_percentage > 0 && (
                    <div style={{ color: '#059669', fontSize: '0.875rem', marginTop: '4px' }}>
                      ({userProfile.discount_percentage}% parts discount applied)
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={handleCartSubmit}
                disabled={!selectedFreight && cartItems.length > 0}
                style={{
                  background: selectedFreight 
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)',
                  color: 'white',
                  padding: '16px 32px',
                  borderRadius: '12px',
                  border: 'none',
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  cursor: selectedFreight ? 'pointer' : 'not-allowed',
                  boxShadow: selectedFreight 
                    ? '0 4px 12px rgba(16, 185, 129, 0.3)'
                    : '0 4px 12px rgba(156, 163, 175, 0.3)',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => {
                  if (selectedFreight) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(16, 185, 129, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = selectedFreight 
                    ? '0 4px 12px rgba(16, 185, 129, 0.3)'
                    : '0 4px 12px rgba(156, 163, 175, 0.3)';
                }}
              >
                {!selectedFreight && cartItems.length > 0 
                  ? 'Select Shipping Method' 
                  : user 
                    ? 'Submit Purchase Order' 
                    : 'Login to Complete Order'
                }
              </button>
            </div>

            {!selectedFreight && cartItems.length > 0 && (
              <div style={{
                marginTop: '16px',
                padding: '12px',
                backgroundColor: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{ color: '#d97706', fontSize: '0.875rem' }}>
                  ⚠️ Please select a shipping method to continue
                </div>
              </div>
            )}
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
                <p className="text-sm text-gray-600 font-medium">Parts Now.</p>
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

  // Main app layout
return (
  <div className="min-h-screen bg-white-50">
    {/* Modern Header */}
    <header style={{
      backgroundColor: 'white',
      borderBottom: '1px solid #e5e7eb',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      position: 'sticky',
      top: 0,
      zIndex: 40
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '120px'
      }}>
    {/* Logo and Brand */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <img 
        src="https://xarnvryaicseavgnmtjn.supabase.co/storage/v1/object/public/assets//Logo_Rev1.png"
        alt="Parts Partners Logo"
        style={{
          height: '100px',
          width: 'auto',
          cursor: 'pointer'
        }}
        onClick={() => setActivePage('search')}
      />
      
      <div>
        <h1 style={{
          fontSize: '2.24rem',
          fontWeight: 'bold',
          color: '#111827',
          margin: 0,
          cursor: 'pointer'
        }}
        onClick={() => setActivePage('search')}
        >
          Parts Partners
        </h1>
        <p style={{
          fontSize: '1.5rem',
          color: '#6b7280',
          margin: '-16px 0 0 0'
        }}>
          Parts Now.
        </p>
      </div>
    </div>

    {/* Right Side Actions */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {/* Bulk Order Button - Only show if user is logged in */}
      {user && (
        <button
          onClick={() => setShowBulkOrder(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            background: 'linear-gradient(135deg, #8f0202ff 0%, #cc6e6eff 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.875rem',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Bulk Order
        </button>
      )}

      {/* Find Tech Button */}
      <button
        onClick={() => setShowTechFinder(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 16px',
          background: 'linear-gradient(135deg, #8f0202ff 0%, #cc6e6eff 100%)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '0.875rem',
          fontWeight: '600',
          cursor: 'pointer'
        }}
      >
        Find Tech
      </button>

      {/* Cart Button */}
      <button
        onClick={() => setActivePage('cart')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 16px',
          backgroundColor: 'transparent',
          color: '#4b5563',
          border: '2px solid #e5e7eb',
          borderRadius: '8px',
          fontSize: '0.875rem',
          fontWeight: '600',
          cursor: 'pointer'
        }}
      >
        Cart {cartItemCount > 0 && `(${cartItemCount})`}
      </button>

      {/* User Authentication Buttons */}
      {user ? (
        /* Logged In - Show Profile + Logout */
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setActivePage('profile')}
            style={{
              padding: '8px 16px',
              backgroundColor: 'transparent',
              color: '#4b5563',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Profile
          </button>
          
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 16px',
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>
      ) : (
        /* Not Logged In - Show Login + Register Buttons */
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setShowLoginModal(true)}
            style={{
              padding: '8px 16px',
              backgroundColor: 'transparent',
              color: '#4b5563',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Login
          </button>
          
          <button
            onClick={() => setShowRegisterModal(true)}
            style={{
              padding: '8px 16px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Register
          </button>
        </div>
      )}
    </div>
        </div>
        </header>
    
    <main className="relative">
      <div className="py-8">
        {activePage === 'search' && (
          <PartsSearch 
            onAddToCart={handleAddToCart}
            cartItems={cartItems}
            onUpdateQuantity={handleUpdateQuantity}
          />
        )}

        {activePage === 'privacy' && <PrivacyPolicyPage />}
        {activePage === 'terms' && <TermsOfServicePage />}
        {activePage === 'cookies' && <CookiePolicyPage />}
        {activePage === 'accessibility' && <AccessibilityPage />}
        {activePage === 'shipping' && <ShippingPolicyPage />}
        {activePage === 'contact' && <ContactPage />}
        
        {activePage === 'cart' && <CartPage />}
        
        {activePage === 'admin' && userProfile?.user_type === 'admin' && (
          <div className="max-w-6xl mx-auto px-4">
            <CSVImportSystem />
          </div>
        )}
        
        {activePage === 'profile' && <ProfilePage />}
      </div>
    </main>

    {/* Tech Finder Modal */}
    {showTechFinder && (
      <TechFinder
        isOpen={showTechFinder}
        onClose={() => setShowTechFinder(false)}
      />
    )}

    {/* Login Modal */}
    {showLoginModal && (
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        zIndex: 50
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', margin: 0 }}>
              Sign In
            </h2>
            <button
              onClick={() => setShowLoginModal(false)}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                fontSize: '1.5rem',
                color: '#6b7280',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          </div>
          
          <form onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const email = formData.get('email') as string;
            const password = formData.get('password') as string;
            
            try {
              await handleLogin(email, password);
              setShowLoginModal(false);
              setActivePage('search');
            } catch (error: any) {
              alert('Login failed: ' + error.message);
            }
          }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '0.875rem', 
                fontWeight: '500', 
                color: '#374151', 
                marginBottom: '6px' 
              }}>
                Email
              </label>
              <input
                type="email"
                name="email"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  outline: 'none'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '0.875rem', 
                fontWeight: '500', 
                color: '#374151', 
                marginBottom: '6px' 
              }}>
                Password
              </label>
              <input
                type="password"
                name="password"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  outline: 'none'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
              />
            </div>

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '12px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    )}

    {/* Register Modal */}
    {showRegisterModal && (
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        zIndex: 50
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '450px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', margin: 0 }}>
              Create Account
            </h2>
            <button
              onClick={() => setShowRegisterModal(false)}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                fontSize: '1.5rem',
                color: '#6b7280',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          </div>
          
          <form onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const email = formData.get('email') as string;
            const password = formData.get('password') as string;
            const fullName = formData.get('fullName') as string;
            const companyName = formData.get('companyName') as string;
            const phone = formData.get('phone') as string;
            
            try {
              await handleSignup(email, password, fullName);
              setShowRegisterModal(false);
              alert('Registration successful! Please check your email to verify your account.');
            } catch (error: any) {
              alert('Registration failed: ' + error.message);
            }
          }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '0.875rem', 
                fontWeight: '500', 
                color: '#374151', 
                marginBottom: '6px' 
              }}>
                Full Name *
              </label>
              <input
                type="text"
                name="fullName"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  outline: 'none'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '0.875rem', 
                fontWeight: '500', 
                color: '#374151', 
                marginBottom: '6px' 
              }}>
                Email *
              </label>
              <input
                type="email"
                name="email"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  outline: 'none'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '0.875rem', 
                fontWeight: '500', 
                color: '#374151', 
                marginBottom: '6px' 
              }}>
                Company Name
              </label>
              <input
                type="text"
                name="companyName"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  outline: 'none'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '0.875rem', 
                fontWeight: '500', 
                color: '#374151', 
                marginBottom: '6px' 
              }}>
                Phone
              </label>
              <input
                type="tel"
                name="phone"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  outline: 'none'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '0.875rem', 
                fontWeight: '500', 
                color: '#374151', 
                marginBottom: '6px' 
              }}>
                Password *
              </label>
              <input
                type="password"
                name="password"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  outline: 'none'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
              />
            </div>

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '12px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Create Account
            </button>
          </form>

        <p style={{ 
          fontSize: '0.75rem', 
          color: '#6b7280', 
          textAlign: 'center', 
          marginTop: '16px',
          lineHeight: '1.4'
        }}>
          By creating an account, you agree to our{' '}
          <button
            onClick={() => {
              setShowRegisterModal(false);
              setActivePage('terms');
            }}
            style={{
              color: '#3b82f6',
              textDecoration: 'underline',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.75rem'
            }}
          >
            terms of service
          </button>{' '}
          and{' '}
          <button
            onClick={() => {
              setShowRegisterModal(false);
              setActivePage('privacy');
            }}
            style={{
              color: '#3b82f6',
              textDecoration: 'underline',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.75rem'
            }}
          >
            privacy policy
          </button>
          . You'll receive an email to verify your account.
        </p>
        </div>
      </div>
    )}

      {showPaymentFlow && (
      <PaymentFlow
        cartItems={cartItems}
        cartTotal={cartTotal}
        userDiscount={userProfile?.discount_percentage || 0}
        onSuccess={handlePaymentSuccess}
        onClose={() => setShowPaymentFlow(false)}
        userProfile={userProfile}
      />
    )}
    {/* Bulk Order Modal */}
    {showBulkOrder && (
      <BulkOrder
        isOpen={showBulkOrder}
        onClose={() => setShowBulkOrder(false)}
        onAddToCart={handleBulkAddToCart}
        userProfile={userProfile}
      />
    )}
    <Footer />
    </div>
  );
};

export default OEMPartsApp;