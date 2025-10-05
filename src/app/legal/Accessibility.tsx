import React from 'react';
import { ArrowLeft } from 'lucide-react';

const Accessibility: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-50 py-8">
    <div className="max-w-4xl mx-auto px-4">
      <div className="bg-white border rounded-2xl shadow-sm p-8">
        <button 
          onClick={onBack} 
          className="inline-flex items-center gap-2 mb-6 px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
        >
          <ArrowLeft size={16} /> Back
        </button>
        
        <h1 className="text-3xl font-bold mb-2">Accessibility Statement</h1>
        <p className="text-sm text-gray-500 mb-6">Last Updated: January 1, 2025</p>
        
        <div className="prose max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">Our Commitment</h2>
            <p>
              Parts Partners is committed to ensuring digital accessibility for people with disabilities. We are 
              continually improving the user experience for everyone and applying relevant accessibility standards.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Conformance Status</h2>
            <p>
              We strive to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA standards. 
              These guidelines help make web content more accessible to people with disabilities.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Accessibility Features</h2>
            <p>Our website includes the following accessibility features:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Keyboard navigation support</li>
              <li>Descriptive link text</li>
              <li>Alternative text for images</li>
              <li>Consistent navigation structure</li>
              <li>Clear and readable fonts</li>
              <li>Sufficient color contrast</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Known Limitations</h2>
            <p>
              Despite our efforts, some content on our website may not yet be fully accessible. We are actively 
              working to improve accessibility across all pages and features.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Feedback</h2>
            <p>
              We welcome feedback on the accessibility of our website. If you encounter any accessibility barriers 
              or have suggestions for improvement, please contact us:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Email: support@partspartners.com</li>
              <li>Subject line: Accessibility Feedback</li>
            </ul>
            <p className="mt-3">
              We will respond to accessibility feedback within 5 business days and work to resolve any issues promptly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Alternative Access</h2>
            <p>
              If you have difficulty accessing any part of our website or need assistance with your order, please 
              contact our customer support team. We are happy to assist you through alternative methods.
            </p>
          </section>
        </div>
      </div>
    </div>
  </div>
);

export default Accessibility;