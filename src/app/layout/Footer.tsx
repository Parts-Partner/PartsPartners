// src/app/layout/Footer.tsx - Updated with proper TypeScript interface
import React from 'react';

interface FooterProps {
  onNav: (page: string) => void;
  variant?: 'default' | 'minimal';
}

export const Footer: React.FC<FooterProps> = ({ onNav, variant = 'default' }) => {
  // Minimal variant for homepage
  if (variant === 'minimal') {
    return (
      <footer className="bg-white border-t border-gray-100 py-4">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-gray-400">
            <button onClick={() => onNav('privacy')} className="hover:text-gray-600 transition-colors">
              Privacy Policy
            </button>
            <button onClick={() => onNav('terms')} className="hover:text-gray-600 transition-colors">
              Terms of Service
            </button>
            <button onClick={() => onNav('contact')} className="hover:text-gray-600 transition-colors">
              Contact
            </button>
            <button onClick={() => onNav('shipping')} className="hover:text-gray-600 transition-colors">
              Shipping
            </button>
          </div>
          <div className="text-center mt-2 text-xs text-gray-300">
            © {new Date().getFullYear()} Parts Partners. All rights reserved.
          </div>
        </div>
      </footer>
    );
  }

  // Default variant for all other pages
  return (
    <footer className="bg-slate-900 text-white border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <img
                src="https://xarnvryaicseavgnmtjn.supabase.co/storage/v1/object/public/assets//Logo_Rev1.png"
                alt="Parts Partners Logo"
                className="h-12 w-12 rounded bg-white object-contain"
              />
              <div className="font-bold text-lg">Parts Partners</div>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              Your trusted partner for OEM parts and professional service solutions.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-3">Quick Links</h3>
            <div className="space-y-2">
              <button onClick={() => onNav('search')} className="block text-slate-300 hover:text-white text-sm">
                Browse Parts
              </button>
              <button onClick={() => onNav('contact')} className="block text-slate-300 hover:text-white text-sm">
                Become a Partner
              </button>
              <button onClick={() => onNav('profile')} className="block text-slate-300 hover:text-white text-sm">
                My Account
              </button>
            </div>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-semibold mb-3">Support</h3>
            <div className="space-y-2">
              <button onClick={() => onNav('contact')} className="block text-slate-300 hover:text-white text-sm">
                Contact Us
              </button>
              <button onClick={() => onNav('shipping')} className="block text-slate-300 hover:text-white text-sm">
                Shipping Policy
              </button>
              <a href="mailto:support@partspartners.com" className="block text-slate-300 hover:text-white text-sm">
                support@partspartners.com
              </a>
            </div>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold mb-3">Legal</h3>
            <div className="space-y-2">
              <button onClick={() => onNav('privacy')} className="block text-slate-300 hover:text-white text-sm">
                Privacy Policy
              </button>
              <button onClick={() => onNav('terms')} className="block text-slate-300 hover:text-white text-sm">
                Terms of Service
              </button>
              <button onClick={() => onNav('cookies')} className="block text-slate-300 hover:text-white text-sm">
                Cookie Policy
              </button>
              <button onClick={() => onNav('accessibility')} className="block text-slate-300 hover:text-white text-sm">
                Accessibility
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-8 pt-8 text-center text-slate-400 text-sm">
          © {new Date().getFullYear()} Parts Partners. All rights reserved.
        </div>
      </div>
    </footer>
  );
};