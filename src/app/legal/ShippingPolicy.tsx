import React from 'react';
import { ArrowLeft } from 'lucide-react';

const ShippingPolicy: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-50 py-8">
    <div className="max-w-4xl mx-auto px-4">
      <div className="bg-white border rounded-2xl shadow-sm p-8">
        <button 
          onClick={onBack} 
          className="inline-flex items-center gap-2 mb-6 px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
        >
          <ArrowLeft size={16} /> Back
        </button>
        
        <h1 className="text-3xl font-bold mb-2">Shipping Policy</h1>
        <p className="text-sm text-gray-500 mb-6">Last Updated: January 1, 2025</p>
        
        <div className="prose max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">Processing Time</h2>
            <p>
              Orders are typically processed within 1-2 business days. Orders placed on weekends or holidays will be 
              processed the next business day.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Shipping Methods</h2>
            <p>We offer several shipping options:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Standard Shipping:</strong> 5-7 business days</li>
              <li><strong>Expedited Shipping:</strong> 2-3 business days</li>
              <li><strong>Overnight Shipping:</strong> 1 business day</li>
            </ul>
            <p className="mt-3">Shipping times are estimates and not guaranteed. Actual delivery times may vary.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Shipping Costs</h2>
            <p>
              Shipping costs are calculated at checkout based on the weight, dimensions, and destination of your order. 
              We may offer free shipping promotions from time to time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">International Shipping</h2>
            <p>
              We currently ship within the United States only. International shipping may be available upon request 
              for certain items. Contact us for more information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Tracking</h2>
            <p>
              You will receive a tracking number via email once your order ships. You can use this number to track 
              your package on the carrier's website.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Damaged or Lost Packages</h2>
            <p>
              If your package arrives damaged or is lost in transit, please contact us immediately at 
              support@partspartners.com. We will work with the carrier to resolve the issue.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Contact Us</h2>
            <p>
              For questions about shipping, contact us at:
              <br />
              Email: support@partspartners.com
            </p>
          </section>
        </div>
      </div>
    </div>
  </div>
);

export default ShippingPolicy;