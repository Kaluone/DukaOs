'use client'
import { useEffect, useRef } from 'react'
import { useLanguage } from '../context/LanguageContext'

const t = {
  sw: {
    badge:    'Kwa Nini Tuchague',
    title:    'Sababu za Kuchagua DukaOS',
    subtitle: 'Zaidi ya mfumo tu — ni mshirika wa biashara yako.',
    reasons: [
      { icon: '🚀', title: 'Mfumo wa Kisasa',        desc: 'Teknolojia ya hali ya juu iliyobuniwa na wataalamu wa kimataifa kwa biashara za Tanzania.' },
      { icon: '😊', title: 'Rahisi Kutumia',          desc: 'Hata bila ujuzi wa teknolojia, utaweza kuanza kutumia DukaOS ndani ya saa moja.' },
      { icon: '🔐', title: 'Data Salama Kabisa',      desc: 'Encryption ya kiwango cha kimataifa. Data yako haipatikani na mtu yeyote isipokuwe wewe.' },
      { icon: '☁️', title: 'Cloud Technology',        desc: 'Hifadhi kwenye cloud. Hata simu ikiharibika au kukaa, data yako ipo salama daima.' },
      { icon: '📊', title: 'Ripoti za Kina',          desc: 'Ripoti za kina za kila siku, wiki, na mwezi zinakusaidia kufanya maamuzi bora ya biashara.' },
      { icon: '📈', title: 'Scalability',             desc: 'Biashara yako inakua? DukaOS inakua nawe — kuanzia duka moja hadi matawi mengi.' },
      { icon: '💬', title: 'Msaada wa Haraka',        desc: 'Timu yetu inajibu haraka kupitia WhatsApp. Tunaelewa Kiswahili na tunajua biashara za Tanzania.' },
      { icon: '🇹🇿', title: 'Imeundwa kwa Tanzania', desc: 'Imebuniwa na watu wanaojua mazingira ya biashara za Tanzania — simu, internet, na bidhaa.' },
    ],
  },
  en: {
    badge:    'Why Choose Us',
    title:    'Reasons to Choose DukaOS',
    subtitle: 'More than just software — a true business partner.',
    reasons: [
      { icon: '🚀', title: 'Modern System',            desc: 'Cutting-edge technology built by international experts specifically for Tanzanian businesses.' },
      { icon: '😊', title: 'Easy to Use',              desc: 'Even without tech knowledge, you can start using DukaOS within one hour.' },
      { icon: '🔐', title: 'Completely Secure Data',   desc: 'International-grade encryption. Your data is accessible only to you.' },
      { icon: '☁️', title: 'Cloud Technology',         desc: 'Stored in the cloud. Even if your phone breaks, your data is always safe.' },
      { icon: '📊', title: 'Deep Reports',             desc: 'Detailed daily, weekly and monthly reports help you make better business decisions.' },
      { icon: '📈', title: 'Scalability',              desc: "Your business grows? DukaOS grows with you — from one shop to multiple branches." },
      { icon: '💬', title: 'Fast Support',             desc: 'Our team responds quickly via WhatsApp. We understand Kiswahili and Tanzanian business.' },
      { icon: '🇹🇿', title: 'Built for Tanzania',     desc: "Designed by people who know Tanzania's business environment — mobile, internet and products." },
    ],
  },
}

export default function WhyChooseUs() {
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
    <section id="why-choose" ref={ref} style={{ background: '#F7F9F6', padding: '96px 24px' }}>
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {tx.reasons.map((r, i) => (
            <div key={i} className="fade-up" style={{ transitionDelay: `${(i % 4) * 60}ms` }}>
              <div style={{
                background: '#fff', borderRadius: 18, padding: '28px 24px',
                border: '1px solid #DDE5DA', height: '100%',
                transition: 'all 0.25s ease',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(11,92,46,0.1)'; e.currentTarget.style.borderColor = '#BDC9B8' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#DDE5DA' }}>
                <div style={{ fontSize: 36, marginBottom: 16 }}>{r.icon}</div>
                <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 16, fontWeight: 700, color: '#111D0F', marginBottom: 10 }}>{r.title}</h3>
                <p style={{ fontSize: 13.5, color: '#5A6B56', lineHeight: 1.7, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{r.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
