import React from 'react';
const Page: React.FC<{ onBack: ()=>void }> = ({ onBack }) => (
  <div className="p-6 max-w-3xl mx-auto">
    <button onClick={onBack} className="text-sm underline mb-4">← Back</button>
    <h1 className="text-2xl font-bold mb-2">Placeholder</h1>
    <p>Content coming soon.</p>
  </div>
);
export default Page;
