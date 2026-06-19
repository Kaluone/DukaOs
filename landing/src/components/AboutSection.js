'use client'
import { useEffect, useRef } from 'react'
import { useLanguage } from '../context/LanguageContext'

const t = {
  sw: {
    badge:    'Kuhusu Sisi',
    title:    'DukaOS — Bidhaa ya AutoRevenue Labs',
    body1:    'DukaOS ni bidhaa rasmi iliyoundwa, inamilikiwa na kuendeshwa na AutoRevenue Labs. Ni mfumo wa kisasa wa usimamizi wa biashara ulioundwa kwa ajili ya wafanyabiashara wa Tanzania na Afrika Mashariki.',
    body2:    'AutoRevenue Labs inalenga kujenga mifumo ya kisasa inayowasaidia wafanyabiashara kuongeza ufanisi, kupunguza gharama na kukuza biashara zao kupitia teknolojia. Tunaamini kwamba teknolojia nzuri inapaswa kufikika kwa kila mfanyabiashara, bila kujali ukubwa wa biashara.',
    body3:    'Tunaendelea kuboresha DukaOS kila siku kwa kusikiliza maoni ya wateja wetu na kutumia teknolojia mpya za kisasa ili kukupa uzoefu bora zaidi.',
    mission:  'Dhamira Yetu',
    missionText: 'Kuwawezesha wafanyabiashara wa Tanzania na Afrika Mashariki kufanikiwa kupitia teknolojia ya kisasa, rahisi na ya kuaminika.',
    vision:   'Maono Yetu',
    visionText:  'Kuwa mfumo mkuu wa usimamizi wa biashara ndogo na za kati Afrika Mashariki ifikapo mwaka 2030.',
    stats: [
      { value: '2023', label: 'Mwaka wa Kuanzishwa' },
      { value: '100+', label: 'Maduka Yanayotumia' },
      { value: '10+',  label: 'Aina za Biashara' },
      { value: '24/7', label: 'Msaada wa Wateja' },
    ],
  },
  en: {
    badge:    'About Us',
    title:    'DukaOS — A Product of AutoRevenue Labs',
    body1:    'DukaOS is an official product created, owned and operated by AutoRevenue Labs. It is a modern business management system built for merchants in Tanzania and East Africa.',
    body2:    'AutoRevenue Labs aims to build modern systems that help business owners increase efficiency, reduce costs and grow their businesses through technology. We believe great technology should be accessible to every merchant, regardless of business size.',
    body3:    'We continuously improve DukaOS every day by listening to our customers and using the latest modern technologies to give you the best possible experience.',
    mission:  'Our Mission',
    missionText: 'To empower business owners in Tanzania and East Africa to succeed through accessible, simple, and reliable modern technology.',
    vision:   'Our Vision',
    visionText:  'To become the leading business management system for small and medium enterprises in East Africa by 2030.',
    stats: [
      { value: '2023', label: 'Year Founded' },
      { value: '100+', label: 'Active Shops' },
      { value: '10+',  label: 'Business Types' },
      { value: '24/7', label: 'Customer Support' },
    ],
  },
}

export default function AboutSection() {
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
    <section id="about" ref={ref} style={{ background: '#fff', padding: '96px 24px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'start' }} className="about-grid">

          {/* Left */}
          <div>
            <div className="fade-up">
              <div className="section-badge"><span>{tx.badge}</span></div>
              <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', fontWeight: 800, color: '#111D0F', marginBottom: 24, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                {tx.title}
              </h2>
              <p style={{ color: '#5A6B56', fontSize: 16, lineHeight: 1.8, marginBottom: 16, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{tx.body1}</p>
              <p style={{ color: '#5A6B56', fontSize: 16, lineHeight: 1.8, marginBottom: 16, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{tx.body2}</p>
              <p style={{ color: '#5A6B56', fontSize: 16, lineHeight: 1.8, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{tx.body3}</p>
            </div>

            {/* Stats row */}
            <div className="fade-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginTop: 36 }}>
              {tx.stats.map((s, i) => (
                <div key={i} style={{ background: '#F7F9F6', borderRadius: 14, padding: '20px 18px', border: '1px solid #DDE5DA' }}>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 28, fontWeight: 800, color: '#0B5C2E', letterSpacing: '-0.02em' }}>{s.value}</div>
                  <div style={{ fontSize: 12.5, color: '#5A6B56', marginTop: 4, fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 500 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right */}
          <div className="fade-up">
            {/* Mission card */}
            <div style={{
              background: 'linear-gradient(135deg, #0B5C2E 0%, #16803C 100%)',
              borderRadius: 20, padding: '32px 28px', marginBottom: 20,
              boxShadow: '0 12px 36px rgba(11,92,46,0.25)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🎯</div>
                <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 16, color: '#fff' }}>{tx.mission}</span>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, lineHeight: 1.7, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{tx.missionText}</p>
            </div>

            {/* Vision card */}
            <div style={{
              background: '#fff', borderRadius: 20, padding: '32px 28px',
              border: '1px solid #DDE5DA',
              boxShadow: '0 4px 16px rgba(11,92,46,0.07)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#E8F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🔭</div>
                <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 16, color: '#111D0F' }}>{tx.vision}</span>
              </div>
              <p style={{ color: '#5A6B56', fontSize: 15, lineHeight: 1.7, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{tx.visionText}</p>
            </div>

            {/* AutoRevenue Labs badge */}
            <div className="fade-up" style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px', background: '#F7F9F6', borderRadius: 14, border: '1px solid #DDE5DA' }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: 'linear-gradient(135deg, #0B5C2E, #16803C)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" fill="white" opacity="0.9"/>
                  <path d="M9 22V12h6v10" fill="rgba(11,92,46,0.5)"/>
                </svg>
              </div>
              <div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: 15, color: '#111D0F' }}>AutoRevenue Labs</div>
                <div style={{ fontSize: 12.5, color: '#8D9E88', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>DukaOS Official Developer & Owner</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .about-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
        }
      `}</style>
    </section>
  )
}
