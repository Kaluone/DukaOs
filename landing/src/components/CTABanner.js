'use client'
import { useLanguage } from '../context/LanguageContext'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.dukaos.co.tz'
const WA_URL  = 'https://wa.me/255000000000?text=Nataka%20kujua%20zaidi%20kuhusu%20DukaOS'

const t = {
  sw: {
    pill:     'Anza leo',
    title:    'Anza Kuboresha\nBiashara Yako Leo.',
    sub:      'Jiunge na wafanyabiashara wa Tanzania wanaotumia DukaOS kusimamia biashara zao kwa urahisi. Biashara yako inastahili mfumo wa kisasa.',
    cta1:     'Anza Sasa',
    cta2:     'Wasiliana Nasi',
    trust:    ['Data salama kabisa', 'Msaada wa WhatsApp', 'Teknolojia ya Cloud'],
  },
  en: {
    pill:     'Get started today',
    title:    'Start Growing Your\nBusiness Today.',
    sub:      "Join Tanzania's business owners using DukaOS to manage their businesses with ease. Your business deserves a modern system.",
    cta1:     'Get Started',
    cta2:     'Contact Us',
    trust:    ['Completely secure data', 'WhatsApp support', 'Cloud technology'],
  },
}

export default function CTABanner() {
  const { lang } = useLanguage()
  const tx = t[lang]

  return (
    <section style={{ background: 'linear-gradient(135deg, #0B5C2E 0%, #16803C 60%, #0D6E37 100%)', padding: '96px 24px', position: 'relative', overflow: 'hidden' }}>
      {/* Decorative elements */}
      <div style={{ position: 'absolute', top: '-15%', right: '-5%', width: 420, height: 420, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-15%', left: '-5%', width: 320, height: 320, borderRadius: '50%', background: 'rgba(232,164,0,0.12)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '30%', left: '35%', width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(232,164,0,0.2)', border: '1px solid rgba(232,164,0,0.3)', padding: '7px 18px', borderRadius: 999, marginBottom: 28 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#E8A400' }} />
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#E8A400', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{tx.pill}</span>
        </div>

        <h2 style={{
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: 'clamp(1.9rem, 5vw, 3rem)',
          fontWeight: 800, color: '#fff',
          marginBottom: 20, lineHeight: 1.15,
          letterSpacing: '-0.025em',
          whiteSpace: 'pre-line',
        }}>
          {tx.title}
        </h2>

        <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: 17, fontFamily: 'Plus Jakarta Sans, sans-serif', lineHeight: 1.75, maxWidth: 520, margin: '0 auto 44px' }}>
          {tx.sub}
        </p>

        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 36 }}>
          <a href={`${APP_URL}/#/login`} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '15px 36px',
            background: '#E8A400', color: '#fff',
            borderRadius: 12, fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontWeight: 800, fontSize: 15.5, textDecoration: 'none',
            boxShadow: '0 6px 24px rgba(232,164,0,0.45)',
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = '#D4940A'; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 32px rgba(232,164,0,0.55)' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#E8A400'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(232,164,0,0.45)' }}>
            {tx.cta1}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </a>
          <a href={WA_URL} target="_blank" rel="noopener noreferrer" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '15px 32px',
            background: 'transparent', color: '#fff',
            border: '1.5px solid rgba(255,255,255,0.45)', borderRadius: 12,
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 15.5,
            textDecoration: 'none', transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.85)'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.45)'; e.currentTarget.style.background = 'transparent' }}>
            {tx.cta2}
          </a>
        </div>

        <div style={{ display: 'flex', gap: 28, justifyContent: 'center', flexWrap: 'wrap' }}>
          {tx.trust.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E8A400" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.78)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
