import React, { useState, useEffect } from 'react';
import { ArrowRight, Eye, EyeOff, Lock, Mail, Shield, Truck, Users, Phone, Building, CheckCircle, RefreshCw, AlertCircle, MapPin, DollarSign } from 'lucide-react';
import { useAuth } from 'context/AuthContext';
import { supabase } from 'services/supabaseClient';

interface Props {
  onNav: (page: string) => void;
}

interface FormData {
  // Common fields
  email: string;
  password: string;
  fullName: string;
  
  // Service company fields
  isServiceCompany: boolean;
  phone: string;
  company: string;
  userDescription: string;
  technicianCount: string;
  annualPurchaseEstimate: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
}

// Email Confirmation Screen Component
const EmailConfirmationScreen: React.FC<{
  email: string;
  isServiceCompany: boolean;
  onConfirmed: () => void;
  onBack: () => void;
}> = ({ email, isServiceCompany, onConfirmed, onBack }) => {
  const [isChecking, setIsChecking] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [message, setMessage] = useState('');
  const [autoCheckEnabled, setAutoCheckEnabled] = useState(true);

  // Check confirmation status periodically
  useEffect(() => {
    let checkInterval: NodeJS.Timeout | null = null;
    
    if (autoCheckEnabled) {
      checkInterval = setInterval(async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.email_confirmed_at) {
            console.log('✅ Email confirmed, user logged in');
            if (checkInterval) clearInterval(checkInterval);
            onConfirmed();
          }
        } catch (error) {
          console.error('Error checking session:', error);
        }
      }, 2000); // Check every 2 seconds
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [onConfirmed, autoCheckEnabled]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const checkEmailConfirmation = async () => {
    setIsChecking(true);
    setMessage('');
    
    try {
      // Force refresh the session
      const { data: { session }, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('Session refresh error:', error);
        setMessage('Unable to check confirmation status. Please try again.');
      } else if (session?.user?.email_confirmed_at) {
        console.log('✅ Email confirmed!');
        setMessage('Email confirmed! Logging you in...');
        setTimeout(onConfirmed, 1000);
      } else {
        setMessage('Email not yet confirmed. Please check your inbox and click the confirmation link.');
      }
    } catch (error) {
      console.error('Error checking confirmation:', error);
      setMessage('Error checking confirmation status. Please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  const resendConfirmationEmail = async () => {
    setIsResending(true);
    setMessage('');
    
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email
      });
      
      if (error) {
        console.error('Resend error:', error);
        setMessage(`Failed to resend: ${error.message}`);
      } else {
        setMessage('Confirmation email sent! Please check your inbox and spam folder.');
        setResendCooldown(60); // 60 second cooldown
      }
    } catch (error) {
      console.error('Resend exception:', error);
      setMessage('Failed to resend email. Please try again later.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div 
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `radial-gradient(circle, #e2e8f0 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />
      
      <div className="relative w-full max-w-md mx-auto">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-10 h-10 text-blue-600" />
            </div>
            
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              Check Your Email
            </h1>
            
            <p className="text-slate-600 leading-relaxed">
              We&apos;ve sent a confirmation link to:
            </p>
            
            <div className="mt-2 px-4 py-2 bg-slate-100 rounded-lg">
              <span className="font-medium text-slate-900">{email}</span>
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <div className="font-medium mb-1">Next Steps</div>
                <ol className="text-xs space-y-1 text-blue-700 list-decimal list-inside">
                  <li>Check your email inbox (and spam folder)</li>
                  <li>Click the confirmation link in the email</li>
                  <li>You&apos;ll be automatically logged in</li>
                  <li>Once confirmed, you may close this screen</li>
                </ol>
              </div>
            </div>

            {/* Service Company Message */}
            {isServiceCompany && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <Shield className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800">
                  <div className="font-medium mb-1">Service Company Account</div>
                  <p className="text-xs text-amber-700">
                    After email confirmation, your service company account will be reviewed for 
                    preferred pricing eligibility. You&apos;ll receive an email notification once approved.
                  </p>
                </div>
              </div>
            )}

            {message && (
              <div className={`p-3 rounded-lg text-sm ${
                message.includes('confirmed') || message.includes('sent')
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-yellow-50 border border-yellow-200 text-yellow-700'
              }`}>
                <div className="flex items-start gap-2">
                  {message.includes('confirmed') ? (
                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  )}
                  <span>{message}</span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={resendConfirmationEmail}
              disabled={isResending || resendCooldown > 0}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50"
            >
              {isResending ? (
                'Sending...'
              ) : resendCooldown > 0 ? (
                `Resend in ${resendCooldown}s`
              ) : (
                'Resend Confirmation Email'
              )}
            </button>

            <button
              onClick={onBack}
              className="w-full text-slate-600 hover:text-slate-900 font-medium py-2 text-sm transition-colors"
            >
              ← Back to Login
            </button>
          </div>

          {/* Help Text */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-xs text-slate-500 text-center leading-relaxed">
              Can&apos;t find the email? Check your spam folder or try resending. 
              If you continue having issues, please contact support.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const LoginPage: React.FC<Props> = ({ onNav }) => {
  const { login, signup } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Email confirmation state
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [registeredAsServiceCompany, setRegisteredAsServiceCompany] = useState(false);
  
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    fullName: '',
    isServiceCompany: false,
    phone: '',
    company: '',
    userDescription: '',
    technicianCount: '',
    annualPurchaseEstimate: '',
    address: '',
    city: '',
    state: '',
    zipCode: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    if (error) setError('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const validateForm = (): boolean => {
    if (activeTab === 'login') {
      if (!formData.email || !formData.password) {
        setError('Please fill in all required fields');
        return false;
      }
    } else {
      // Basic required fields for everyone
      if (!formData.email || !formData.password || !formData.fullName) {
        setError('Please fill in all required fields');
        return false;
      }
      
      // Additional required fields for service companies
      if (formData.isServiceCompany) {
        if (!formData.phone || !formData.company || !formData.userDescription || 
            !formData.technicianCount || !formData.annualPurchaseEstimate ||
            !formData.address || !formData.city || !formData.state || !formData.zipCode) {
          setError('Please fill in all required fields for service companies');
          return false;
        }
        
        // Phone validation for service companies
        const cleanPhone = formData.phone.replace(/\D/g, '');
        if (cleanPhone.length < 10) {
          setError('Please enter a valid phone number');
          return false;
        }

        // ZIP code validation
        if (formData.zipCode.length < 5) {
          setError('Please enter a valid ZIP code');
          return false;
        }
      }
      
      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setError('Please enter a valid email address');
        return false;
      }
      
      // Password strength
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters long');
        return false;
      }
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    setError('');

    try {
      if (activeTab === 'login') {
        await login(formData.email, formData.password);
        onNav('search');
      } else {
        // Registration - call signup with proper parameters
        await signup(
          formData.email,
          formData.password,
          formData.fullName,
          'customer' // userType
        );
        
        // Show email confirmation screen
        setRegisteredEmail(formData.email);
        setRegisteredAsServiceCompany(formData.isServiceCompany);
        setShowEmailConfirmation(true);
      }
    } catch (error: any) {
      console.error('Authentication error:', error);
      setError(error.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      fullName: '',
      isServiceCompany: false,
      phone: '',
      company: '',
      userDescription: '',
      technicianCount: '',
      annualPurchaseEstimate: '',
      address: '',
      city: '',
      state: '',
      zipCode: ''
    });
    setError('');
  };

  // Show email confirmation screen if needed
  if (showEmailConfirmation) {
    return (
      <EmailConfirmationScreen
        email={registeredEmail}
        isServiceCompany={registeredAsServiceCompany}
        onConfirmed={() => {
          setShowEmailConfirmation(false);
          onNav('search');
        }}
        onBack={() => {
          setShowEmailConfirmation(false);
          setActiveTab('login');
          resetForm();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      {/* Background pattern */}
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
                  src="https://xarnvryaicseavgnmtjn.supabase.co/storage/v1/object/public/assets/Logo_Rev1.png"
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
                  <p className="text-slate-600">Service companies get preferred pricing on all OEM parts!</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Truck className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">Fast Shipping</h3>
                  <p className="text-slate-600">Equipment down? We have same-day processing and expedited shipping options!</p>
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

          {/* Right Side - Form */}
          <div className="w-full">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 lg:p-10 max-h-[90vh] overflow-y-auto">
              
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
                {/* Service Company Toggle - Only for Registration */}
                {activeTab === 'register' && (
                  <div className="space-y-4 pb-4 border-b border-slate-200">
                    <div className="text-lg font-semibold text-slate-900 mb-4">
                      Account Type
                    </div>
                    
                    <div className="space-y-3">
                      <label className={`flex items-start space-x-4 cursor-pointer p-4 rounded-2xl border-2 transition-all ${
                        !formData.isServiceCompany 
                          ? 'bg-blue-50 border-blue-300' 
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}>
                        <input 
                          type="radio" 
                          name="accountType"
                          checked={!formData.isServiceCompany}
                          onChange={() => setFormData(prev => ({ ...prev, isServiceCompany: false }))}
                          className="w-4 h-4 text-blue-600 bg-white border-slate-300 focus:ring-blue-500 focus:ring-2 mt-0.5" 
                        />
                        <div className="flex-1">
                          <span className="text-sm font-semibold text-slate-900">
                            Personal Account
                          </span>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            Individual user buying parts for personal use
                          </p>
                        </div>
                      </label>

                      <label className={`flex items-start space-x-4 cursor-pointer p-4 rounded-2xl border-2 transition-all ${
                        formData.isServiceCompany 
                          ? 'bg-green-50 border-green-300' 
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}>
                        <input 
                          type="radio" 
                          name="accountType"
                          checked={formData.isServiceCompany}
                          onChange={() => setFormData(prev => ({ ...prev, isServiceCompany: true }))}
                          className="w-4 h-4 text-green-600 bg-white border-slate-300 focus:ring-green-500 focus:ring-2 mt-0.5" 
                        />
                        <div className="flex-1">
                          <span className="text-sm font-semibold text-green-900">
                            🏢 Service Company Account
                          </span>
                          <p className="text-xs text-green-700 mt-1 leading-relaxed">
                            Professional service company - get preferred pricing after approval
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  
                  {/* Email Field */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      Email Address <span className="text-red-500">*</span>
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
                        required
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      Password <span className="text-red-500">*</span>
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
                        required
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
                      {/* Full Name - Always Required */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">
                          Full Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="fullName"
                          value={formData.fullName}
                          onChange={handleInputChange}
                          onKeyPress={handleKeyPress}
                          className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all placeholder-slate-400"
                          placeholder="Your full name"
                          required
                        />
                      </div>

                      {/* Service Company Additional Fields */}
                      {formData.isServiceCompany && (
                        <>
                          {/* Phone Number */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">
                              Phone Number <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                              <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                              <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleInputChange}
                                onKeyPress={handleKeyPress}
                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all placeholder-slate-400"
                                placeholder="123 Business Street"
                                required
                              />
                            </div>
                          </div>

                          {/* City, State, ZIP */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-slate-700">
                                City <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                name="city"
                                value={formData.city}
                                onChange={handleInputChange}
                                onKeyPress={handleKeyPress}
                                className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all placeholder-slate-400"
                                placeholder="City"
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-slate-700">
                                State <span className="text-red-500">*</span>
                              </label>
                              <select
                                name="state"
                                value={formData.state}
                                onChange={handleInputChange}
                                className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                                required
                              >
                                <option value="">State</option>
                                {['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'].map(state => (
                                  <option key={state} value={state}>{state}</option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-slate-700">
                                ZIP Code <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                name="zipCode"
                                value={formData.zipCode}
                                onChange={handleInputChange}
                                onKeyPress={handleKeyPress}
                                className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all placeholder-slate-400"
                                placeholder="12345"
                                maxLength={10}
                                required
                              />
                            </div>
                          </div>

                          {/* What describes you */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">
                              What best describes your company? <span className="text-red-500">*</span>
                            </label>
                            <select
                              name="userDescription"
                              value={formData.userDescription}
                              onChange={handleInputChange}
                              className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                              required
                            >
                              <option value="">Select one...</option>
                              <option value="service_contractor">Service Contractor</option>
                              <option value="maintenance_company">Maintenance Company</option>
                              <option value="facility_management">Facility Management</option>
                              <option value="equipment_dealer">Equipment Dealer</option>
                              <option value="hvac_contractor">HVAC Contractor</option>
                              <option value="appliance_repair">Appliance Repair Service</option>
                              <option value="other">Other</option>
                            </select>
                          </div>

                          {/* Grid for business metrics */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Number of Technicians */}
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-slate-700">
                                Number of Service Technicians <span className="text-red-500">*</span>
                              </label>
                              <select
                                name="technicianCount"
                                value={formData.technicianCount}
                                onChange={handleInputChange}
                                className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                                required
                              >
                                <option value="">Select...</option>
                                <option value="1-5">1-5 technicians</option>
                                <option value="6-15">6-15 technicians</option>
                                <option value="16-50">16-50 technicians</option>
                                <option value="51-100">51-100 technicians</option>
                                <option value="100+">100+ technicians</option>
                              </select>
                            </div>

                            {/* Annual Purchase Estimate */}
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-slate-700">
                                Annual Parts Purchase Estimate <span className="text-red-500">*</span>
                              </label>
                              <div className="relative">
                                <DollarSign className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                                <select
                                  name="annualPurchaseEstimate"
                                  value={formData.annualPurchaseEstimate}
                                  onChange={handleInputChange}
                                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                                  required
                                >
                                  <option value="">Select range...</option>
                                  <option value="under_10k">Under $10,000</option>
                                  <option value="10k_25k">$10,000 - $25,000</option>
                                  <option value="25k_50k">$25,000 - $50,000</option>
                                  <option value="50k_100k">$50,000 - $100,000</option>
                                  <option value="100k_250k">$100,000 - $250,000</option>
                                  <option value="250k_plus">$250,000+</option>
                                </select>
                              </div>
                            </div>
                          </div>

                          {/* Service Company Info Box */}
                          <div className="p-4 bg-green-50 border border-green-200 rounded-2xl">
                            <div className="flex items-start gap-3">
                              <Shield className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                              <div className="text-sm text-green-800">
                                <div className="font-medium mb-1">Service Company Benefits</div>
                                <ul className="text-xs text-green-700 space-y-1">
                                  <li>• Preferred pricing on OEM parts</li>
                                  <li>• Priority customer support</li>
                                  <li>• Extended payment terms (Net 30)</li>
                                  <li>• Dedicated account manager</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>

                {/* Remember Me / Forgot Password */}
                {activeTab === 'login' && (
                  <div className="flex items-center justify-between">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-red-600 bg-slate-50 border-slate-300 rounded focus:ring-red-500 focus:ring-2" 
                      />
                      <span className="text-sm text-slate-600">Remember me</span>
                    </label>
                    <button 
                      type="button" 
                      className="text-sm text-red-600 hover:text-red-700 font-medium"
                    >
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
                  src="https://xarnvryaicseavgnmtjn.supabase.co/storage/v1/object/public/assets/Logo_Rev1.png"
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

export default LoginPage;
                                