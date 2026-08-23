'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { LEGAL } from '@/lib/legal';

/* ---------- LEGAL MODAL ---------- */

const LegalModal = ({ doc, onClose }) => {
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm px-4"
      onClick={handleBackdrop}
    >
      <div className="relative bg-white w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border-t-4 border-[#1A56C4]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-blue-100 bg-[#f8faff]">
          <h2 className="text-lg font-black uppercase tracking-tight text-[#1A56C4]" style={{ fontFamily: 'Georgia, serif' }}>
            {doc.title}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-50 hover:bg-[#1A56C4] hover:text-white text-gray-500 transition-colors text-lg font-bold"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-6 text-sm text-gray-700 leading-relaxed space-y-4">
          {doc.body.split('\n\n').map((para, i) => (
            <p key={i} className={para.match(/^\d+\./) ? 'font-bold text-[#121212] mt-4' : ''}>
              {para}
            </p>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-blue-100 bg-[#f8faff] flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-[#1A56C4] text-white text-xs font-black uppercase tracking-widest hover:bg-[#1248A8] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---------- FOOTER COMPONENT ---------- */

const Footer = () => {
  const [activeModal, setActiveModal] = useState(null);

  const footerLinks = {
    sections: [
      { name: 'Technology', href: '/category/technology' },
      { name: 'Business', href: '/category/business' },
      { name: 'Politics', href: '/category/politics' },
      { name: 'World', href: '/category/world' },
      { name: 'Sports', href: '/category/sports' },
    ],
    features: [
      { name: 'Bolta Hai Bharat', href: '/category/bolta-hai-bharat' },
      { name: 'Editorial', href: '/category/editorial' },
    ],
    company: [
      { name: 'About BNN', href: '/about' },
      { name: 'Ethics Policy', href: '/ethics-policy' },
      { name: 'Advertise', href: '/contact' },
      { name: 'Contact', href: '/contact' },
    ],
    connect: [
      { name: 'E-Paper', href: '/epaper' },
    ],
  };

  return (
    <footer
      style={{
        background: 'linear-gradient(135deg, #0a2a6e 0%, #0e3a8a 35%, #1044a8 65%, #0a2a6e 100%)',
        position: 'relative',
        overflow: 'hidden',
        color: 'white',
        marginTop: '3rem',
      }}
    >
      {/* World Dot Map Background — centered, covers the right 60% */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(/world_dot_map.png)',
          backgroundSize: '70% auto',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
          opacity: 0.35,
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />

      {/* Gradient vignette — fades edges */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 80% 120% at 55% 50%, transparent 30%, #0a2a6e 80%)',
          pointerEvents: 'none',
        }}
      />

      {/* Main content */}
      <div
        style={{
          position: 'relative',
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '3.5rem 3rem 0',
        }}
      >
        {/* Upper section: logo col + 4 link cols */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
            gap: '2rem',
            marginBottom: '3rem',
            alignItems: 'start',
          }}
        >
          {/* Brand / About */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <h2
                style={{
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  fontSize: '1.75rem',
                  fontWeight: 900,
                  letterSpacing: '-0.01em',
                  color: '#ffffff',
                  margin: 0,
                  lineHeight: 1.1,
                }}
              >
                Bharat News Narratives
              </h2>
              <p
                style={{
                  fontFamily: 'Inter, Arial, sans-serif',
                  fontSize: '0.6rem',
                  letterSpacing: '0.35em',
                  color: 'rgba(147,197,253,0.75)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  marginTop: '0.5rem',
                  marginBottom: 0,
                }}
              >
                Independent · Insightful · Indian
              </p>
            </div>

            <p
              style={{
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontSize: '0.82rem',
                color: 'rgba(191,219,254,0.65)',
                lineHeight: 1.65,
                fontStyle: 'italic',
                maxWidth: '320px',
                margin: 0,
              }}
            >
              Established in 2026, Bharat News Narratives is committed to
              independent, evidence-driven journalism that serves the public
              interest — with no corporate or political patron.
            </p>
          </div>

          {/* SECTIONS */}
          <div>
            <h3
              style={{
                fontFamily: 'Inter, Arial, sans-serif',
                fontSize: '0.65rem',
                fontWeight: 800,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'rgba(147,197,253,0.9)',
                marginBottom: '1.25rem',
                marginTop: 0,
              }}
            >
              <Link href="/category/technology" style={{ color: 'inherit', textDecoration: 'none' }}>Sections</Link>
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {footerLinks.sections.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    style={{
                      fontFamily: 'Inter, Arial, sans-serif',
                      fontSize: '0.82rem',
                      color: 'rgba(255,255,255,0.88)',
                      textDecoration: 'none',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#7dd3fc')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.88)')}
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* FEATURES */}
          <div>
            <h3
              style={{
                fontFamily: 'Inter, Arial, sans-serif',
                fontSize: '0.65rem',
                fontWeight: 800,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'rgba(147,197,253,0.9)',
                marginBottom: '1.25rem',
                marginTop: 0,
              }}
            >
              <Link href="/category/editorial" style={{ color: 'inherit', textDecoration: 'none' }}>Features</Link>
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {footerLinks.features.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    style={{
                      fontFamily: 'Inter, Arial, sans-serif',
                      fontSize: '0.82rem',
                      color: 'rgba(255,255,255,0.88)',
                      textDecoration: 'none',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#7dd3fc')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.88)')}
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* COMPANY */}
          <div>
            <h3
              style={{
                fontFamily: 'Inter, Arial, sans-serif',
                fontSize: '0.65rem',
                fontWeight: 800,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'rgba(147,197,253,0.9)',
                marginBottom: '1.25rem',
                marginTop: 0,
              }}
            >
              <Link href="/#about" style={{ color: 'inherit', textDecoration: 'none' }}>Company</Link>
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    style={{
                      fontFamily: 'Inter, Arial, sans-serif',
                      fontSize: '0.82rem',
                      color: 'rgba(255,255,255,0.88)',
                      textDecoration: 'none',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#7dd3fc')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.88)')}
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* CONNECT */}
          <div>
            <h3
              style={{
                fontFamily: 'Inter, Arial, sans-serif',
                fontSize: '0.65rem',
                fontWeight: 800,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'rgba(147,197,253,0.9)',
                marginBottom: '1.25rem',
                marginTop: 0,
              }}
            >
              <Link href="/#connect" style={{ color: 'inherit', textDecoration: 'none' }}>Connect</Link>
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {footerLinks.connect.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    style={{
                      fontFamily: 'Inter, Arial, sans-serif',
                      fontSize: '0.82rem',
                      color: 'rgba(255,255,255,0.88)',
                      textDecoration: 'none',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#7dd3fc')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.88)')}
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.1)',
            paddingTop: '1.25rem',
            paddingBottom: '1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <p
            style={{
              fontFamily: 'Inter, Arial, sans-serif',
              fontSize: '0.6rem',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(147,197,253,0.4)',
              margin: 0,
            }}
          >
            © 2026 Bharat News Narratives. All Rights Reserved.
          </p>

          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
            <button
              onClick={() => setActiveModal('disclaimer')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'Inter, Arial, sans-serif',
                fontSize: '0.6rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'rgba(147,197,253,0.4)',
                padding: 0,
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(147,197,253,0.4)')}
            >
              Disclaimer
            </button>
            {[
              { label: 'Privacy Policy', href: '/privacy-policy' },
              { label: 'Terms', href: '/terms' },
              { label: 'Contact', href: '/contact' },
            ].map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                style={{
                  fontFamily: 'Inter, Arial, sans-serif',
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'rgba(147,197,253,0.4)',
                  textDecoration: 'none',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(147,197,253,0.4)')}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Legal Modal */}
      {activeModal && (
        <LegalModal
          doc={LEGAL[activeModal]}
          onClose={() => setActiveModal(null)}
        />
      )}
    </footer>
  );
};

export default Footer;
