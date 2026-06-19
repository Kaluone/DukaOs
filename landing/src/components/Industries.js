'use client'
import { useEffect, useRef } from 'react'
import { useLanguage } from '../context/LanguageContext'

const industries = [
  { icon: '🛒', sw: 'Grocery / Duka la Jumla', en: 'Grocery / General Store' },
  { icon: '🏪', sw: 'Mini Supermarket',         en: 'Mini Supermarket' },
  { icon: '💊', sw: 'Duka la Dawa (Pharmacy)',  en: 'Pharmacy' },
  { icon: '👗', sw: 'Boutique / Nguo',           en: 'Boutique / Clothing' },
  { icon: '🔨', sw: 'Hardware',                  en: 'Hardware Store' },
  { icon: '📱', sw: 'Electronics',               en: 'Electronics Shop' },
  { icon: '💄', sw: 'Cosmetic Shop',             en: 'Cosmetics Shop' },
  { icon: '📚', sw: 'Stationery / Vitabu',       en: 'Stationery Store' },
  { icon: '🌾', sw: 'Agrovet / Kilimo',          en: 'Agrovet / Agriculture' },
  { icon: '📦', sw: 'Wholesaler / Jumla',        en: 'Wholesaler' },
  { icon: '🍽️', sw: 'Mkahawa / Restaurant',      en: 'Restaurant / Café' },
  { icon: '🏬', sw: 'Retail Shop',               en: 'Retail Shop' },
]

const t = {
  sw: {
    badge:    'Aina za Biashara',
    title:    'DukaOS Inafaa kwa Biashara Yoyote',
    subtitle: 'Iwe duka dogo au kubwa, DukaOS imeundwa kubadilika na kukufaa wewe.',
    cta:      'Jaribu Bure Sasa',
  },
  en: {
    badge:    'Industries',
    title:    'DukaOS Works for Any Business',
    subtitle: 'Whether small or large, DukaOS is designed to adapt and work for you.',
    cta:      'Try Free Now',
  },
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.dukaos.co.tz'

export default function Industries() {
  const { lang } = useLanguage()
  const tx = t[lang]
  const ref = useRef(null)

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') }),
      { threshold: 0.08 }
    )
    ref.current?.querySelectorAll('.fade-up').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  return (
    <section id="industries" ref={ref} style={{ background: '#fff', padding: '96px 24px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div className="fade-up" style={{ textAlign: 'center', marginBottom: 56 }}>
          <div className="section-badge"><span>{tx.badge}</span></div>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.6rem)', fontWeight: 800, color: '#111D0F', marginBottom: 16, letterSpacing: '-0.02em' }}>
            {tx.title}
          </h2>
          <p style={{ color: '#5A6B56', fontSize: 17, maxWidth: 520, margin: '0 auto', lineHeight: 1.7, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            {tx.subtitle}
          </p>
        </div>

        <div className="fade-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 48 }}>
          {industries.map((ind, i) => (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 12, padding: '24px 16px',
              background: '#F7F9F6', borderRadius: 16,
              border: '1px solid #DDE5DA',
              textAlign: 'center', cursor: 'default',
              transition: 'all 0.25s ease',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = '#E8F5EE'; e.currentTarget.style.borderColor = '#0B5C2E'; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(11,92,46,0.12)' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#F7F9F6'; e.currentTarget.style.borderColor = '#DDE5DA'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}>
              <span style={{ fontSize: 36 }}>{ind.icon}</span>
              <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, fontWeight: 700, color: '#111D0F', lineHeight: 1.3 }}>
                {lang === 'sw' ? ind.sw : ind.en}
              </span>
            </div>
          ))}
        </div>

        <div className="fade-up" style={{ textAlign: 'center' }}>
          <a href={`${APP_URL}/#/login`} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '14px 32px',
            background: 'linear-gradient(135deg, #0B5C2E 0%, #16803C 100%)',
            color: '#fff', borderRadius: 12,
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 15,
            textDecoration: 'none', transition: 'all 0.2s',
            boxShadow: '0 6px 20px rgba(11,92,46,0.28)',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(11,92,46,0.36)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(11,92,46,0.28)' }}>
            {tx.cta}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </a>
        </div>
      </div>
    </section>
  )
}
