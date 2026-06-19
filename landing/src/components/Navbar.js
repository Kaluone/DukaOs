'use client'
import { useState, useEffect } from 'react'
import { useLanguage } from '../context/LanguageContext'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.dukaos.co.tz'

const t = {
  sw: {
    features: 'Vipengele',
    how:      'Jinsi Inavyofanya Kazi',
    pricing:  'Bei',
    about:    'Kuhusu',
    faq:      'Maswali',
    contact:  'Wasiliana',
    start:    'Anza Sasa',
  },
  en: {
    features: 'Features',
    how:      'How It Works',
    pricing:  'Pricing',
    about:    'About',
    faq:      'FAQ',
    contact:  'Contact',
    start:    'Get Started',
  },
}

export default function Navbar() {
  const { lang, setLang } = useLanguage()
  const tx = t[lang]
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const links = [
    { href: '#features',    label: tx.features },
    { href: '#how',         label: tx.how },
    { href: '#pricing',     label: tx.pricing },
    { href: '#about',       label: tx.about },
    { href: '#faq',         label: tx.faq },
    { href: '#contact',     label: tx.contact },
  ]

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      transition: 'all 0.3s ease',
      background: scrolled ? 'rgba(247,249,246,0.96)' : 'transparent',
      backdropFilter: scrolled ? 'blur(16px)' : 'none',
      WebkitBackdropFilter: scrolled ? 'blur(16px)' : 'none',
      borderBottom: scrolled ? '1px solid #DDE5DA' : '1px solid transparent',
    }}>
      <div style={{
        maxWidth: 1280, margin: '0 auto',
        padding: '0 24px', height: 70,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 38, height: 38,
            background: 'linear-gradient(135deg, #0B5C2E 0%, #16803C 100%)',
            borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(11,92,46,0.3)',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" fill="white" opacity="0.9"/>
              <path d="M9 22V12h6v10" fill="rgba(11,92,46,0.6)"/>
            </svg>
          </div>
          <div>
            <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: 19, color: '#111D0F', letterSpacing: '-0.02em' }}>DukaOS</span>
            <span style={{ display: 'block', fontSize: 9, color: '#8D9E88', fontWeight: 600, letterSpacing: '0.06em', marginTop: -2 }}>by AutoRevenue Labs</span>
          </div>
        </a>

        {/* Desktop nav */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} className="nav-desktop">
          {links.map(l => (
            <a key={l.href} href={l.href} style={{
              padding: '7px 12px',
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 500, fontSize: 13.5,
              color: '#5A6B56', textDecoration: 'none',
              borderRadius: 8, transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.color = '#0B5C2E'; e.currentTarget.style.background = '#E8F5EE' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#5A6B56'; e.currentTarget.style.background = 'transparent' }}>
              {l.label}
            </a>
          ))}
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Language Switcher */}
          <div style={{
            display: 'flex', alignItems: 'center',
            background: '#F0F5EE', borderRadius: 999,
            padding: 3, border: '1px solid #DDE5DA',
          }}>
            {[['sw', '🇹🇿 SW'], ['en', '🇬🇧 EN']].map(([code, label]) => (
              <button key={code} onClick={() => setLang(code)} style={{
                padding: '5px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
                fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 11.5,
                transition: 'all 0.2s',
                background: lang === code ? '#0B5C2E' : 'transparent',
                color: lang === code ? '#fff' : '#5A6B56',
              }}>
                {label}
              </button>
            ))}
          </div>

          {/* CTA */}
          <a href={`${APP_URL}/#/login`} className="nav-cta" style={{
            padding: '10px 20px',
            background: '#0B5C2E', color: '#fff',
            borderRadius: 10,
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 13.5,
            textDecoration: 'none', transition: 'all 0.15s',
            boxShadow: '0 2px 10px rgba(11,92,46,0.25)',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = '#0D6E37'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#0B5C2E'; e.currentTarget.style.transform = 'translateY(0)' }}>
            {tx.start}
          </a>

          {/* Hamburger */}
          <button onClick={() => setMenuOpen(!menuOpen)} className="nav-hamburger" style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '6px', color: '#111D0F', borderRadius: 8,
          }} aria-label="Menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {menuOpen
                ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                : <><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/></>}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{
          background: '#fff', borderTop: '1px solid #DDE5DA',
          padding: '16px 24px 28px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
        }}>
          {links.map(l => (
            <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)} style={{
              display: 'block', padding: '13px 0',
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 500, fontSize: 15,
              color: '#111D0F', textDecoration: 'none',
              borderBottom: '1px solid #F2F5F1',
            }}>{l.label}</a>
          ))}
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button onClick={() => setLang('sw')} style={{
              flex: 1, padding: '10px', border: '1.5px solid',
              borderColor: lang === 'sw' ? '#0B5C2E' : '#DDE5DA',
              borderRadius: 8, cursor: 'pointer',
              background: lang === 'sw' ? '#E8F5EE' : '#fff',
              color: lang === 'sw' ? '#0B5C2E' : '#5A6B56',
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 13,
            }}>🇹🇿 Kiswahili</button>
            <button onClick={() => setLang('en')} style={{
              flex: 1, padding: '10px', border: '1.5px solid',
              borderColor: lang === 'en' ? '#0B5C2E' : '#DDE5DA',
              borderRadius: 8, cursor: 'pointer',
              background: lang === 'en' ? '#E8F5EE' : '#fff',
              color: lang === 'en' ? '#0B5C2E' : '#5A6B56',
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 13,
            }}>🇬🇧 English</button>
          </div>
          <a href={`${APP_URL}/#/login`} style={{
            display: 'block', marginTop: 12,
            padding: '14px 24px', background: '#0B5C2E', color: '#fff',
            borderRadius: 10, textAlign: 'center',
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 15,
            textDecoration: 'none',
          }}>{tx.start}</a>
        </div>
      )}

      <style>{`
        @media (min-width: 900px) {
          .nav-desktop   { display: flex !important; }
          .nav-hamburger { display: none !important; }
          .nav-cta       { display: inline-flex !important; }
        }
        @media (max-width: 899px) {
          .nav-desktop { display: none !important; }
          .nav-hamburger { display: block !important; }
          .nav-cta { display: none !important; }
        }
      `}</style>
    </nav>
  )
}
