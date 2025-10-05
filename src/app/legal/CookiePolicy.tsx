import React from 'react';
import { ArrowLeft } from 'lucide-react';

const CookiePolicy: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-50 py-8">
    <div className="max-w-4xl mx-auto px-4">
      <div className="bg-white border rounded-2xl shadow-sm p-8">
        <button 
          onClick={onBack} 
          className="inline-flex items-center gap-2 mb-6 px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
        >
          <ArrowLeft size={16} /> Back
        </button>
        
        <h1 className="text-3xl font-bold mb-2">Cookie Policy</h1>
        <p className="text-sm text-gray-500 mb-6">Last Updated: January 1, 2025</p>
        
        <div className="prose max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">What Are Cookies</h2>
            <p>
              Cookies are small text files stored on your device when you visit our website. They help us provide you 
              with a better experience by remembering your preferences and enabling certain functionality.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">How We Use Cookies</h2>
            <p className="mb-2">We use cookies for:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Essential Cookies:</strong> Required for the website to function properly (login, shopping cart)</li>
              <li><strong>Performance Cookies:</strong> Help us understand how visitors use our site</li>
              <li><strong>Functionality Cookies:</strong> Remember your preferences and settings</li>
              <li><strong>Analytics Cookies:</strong> Track website usage and performance</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Third-Party Cookies</h2>
            <p>
              We may use third-party services that set cookies on our behalf, including analytics providers and 
              payment processors. These services have their own privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Managing Cookies</h2>
            <p>
              You can control and manage cookies through your browser settings. Please note that disabling certain 
              cookies may affect the functionality of our website.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Contact Us</h2>
            <p>
              For questions about our use of cookies, contact us at:
              <br />
              Email: support@partspartners.com
            </p>
          </section>
        </div>
      </div>
    </div>
  </div>
);

export default CookiePolicy;