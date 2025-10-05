import React from 'react';
import { ArrowLeft } from 'lucide-react';

const TermsOfService: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-50 py-8">
    <div className="max-w-4xl mx-auto px-4">
      <div className="bg-white border rounded-2xl shadow-sm p-8">
        <button 
          onClick={onBack} 
          className="inline-flex items-center gap-2 mb-6 px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
        >
          <ArrowLeft size={16} /> Back
        </button>
        
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-6">Last Updated: January 1, 2025</p>
        
        <div className="prose max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">Agreement to Terms</h2>
            <p>
              By accessing or using Parts Partners' website and services, you agree to be bound by these Terms of Service. 
              If you do not agree to these terms, please do not use our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Use of Services</h2>
            <p>You agree to use our services only for lawful purposes and in accordance with these Terms. You must not:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Use our services in any way that violates applicable laws or regulations</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Interfere with or disrupt the operation of our services</li>
              <li>Use automated systems to access our services without permission</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Account Registration</h2>
            <p>
              To access certain features, you must create an account. You are responsible for maintaining the confidentiality 
              of your account credentials and for all activities under your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Orders and Pricing</h2>
            <p>
              All orders are subject to acceptance and availability. We reserve the right to refuse or cancel any order. 
              Prices are subject to change without notice. We strive to display accurate pricing but errors may occur.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Payment Terms</h2>
            <p>
              Payment is due at the time of order. We accept major credit cards and other payment methods as indicated. 
              You represent that you have the legal right to use any payment method you provide.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Shipping and Delivery</h2>
            <p>
              We will make reasonable efforts to ship orders promptly. Delivery times are estimates and not guaranteed. 
              Title and risk of loss pass to you upon delivery to the carrier.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Returns and Refunds</h2>
            <p>
              Returns are subject to our return policy. Contact us for return authorization. Refunds will be processed 
              to the original payment method within a reasonable time after we receive the returned item.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, Parts Partners shall not be liable for any indirect, incidental, 
              special, consequential, or punitive damages arising out of or related to your use of our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Disclaimer of Warranties</h2>
            <p>
              Our services are provided "as is" without warranties of any kind, either express or implied. We do not 
              warrant that our services will be uninterrupted, error-free, or secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Modifications</h2>
            <p>
              We reserve the right to modify these Terms at any time. Changes will be effective immediately upon posting. 
              Your continued use of our services constitutes acceptance of the modified Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Contact Information</h2>
            <p>
              For questions about these Terms, contact us at:
              <br />
              Email: support@partspartners.com
            </p>
          </section>
        </div>
      </div>
    </div>
  </div>
);

export default TermsOfService;