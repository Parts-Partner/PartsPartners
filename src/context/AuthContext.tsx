// src/context/AuthContext.tsx - Fixed with better error handling
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from 'services/supabaseClient';

export type UserType = 'admin' | 'customer';
export interface UserProfile {
  id: string; 
  email: string; 
  full_name?: string; 
  company_name?: string; 
  phone?: string;
  discount_percentage?: number; 
  user_type?: UserType; 
  is_technician?: boolean;
  user_description?: string;
  technician_count?: string;
  annual_purchase_estimate?: string;
  account_status?: 'active' | 'pending' | 'approved' | 'rejected';
  approved_at?: string;
}

export interface SignupData {
  email: string;
  password: string;
  fullName: string;
  isServiceCompany: boolean;
  phone?: string;
  company?: string;
  userDescription?: string;
  technicianCount?: string;
  annualPurchaseEstimate?: string;
}

interface AuthCtx {
  user: any | null;
  profile: UserProfile | null;
  login: (email: string, password: string) => Promise<void>;
  signup: ((email: string, password: string, fullName: string, userType?: UserType) => Promise<void>) & 
          ((data: SignupData) => Promise<void>);
  logout: () => Promise<void>;
  loading: boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) {
    console.error('useAuth must be used within <AuthProvider>');
    throw new Error('useAuth must be used within <AuthProvider>');
  }
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🔄 AuthProvider: Setting up auth listeners...');
    
    // Add error boundary for initial session check
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ AuthProvider: Session error:', error);
          setLoading(false);
          return;
        }
        
        console.log('🔄 AuthProvider: Initial session check:', session?.user?.email || 'No session');
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        }
      } catch (error) {
        console.error('❌ AuthProvider: Failed to get initial session:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        console.log('🔄 AuthProvider: Auth state changed:', event, session?.user?.email || 'No user');
        
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          setUser(null); 
          setProfile(null);
        }
      } catch (error) {
        console.error('❌ AuthProvider: Auth state change error:', error);
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      try {
        subscription.unsubscribe();
      } catch (error) {
        console.error('❌ AuthProvider: Error unsubscribing:', error);
      }
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    if (!userId) {
      console.error('❌ AuthProvider: No userId provided to fetchProfile');
      return;
    }

    try {
      console.log('🔄 AuthProvider: Fetching profile for user:', userId);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('❌ AuthProvider: Error fetching profile:', error);
        // Don't throw here - user might not have a profile yet
        setProfile(null);
        return;
      }
      
      console.log('✅ AuthProvider: Profile fetched successfully:', data?.email);
      setProfile(data as UserProfile | null);
    } catch (error) {
      console.error('❌ AuthProvider: Exception in fetchProfile:', error);
      setProfile(null);
    }
  };

  const login = async (email: string, password: string) => {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    console.log('🔄 AuthProvider: Starting login for:', email);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        console.error('❌ AuthProvider: Login error:', error);
        throw error;
      }
      
      console.log('✅ AuthProvider: Login successful for:', email);
    } catch (error) {
      console.error('❌ AuthProvider: Login exception:', error);
      throw error;
    }
  };

  const signup = async (
    emailOrData: string | SignupData, 
    password?: string, 
    fullName?: string, 
    userType: UserType = 'customer'
  ) => {
    console.log('🚀 AuthProvider: SIGNUP FUNCTION CALLED');
    console.log('🚀 AuthProvider: typeof emailOrData:', typeof emailOrData);
    
    try {
      let signupData: SignupData;
      
      if (typeof emailOrData === 'object') {
        signupData = emailOrData;
        console.log('🆕 AuthProvider: Using enhanced signup format');
      } else {
        if (!password || !fullName) {
          throw new Error('Password and full name are required for legacy signup format');
        }
        signupData = {
          email: emailOrData,
          password: password,
          fullName: fullName,
          isServiceCompany: false,
          phone: ''
        };
        console.log('🔄 AuthProvider: Using legacy signup format');
      }

      if (!signupData.email || !signupData.password || !signupData.fullName) {
        throw new Error('Email, password, and full name are required');
      }

      console.log('🔄 AuthProvider: Calling supabase.auth.signUp...');
      console.log('🔄 AuthProvider: Email:', signupData.email);
      
      // Step 1: Create auth user (this will send confirmation email)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: signupData.email,
        password: signupData.password,
        options: {
          data: {
            full_name: signupData.fullName,
            user_type: userType
          }
        }
      });

      console.log('📊 AuthProvider: Supabase signUp response:', {
        hasData: !!authData,
        hasUser: !!authData?.user,
        hasSession: !!authData?.session,
        userId: authData?.user?.id,
        userEmail: authData?.user?.email,
        emailConfirmed: authData?.user?.email_confirmed_at ? 'Yes' : 'No',
        error: authError
      });

      if (authError) {
        console.error('❌ AuthProvider: Auth signup error:', authError);
        throw authError;
      }

      if (!authData.user) {
        console.error('❌ AuthProvider: No user returned from signUp');
        throw new Error('User creation failed - no user returned');
      }

      console.log('✅ AuthProvider: Auth user created successfully!');
      console.log('✅ AuthProvider: User ID:', authData.user.id);
      console.log('✅ AuthProvider: User email:', authData.user.email);
      console.log('✅ AuthProvider: Email confirmed:', authData.user.email_confirmed_at ? 'Yes' : 'No');

      // Step 2: Create profile record
      console.log('🔄 AuthProvider: Creating profile record...');
      
      try {
        const profileData = {
          id: authData.user.id,
          email: signupData.email,
          full_name: signupData.fullName,
          user_type: userType,
          discount_percentage: 0,
          created_at: new Date().toISOString(),
          ...(signupData.isServiceCompany && {
            phone: signupData.phone || '',
            company_name: signupData.company || '',
            user_description: signupData.userDescription || '',
            technician_count: signupData.technicianCount || '',
            annual_purchase_estimate: signupData.annualPurchaseEstimate || '',
            account_status: 'pending' as const,
            is_technician: true
          }),
          ...(!signupData.isServiceCompany && {
            account_status: 'active' as const,
            is_technician: false
          })
        };

        console.log('🔄 AuthProvider: Profile data to insert:', JSON.stringify(profileData, null, 2));

        const { data: profileResult, error: profileError } = await supabase
          .from('profiles')
          .insert(profileData)
          .select()
          .single();

        if (profileError) {
          console.error('❌ AuthProvider: Profile creation error:', profileError);
          // Don't throw - profile can be created later
        } else {
          console.log('✅ AuthProvider: Profile record created successfully');
          console.log('✅ AuthProvider: Profile result:', profileResult);
        }
      } catch (profileError) {
        console.error('❌ AuthProvider: Exception creating profile:', profileError);
      }

      console.log('📧 AuthProvider: User must confirm email before logging in');
      console.log('📧 AuthProvider: Confirmation email sent to:', signupData.email);

      console.log('🎉 AuthProvider: SIGNUP PROCESS COMPLETED SUCCESSFULLY');
      console.log('🎉 AuthProvider: User should check email for confirmation link');

    } catch (error) {
      console.error('💥 AuthProvider: SIGNUP PROCESS FAILED:', error);
      throw error;
    }
  };

  const logout = async () => { 
    try {
      console.log('Logging out user');
      
      // Clear session storage
      sessionStorage.clear();
      
      // Clear local state immediately
      setUser(null);
      setProfile(null);
      
      // Try to call Supabase signOut with timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Logout timeout')), 2000)
      );
      
      const signOutPromise = supabase.auth.signOut();
      
      try {
        await Promise.race([signOutPromise, timeoutPromise]);
        console.log('Supabase signOut successful');
      } catch (err) {
        console.warn('Supabase signOut timed out, but local session cleared');
      }
      
      // Force reload to clear any cached state
      window.location.href = '/';
      
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local state and reload even if there's an error
      setUser(null);
      setProfile(null);
      window.location.href = '/';
    }
  };

  // Provide safe defaults to prevent null context errors
  const contextValue: AuthCtx = {
    user: user || null,
    profile: profile || null,
    login,
    signup,
    logout,
    loading
  };

  return (
    <Ctx.Provider value={contextValue}>
      {children}
    </Ctx.Provider>
  );
};