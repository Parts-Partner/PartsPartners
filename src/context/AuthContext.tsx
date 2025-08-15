// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from 'services/supabaseClient';

export type UserType = 'admin' | 'customer';
export interface UserProfile {
  id: string; email: string; full_name?: string; company_name?: string; phone?: string;
  discount_percentage?: number; user_type?: UserType; is_technician?: boolean;
}

interface AuthCtx {
  user: any | null;
  profile: UserProfile | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string, userType?: UserType) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const Ctx = createContext<AuthCtx | null>(null);
export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_evt, session) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setUser(null); setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(data as UserProfile | null);
  };

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signup = async (email: string, password: string, fullName: string, userType: UserType = 'customer') => {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName, user_type: userType } },
    });
    if (error) throw error;
  };

  const logout = async () => { await supabase.auth.signOut(); };

  return (
    <Ctx.Provider value={{ user, profile, login, signup, logout, loading }}>
      {children}
    </Ctx.Provider>
  );
};