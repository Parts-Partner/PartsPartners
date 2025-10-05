import React, { useState, useEffect } from 'react';

export const CookieConsent: React.FC = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      setShow(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookieConsent', 'accepted');
    setShow(false);
    // Initialize analytics or other cookies here
  };

  const handleDecline = () => {
    localStorage.setItem('cookieConsent', 'declined');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-4 shadow-lg z-50">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-sm">
          We use cookies to improve your experience. By using our site, you agree to our use of cookies.{' '}
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('pp:navigate', { detail: { page: 'cookies' }}))}
            className="underline"
          >
            Learn more
          </button>
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleDecline}
            className="px-4 py-2 border border-white rounded-lg text-sm hover:bg-white hover:text-gray-900"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="px-4 py-2 bg-white text-gray-900 rounded-lg text-sm hover:bg-gray-100"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};