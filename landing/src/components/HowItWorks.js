'use client'
import { useEffect, useRef } from 'react'
import { useLanguage } from '../context/LanguageContext'

const t = {
  sw: {
    badge:    'Mchakato Rahisi',
    title:    'Jinsi DukaOS Inavyofanya Kazi',
    subtitle: 'Hatua 5 rahisi. Kuanza kwa DukaOS ni rahisi — hata bila ujuzi wa teknolojia.',
    steps: [
      { n: '01', icon: '📝', title: 'Jiandikishe',           desc: 'Ingia kwa akaunti yako ya Google au unda akaunti mpya kwa dakika chache tu. Hakuna fomu ndefu wala kadi ya benki.' },
      { n: '02', icon: '🏪', title: 'Unda Biashara Yako',    desc: 'Weka jina la biashara, aina ya biashara, na maelezo muhimu. Mfumo utakuandaa haraka.' },
      { n: '03', icon: '📦', title: 'Ongeza Bidhaa',         desc: 'Piga picha au pakia picha za bidhaa zako. Weka bei za kuuza na za ununuzi. Ongeza kwa wingi ukitaka.' },
      { n: '04', icon: '💰', title: 'Anza Kuuza',            desc: 'Gusa picha ya bidhaa, weka idadi, kamilisha muamala. Sekunde 5 tu. Inafanya kazi bila mtandao pia.' },
      { n: '05', icon: '📊', title: 'Pata Ripoti na Usimamie','desc': 'Angalia dashibodi ukiwa popote. Pata ripoti za faida. Simamia stok, wafanyakazi na matumizi.' },
    ],
  },
  en: {
    badge:    'Simple Process',
    title:    'How DukaOS Works',
    subtitle: '5 easy steps. Getting started with DukaOS is simple — even without any tech knowledge.',
    steps: [
      { n: '01', icon: '📝', title: 'Sign Up',              desc: 'Log in with your Google account or create a new one in a few minutes. No lengthy forms or bank card needed.' },
      { n: '02', icon: '🏪', title: 'Create Your Business', desc: 'Enter your business name, business type, and key details. The system will set you up quickly.' },
      { n: '03', icon: '📦', title: 'Add Products',         desc: 'Take photos or upload product images. Set selling and purchase prices. Bulk import available.' },
      { n: '04', icon: '💰', title: 'Start Selling',        desc: 'Tap a product image, enter quantity, complete the transaction. Just 5 seconds. Works offline too.' },
      { n: '05', icon: '📊', title: 'Get Reports & Manage', desc: 'Check your dashboard from anywhere. View profit reports. Manage stock, staff and expenses.' },
    ],
  },
}

export default function HowItWorks() {
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
    <section id="how" ref={ref} style={{ background: '#F7F9F6', padding: '96px 24px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div className="fade-up" style={{ textAlign: 'center', marginBottom: 64 }}>
          <div className="section-badge"><span>{tx.badge}</span></div>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.6rem)', fontWeight: 800, color: '#111D0F', marginBottom: 16, letterSpacing: '-0.02em' }}>
            {tx.title}
          </h2>
          <p style={{ color: '#5A6B56', fontSize: 17, maxWidth: 520, margin: '0 auto', lineHeight: 1.7, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            {tx.subtitle}
          </p>
        </div>

        {/* Desktop: horizontal timeline */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0, position: 'relative' }} className="steps-desktop">
          {/* connector line */}
          <div style={{ position: 'absolute', top: 44, left: '10%', right: '10%', height: 2, background: 'linear-gradient(90deg, #0B5C2E, #16A34A, #0B5C2E)', opacity: 0.15, zIndex: 0 }} />

          {tx.steps.map((s, i) => (
            <div key={i} className="fade-up" style={{ transitionDelay: `${i * 100}ms`, textAlign: 'center', padding: '0 12px', position: 'relative', zIndex: 1 }}>
              {/* Step circle */}
              <div style={{
                width: 88, height: 88, borderRadius: '50%',
                background: i === 0 ? '#0B5C2E' : '#fff',
                border: `2px solid ${i === 0 ? '#0B5C2E' : '#DDE5DA'}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
                boxShadow: i === 0 ? '0 8px 24px rgba(11,92,46,0.3)' : '0 2px 12px rgba(0,0,0,0.07)',
                transition: 'all 0.25s ease',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = '#0B5C2E'; e.currentTarget.style.borderColor = '#0B5C2E'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(11,92,46,0.3)' }}
                onMouseLeave={e => {
                  if (i !== 0) {
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.borderColor = '#DDE5DA';
                    e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.07)';
                  }
                }}>
                <div style={{ fontSize: 24 }}>{s.icon}</div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 11, fontWeight: 800, color: i === 0 ? 'rgba(255,255,255,0.7)' : '#8D9E88', letterSpacing: '0.04em', marginTop: 2 }}>{s.n}</div>
              </div>
              <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 14.5, fontWeight: 700, color: '#111D0F', marginBottom: 8 }}>{s.title}</h3>
              <p style={{ fontSize: 12.5, color: '#5A6B56', lineHeight: 1.65, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Mobile: vertical */}
        <div style={{ display: 'none', flexDirection: 'column', gap: 0 }} className="steps-mobile">
          {tx.steps.map((s, i) => (
            <div key={i} className="fade-up" style={{ transitionDelay: `${i * 80}ms`, display: 'flex', gap: 20, position: 'relative' }}>
              {/* Line */}
              {i < tx.steps.length - 1 && (
                <div style={{ position: 'absolute', left: 27, top: 60, bottom: -8, width: 2, background: '#DDE5DA', zIndex: 0 }} />
              )}
              {/* Circle */}
              <div style={{ flexShrink: 0, width: 56, height: 56, borderRadius: '50%', background: i === 0 ? '#0B5C2E' : '#fff', border: `2px solid ${i === 0 ? '#0B5C2E' : '#DDE5DA'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1, boxShadow: i === 0 ? '0 4px 16px rgba(11,92,46,0.3)' : '0 2px 8px rgba(0,0,0,0.07)', marginTop: 4 }}>
                <span style={{ fontSize: 18 }}>{s.icon}</span>
              </div>
              <div style={{ paddingBottom: 36 }}>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 11, fontWeight: 700, color: '#8D9E88', letterSpacing: '0.05em', marginBottom: 4 }}>{s.n}</div>
                <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 16, fontWeight: 700, color: '#111D0F', marginBottom: 8 }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: '#5A6B56', lineHeight: 1.65, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .steps-desktop { display: none !important; }
          .steps-mobile  { display: flex !important; }
        }
      `}</style>
    </section>
  )
}
