'use client'
import { useEffect, useRef } from 'react'
import { useLanguage } from '../context/LanguageContext'

const t = {
  sw: {
    badge:     'Tatizo na Suluhisho',
    title:     'Unakabiliwa na Matatizo Haya?',
    subtitle:  'Wafanyabiashara wengi wanakabiliwa na changamoto hizi kila siku. DukaOS imezaliwa kutatua matatizo haya yote.',
    problems: [
      { icon: '📦', problem: 'Kupoteza stok bila kujua sababu',         solution: 'DukaOS inafuatilia stok kila wakati kwa usahihi wa asilimia 100.' },
      { icon: '💰', problem: 'Kutokujua faida halisi ya biashara',       solution: 'Ripoti za faida zinaonyesha mapato, gharama na faida mara moja.' },
      { icon: '⚠️', problem: 'Bidhaa zinaisha bila arifa',               solution: 'Arifa za WhatsApp zitakufikia mara stok inakaribia kuisha.' },
      { icon: '📊', problem: 'Mauzo hayafuatilwi vizuri',                solution: 'Kila muamala unarekodiwa na unaweza kuona ripoti wakati wowote.' },
      { icon: '📋', problem: 'Kutokuwa na ripoti sahihi za fedha',       solution: 'Ripoti kamili za kila siku, wiki, mwezi — hata PDF zinazoweza kupakiwa.' },
      { icon: '👥', problem: 'Ugumu wa kusimamia wafanyakazi',           solution: 'Wafanyakazi wanaingia kwa PIN, mmiliki anaona kila kinachofanyika.' },
      { icon: '🏪', problem: 'Huwezi kujua hali ya duka ukiwa mbali',   solution: 'Dashibodi ya wakati halisi inaonyesha kila kitu ukiwa popote duniani.' },
      { icon: '💸', problem: 'Matumizi ya biashara hayafuatilwi',        solution: 'Rekodi za matumizi na manunuzi yanaonekana kwenye ripoti moja.' },
    ],
    problemLabel:  'Tatizo:',
    solutionLabel: 'Suluhisho:',
  },
  en: {
    badge:    'Problem & Solution',
    title:    'Are You Facing These Challenges?',
    subtitle: 'Most business owners face these problems every day. DukaOS was built specifically to solve all of them.',
    problems: [
      { icon: '📦', problem: 'Losing stock without knowing why',           solution: 'DukaOS tracks inventory in real time with 100% accuracy.' },
      { icon: '💰', problem: "Not knowing your real profit",               solution: 'Profit reports show revenue, costs and margins instantly.' },
      { icon: '⚠️', problem: 'Products running out without alerts',        solution: 'WhatsApp alerts notify you before stock runs out.' },
      { icon: '📊', problem: 'Sales not being tracked properly',           solution: 'Every transaction is recorded; view reports anytime.' },
      { icon: '📋', problem: 'No accurate financial reports',              solution: 'Full daily/weekly/monthly reports — downloadable as PDF.' },
      { icon: '👥', problem: 'Difficulty managing staff',                  solution: 'Staff log in with PIN; you see everything they do.' },
      { icon: '🏪', problem: "Can't check your shop when away",            solution: 'Live dashboard shows everything from anywhere in the world.' },
      { icon: '💸', problem: 'Business expenses not tracked',              solution: 'Expenses and purchases appear in one unified report.' },
    ],
    problemLabel:  'Problem:',
    solutionLabel: 'Solution:',
  },
}

export default function WhyDukaOS() {
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
    <section id="why" ref={ref} style={{ background: '#F7F9F6', padding: '96px 24px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>

        <div className="fade-up" style={{ textAlign: 'center', marginBottom: 64 }}>
          <div className="section-badge">
            <span>{tx.badge}</span>
          </div>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.6rem)', fontWeight: 800, color: '#111D0F', marginBottom: 16, letterSpacing: '-0.02em' }}>
            {tx.title}
          </h2>
          <p style={{ color: '#5A6B56', fontSize: 17, maxWidth: 560, margin: '0 auto', lineHeight: 1.7, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            {tx.subtitle}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {tx.problems.map((p, i) => (
            <div key={i} className="fade-up" style={{ transitionDelay: `${i * 50}ms` }}>
              <div style={{
                background: '#fff', borderRadius: 18, padding: 28,
                border: '1px solid #DDE5DA',
                boxShadow: '0 2px 8px rgba(11,92,46,0.05)',
                transition: 'all 0.25s ease',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(11,92,46,0.12)'; e.currentTarget.style.borderColor = '#BDC9B8' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(11,92,46,0.05)'; e.currentTarget.style.borderColor = '#DDE5DA' }}>
                <div style={{ fontSize: 32, marginBottom: 16 }}>{p.icon}</div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#E05252', letterSpacing: '0.06em', marginBottom: 5, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{tx.problemLabel}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#111D0F', fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1.4 }}>{p.problem}</div>
                </div>
                <div style={{ background: '#E8F5EE', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#0B5C2E', letterSpacing: '0.06em', marginBottom: 5, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{tx.solutionLabel}</div>
                  <div style={{ fontSize: 13.5, color: '#3A4A36', lineHeight: 1.65, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                    <span style={{ marginRight: 6 }}>✅</span>{p.solution}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
