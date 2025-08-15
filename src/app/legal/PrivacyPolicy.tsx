// src/app/legal/PrivacyPolicy.tsx
import React from 'react';
import { ArrowLeft } from 'lucide-react';

const Shell: React.FC<{ title: string; children: React.ReactNode; onBack: ()=>void }> = ({ title, children, onBack }) => (
  <div className="min-h-[80vh] py-8">
    <div className="max-w-3xl mx-auto">
      <div className="bg-white border rounded-2xl shadow p-8">
        <button onClick={onBack} className="inline-flex items-center gap-2 mb-6 px-3 py-2 border rounded-lg text-sm text-gray-600">
          <ArrowLeft size={16}/> Back to Parts Search
        </button>
        <h1 className="text-3xl font-bold mb-4">{title}</h1>
        <div className="prose max-w-none">{children}</div>
      </div>
    </div>
  </div>
);

const PrivacyPolicy: React.FC<{ onBack: ()=>void }> = ({ onBack }) => (
  <Shell title="Privacy Policy" onBack={onBack}>
    <p><strong>Effective Date:</strong> January 1, 2025</p>
    <p>At Parts Partners, we respect your privacy…</p>
    {/* Keep your original sections, moved here. */}
  </Shell>
);

export default PrivacyPolicy;