'use client';

import { useEffect, useState } from 'react';

const CONSENT_KEY = 'bnn_cookie_consent';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(CONSENT_KEY)) {
        setVisible(true);
      }
    } catch (e) {}
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(CONSENT_KEY, 'accepted');
    } catch (e) {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0e3a8a] text-white px-4 py-4 shadow-[0_-2px_10px_rgba(0,0,0,0.2)]">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-sm text-blue-100">
          We use cookies, including for ad personalisation by Google AdSense. By continuing to
          use BNN, you agree to our use of cookies as described in our{' '}
          <a href="/privacy-policy" className="underline font-semibold text-white hover:text-blue-200">
            Privacy Policy
          </a>.
        </p>
        <button
          onClick={accept}
          className="shrink-0 bg-white text-[#0e3a8a] font-bold text-sm px-5 py-2 rounded-md hover:bg-blue-50 transition-colors"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
