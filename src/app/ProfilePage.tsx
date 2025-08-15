// src/app/ProfilePage.tsx
import React from 'react';
import { useAuth } from 'context/AuthContext';
import { LogOut, Edit, ShoppingBag, HelpCircle, Percent } from 'lucide-react';

type Props = {
  onNav: (page: string) => void;
};

export const ProfilePage: React.FC<Props> = ({ onNav }) => {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Please sign in</h1>
        <button
          className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
          onClick={() => onNav('login')}
        >
          Go to Login
        </button>
      </div>
    );
  }

  const discountPct = user.discountPct || 0; // adjust if you store discounts differently

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* User Info */}
      <div className="bg-white shadow rounded-xl p-6 flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <img
          src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.email)}`}
          alt="Profile"
          className="h-24 w-24 rounded-full object-cover border"
        />
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{user.name || 'Unnamed User'}</h1>
          <p className="text-gray-600">{user.email}</p>
          {discountPct > 0 && (
            <div className="mt-2 inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">
              <Percent className="w-4 h-4 mr-1" /> {discountPct}% Discount
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            className="inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
            onClick={() => console.log('Edit profile clicked')}
          >
            <Edit className="w-4 h-4 mr-1" /> Edit Profile
          </button>
          <button
            className="inline-flex items-center px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
            onClick={logout}
          >
            <LogOut className="w-4 h-4 mr-1" /> Log Out
          </button>
        </div>
      </div>

      {/* Order History */}
      <div className="bg-white shadow rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Order History</h2>
        <div className="text-gray-500 text-sm">
          {/* Replace with Supabase query for user orders */}
          No orders yet.
        </div>
      </div>

      {/* Support & Tools */}
      <div className="grid sm:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Support</h2>
          <button
            className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => onNav('contact')}
          >
            <HelpCircle className="w-4 h-4 mr-2" /> Contact Support
          </button>
        </div>
        <div className="bg-white shadow rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Tools</h2>
          <button
            className="inline-flex items-center px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
            onClick={() => onNav('bulkOrder')}
          >
            <ShoppingBag className="w-4 h-4 mr-2" /> Bulk Order
          </button>
        </div>
      </div>
    </div>
  );
};
