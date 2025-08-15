import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from "@sentry/react";
import MainShell from './app/MainShell';
import './index.css';

// Initialize Sentry
Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  environment: process.env.REACT_APP_SENTRY_ENVIRONMENT || 'development',
  tracesSampleRate: 0.1,
});

// Add right after the Sentry init
console.log('🔍 GA4 Measurement ID:', process.env.REACT_APP_GA_MEASUREMENT_ID);
console.log('🔍 All env vars:', Object.keys(process.env).filter(key => key.startsWith('REACT_APP')));

// Initialize Google Analytics
if (process.env.REACT_APP_GA_MEASUREMENT_ID) {
  // Load gtag script
  const script1 = document.createElement('script');
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${process.env.REACT_APP_GA_MEASUREMENT_ID}`;
  document.head.appendChild(script1);

  // Initialize gtag
  const script2 = document.createElement('script');
  script2.innerHTML = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${process.env.REACT_APP_GA_MEASUREMENT_ID}');
  `;
  document.head.appendChild(script2);
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <MainShell />
  </React.StrictMode>
);