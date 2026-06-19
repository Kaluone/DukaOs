'use client'
import { useEffect, useRef } from 'react'
import { useLanguage } from '../context/LanguageContext'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.dukaos.co.tz'
const WA_URL  = 'https://wa.me/255740616905?text=Nataka%20kujua%20zaidi%20kuhusu%20DukaOS'

const t = {
  sw: {
    badge:      'Inaboresha biashara Tanzania 🇹🇿',
    headline1:  'Dhibiti Biashara Yako',
    headline2:  'Kwa Urahisi Ukiwa Popote.',
    sub:        'DukaOS ni mfumo wa kisasa wa usimamizi wa biashara unaokuwezesha kusimamia mauzo, stok, wafanyakazi, matumizi, ripoti na faida zako zote kupitia mfumo mmoja salama unaotumia teknolojia ya Cloud.',
    cta1:       'Anza Sasa',
    cta2:       'Wasiliana Nasi',
    stat1:      'Maduka Yanayotumia',
    stat2:      'Mauzo Yaliyorekodiwa',
    stat3:      'Bidhaa Zilizoorodheshwa',
    liveLabel:  'Moja kwa moja',
    todayLabel: 'Jumla ya Leo',
    recent:     'MAUZO YA KARIBUNI',
    items: [
      { item: 'Beseni la Plastiki',  amount: 'TZS 15,000', method: 'M-Pesa',    time: '14:32' },
      { item: 'Sufuria × 2',         amount: 'TZS 35,000', method: 'Taslimu',   time: '14:08' },
      { item: 'Pazia la Chumba',     amount: 'TZS 28,000', method: 'Tigo Pesa', time: '13:55' },
    ],
    metrics: [
      { label: 'Mauzo',      value: '24', color: '#16A34A', bg: '#F0FDF4' },
      { label: 'Stok Chini', value: '3',  color: '#D97706', bg: '#FFFBEB' },
      { label: 'Wafanyakazi',value: '2',  color: '#0369A1', bg: '#EFF6FF' },
      { label: 'Tofauti',    value: '0',  color: '#0B5C2E', bg: '#E8F5EE' },
    ],
  },
  en: {
    badge:      'Powering businesses in Tanzania 🇹🇿',
    headline1:  'Run Your Business',
    headline2:  'Smarter From Anywhere.',
    sub:        'DukaOS is a modern business management platform that lets you manage sales, inventory, staff, expenses, reports and profit — all through one secure, cloud-powered system.',
    cta1:       'Get Started',
    cta2:       'Contact Us',
    stat1:      'Active Shops',
    stat2:      'Sales Recorded',
    stat3:      'Products Listed',
    liveLabel:  'Live',
    todayLabel: "Today's Revenue",
    recent:     'RECENT SALES',
    items: [
      { item: 'Plastic Basin',  amount: 'TZS 15,000', method: 'M-Pesa',    time: '14:32' },
      { item: 'Pots × 2',      amount: 'TZS 35,000', method: 'Cash',      time: '14:08' },
      { item: 'Room Curtain',   amount: 'TZS 28,000', method: 'Tigo Pesa', time: '13:55' },
    ],
    metrics: [
      { label: 'Sales',     value: '24', color: '#16A34A', bg: '#F0FDF4' },
      { label: 'Low Stock', value: '3',  color: '#D97706', bg: '#FFFBEB' },
      { label: 'Staff',     value: '2',  color: '#0369A1', bg: '#EFF6FF' },
      { label: 'Variance',  value: '0',  color: '#0B5C2E', bg: '#E8F5EE' },
    ],
  },
}

function StatCounter({ end, label }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 26, fontWeight: 800, color: '#0B5C2E', letterSpacing: '-0.02em' }}>
        {end > 0 ? `${end.toLocaleString()}+` : '—'}
      </div>
      <div style={{ fontSize: 11.5, color: '#5A6B56', fontWeight: 500, marginTop: 3, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{label}</div>
    </div>
  )
}

export default function Hero({ stats }) {
  const { lang } = useLanguage()
  const tx = t[lang]
  const sectionRef = useRef(null)

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') }),
      { threshold: 0.1 }
    )
    sectionRef.current?.querySelectorAll('.fade-up').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  return (
    <section ref={sectionRef} style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      background: 'linear-gradient(160deg, #F7F9F6 0%, #EDF5EA 50%, #F7F9F6 100%)',
      paddingTop: 70, position: 'relative', overflow: 'hidden',
    }}>
      {/* Background blobs */}
      <div style={{ position: 'absolute', top: '-10%', right: '-8%', width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(11,92,46,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-5%', left: '-5%', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(232,164,0,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '40%', left: '45%', width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(11,92,46,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '80px 24px 80px', position: 'relative', width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'center' }} className="hero-grid">

          {/* Left copy */}
          <div>
            <div className="fade-up" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#E8F5EE', padding: '7px 16px', borderRadius: 999,
              marginBottom: 28, border: '1px solid #BDC9B8',
            }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#16A34A', boxShadow: '0 0 0 3px rgba(22,163,74,0.2)' }} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0B5C2E', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{tx.badge}</span>
            </div>

            <h1 className="fade-up" style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: 'clamp(2.1rem, 5vw, 3.4rem)',
              fontWeight: 800, lineHeight: 1.08,
              color: '#111D0F', marginBottom: 20,
              letterSpacing: '-0.025em',
            }}>
              {tx.headline1}<br />
              <span style={{
                background: 'linear-gradient(135deg, #0B5C2E 0%, #1A9A50 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>{tx.headline2}</span>
            </h1>

            <p className="fade-up" style={{
              fontSize: 'clamp(1rem, 2vw, 1.1rem)', color: '#5A6B56',
              lineHeight: 1.75, marginBottom: 40, maxWidth: 500,
              fontFamily: 'Plus Jakarta Sans, sans-serif',
            }}>
              {tx.sub}
            </p>

            <div className="fade-up" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 52 }}>
              <a href={`${APP_URL}/#/login`} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '15px 30px',
                background: 'linear-gradient(135deg, #0B5C2E 0%, #16803C 100%)',
                color: '#fff', borderRadius: 12,
                fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 15,
                textDecoration: 'none', transition: 'all 0.2s',
                boxShadow: '0 6px 20px rgba(11,92,46,0.32)',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(11,92,46,0.4)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(11,92,46,0.32)' }}>
                {tx.cta1}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </a>
              <a href={WA_URL} target="_blank" rel="noopener noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '15px 28px',
                background: '#fff', color: '#111D0F',
                border: '1.5px solid #DDE5DA', borderRadius: 12,
                fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 15,
                textDecoration: 'none', transition: 'all 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#0B5C2E'; e.currentTarget.style.background = '#F7F9F6' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#DDE5DA'; e.currentTarget.style.background = '#fff' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                {tx.cta2}
              </a>
            </div>

            {/* Stats */}
            <div className="fade-up" style={{
              display: 'flex', gap: 28, flexWrap: 'wrap',
              padding: '20px 24px',
              background: '#fff', borderRadius: 16,
              border: '1px solid #DDE5DA',
              boxShadow: '0 2px 12px rgba(11,92,46,0.07)',
              width: 'fit-content',
            }}>
              <StatCounter end={stats?.shops ?? 0} label={tx.stat1} />
              <div style={{ width: 1, background: '#DDE5DA', alignSelf: 'stretch' }} />
              <StatCounter end={stats?.transactions ?? 0} label={tx.stat2} />
              <div style={{ width: 1, background: '#DDE5DA', alignSelf: 'stretch' }} />
              <StatCounter end={stats?.products ?? 0} label={tx.stat3} />
            </div>
          </div>

          {/* Right — dashboard mockup */}
          <div className="fade-up hero-right" style={{ position: 'relative' }}>
            {/* Floating badge */}
            <div style={{
              position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)',
              background: '#fff', borderRadius: 999, padding: '8px 18px',
              boxShadow: '0 4px 16px rgba(11,92,46,0.15)',
              display: 'flex', alignItems: 'center', gap: 8,
              border: '1px solid #DDE5DA', zIndex: 2,
              animation: 'float 4s ease-in-out infinite',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', boxShadow: '0 0 0 3px rgba(22,163,74,0.2)' }} />
              <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 13, color: '#111D0F' }}>TZS 847,500</span>
              <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>+12%</span>
            </div>

            {/* Main card */}
            <div style={{
              background: '#fff', borderRadius: 24, padding: '28px 24px',
              border: '1px solid #DDE5DA',
              boxShadow: '0 24px 64px rgba(11,92,46,0.14), 0 4px 16px rgba(0,0,0,0.05)',
              maxWidth: 360, margin: '0 auto', position: 'relative',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#8D9E88', fontFamily: 'Plus Jakarta Sans, sans-serif', marginBottom: 3 }}>{tx.todayLabel}</div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 26, fontWeight: 800, color: '#0B5C2E', letterSpacing: '-0.02em' }}>TZS 847,500</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#F0FDF4', padding: '6px 12px', borderRadius: 99, border: '1px solid #BBF7D0' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{tx.liveLabel}</span>
                </div>
              </div>

              {/* Metric cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                {tx.metrics.map((m, i) => (
                  <div key={i} style={{ background: m.bg, borderRadius: 10, padding: '11px 13px', border: '1px solid', borderColor: m.bg }}>
                    <div style={{ fontSize: 10.5, color: m.color, fontWeight: 600, marginBottom: 3, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{m.label}</div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 22, fontWeight: 800, color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Recent txns */}
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8D9E88', marginBottom: 10, letterSpacing: '0.06em', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{tx.recent}</div>
              {tx.items.map((item, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: i < tx.items.length - 1 ? '1px solid #F2F5F1' : 'none',
                }}>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111D0F', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{item.item}</div>
                    <div style={{ fontSize: 10.5, color: '#8D9E88', marginTop: 1 }}>{item.method} · {item.time}</div>
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0B5C2E', fontFamily: 'Space Grotesk, sans-serif' }}>{item.amount}</div>
                </div>
              ))}
            </div>

            {/* Floating mini card */}
            <div style={{
              position: 'absolute', bottom: 12, right: -16,
              background: '#0B5C2E', borderRadius: 14, padding: '14px 18px',
              boxShadow: '0 8px 24px rgba(11,92,46,0.35)',
              display: 'flex', alignItems: 'center', gap: 10,
              animation: 'float 4s ease-in-out infinite',
              animationDelay: '1.5s',
            }} className="floating-card">
              <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 500 }}>Cloud Sync</div>
                <div style={{ fontSize: 13, color: '#fff', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700 }}>100% Secure</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .hero-grid  { grid-template-columns: 1fr !important; gap: 40px !important; }
          .hero-right { display: none !important; }
        }
        @media (max-width: 600px) {
          .floating-card { display: none !important; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-10px); }
        }
      `}</style>
    </section>
  )
}
