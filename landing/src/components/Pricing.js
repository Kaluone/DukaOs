'use client'
import { useEffect, useRef } from 'react'
import { useLanguage } from '../context/LanguageContext'

const APP_URL    = process.env.NEXT_PUBLIC_APP_URL || 'https://app.dukaos.co.tz'
const WA_CONTACT = 'https://wa.me/255740616905?text=Nataka%20kupata%20maelezo%20ya%20DukaOS%20Enterprise'

const t = {
  sw: {
    badge:      'Bei Wazi',
    title:      'Chagua Mpango Unaokufaa',
    subtitle:   'Vifurushi vinne kwa biashara zote — kuanzia biashara ndogo hadi kubwa na matawi mengi.',
    setup:      'Ada ya Kuanzisha',
    monthly:    'kwa mwezi',
    popular:    'Inayopendelewa',
    includes:   'Inajumuisha:',
    everything: 'Kila kitu cha',
    ctaStart:   'Anza Sasa',
    ctaContact: 'Wasiliana na Mauzo',
    ctaCustom:  'Omba Bei',
    startingFrom: 'Kuanzia',
    perMonth:   'kwa mwezi',
    note:       'Hakuna sehemu ya kulipia moja kwa moja hapa. Malipo yanafanyika ndani ya application.',

    plans: [
      {
        key: 'starter', name: 'Starter', color: '#1A7A42',
        setup: 'TZS 100,000', monthly: 'TZS 25,000',
        features: ['POS ya kisasa', 'Usimamizi wa bidhaa', 'Usimamizi wa stok', 'Dashibodi ya wakati halisi', 'Ripoti za mauzo'],
      },
      {
        key: 'business', name: 'Business', color: '#0B5C2E', popular: true,
        setup: 'TZS 250,000', monthly: 'TZS 60,000',
        parent: 'Starter',
        features: ['Usimamizi wa wafanyakazi', 'Barcode Scanner', 'Kuingiza kwa wingi (Bulk Import)', 'Usimamizi wa wasambazaji', 'Usimamizi wa manunuzi', 'Ufuatiliaji wa matumizi', 'Ripoti za faida'],
      },
      {
        key: 'pro', name: 'Pro', color: '#7C3AED',
        setup: 'TZS 500,000', monthly: 'TZS 120,000',
        parent: 'Business',
        features: ['AI Business Insights', 'Watumiaji wengi (Multi User)', 'Arifa za WhatsApp', 'Ripoti za PDF', 'Cloud Backup', 'Msaada wa kipaumbele'],
      },
      {
        key: 'enterprise', name: 'Enterprise', color: '#0369A1', custom: true,
        setup: 'Bei ya makubaliano', monthly: 'TZS 250,000+',
        features: ['Matawi mengi (Multi Branch)', 'API Access', 'Uunganisho wa ziada', 'Msaada maalum', 'Vipengele vya ziada', 'Enterprise Deployment'],
      },
    ],
  },
  en: {
    badge:      'Clear Pricing',
    title:      'Choose Your Plan',
    subtitle:   'Four plans for every business — from small shops to large enterprises with multiple branches.',
    setup:      'Setup Fee',
    monthly:    'per month',
    popular:    'Most Popular',
    includes:   'Includes:',
    everything: 'Everything in',
    ctaStart:   'Get Started',
    ctaContact: 'Contact Sales',
    ctaCustom:  'Request Quote',
    startingFrom: 'Starting from',
    perMonth:   'per month',
    note:       'No direct payment here. Payments are handled within the application.',

    plans: [
      {
        key: 'starter', name: 'Starter', color: '#1A7A42',
        setup: 'TZS 100,000', monthly: 'TZS 25,000',
        features: ['Modern POS', 'Product Management', 'Stock Management', 'Real-Time Dashboard', 'Sales Reports'],
      },
      {
        key: 'business', name: 'Business', color: '#0B5C2E', popular: true,
        setup: 'TZS 250,000', monthly: 'TZS 60,000',
        parent: 'Starter',
        features: ['Staff Management', 'Barcode Scanner', 'Bulk Product Import', 'Supplier Management', 'Purchase Management', 'Expense Tracking', 'Profit Reports'],
      },
      {
        key: 'pro', name: 'Pro', color: '#7C3AED',
        setup: 'TZS 500,000', monthly: 'TZS 120,000',
        parent: 'Business',
        features: ['AI Business Insights', 'Multi User Access', 'WhatsApp Alerts', 'PDF Reports', 'Cloud Backup', 'Priority Support'],
      },
      {
        key: 'enterprise', name: 'Enterprise', color: '#0369A1', custom: true,
        setup: 'Custom pricing', monthly: 'TZS 250,000+',
        features: ['Multi Branch', 'API Access', 'Advanced Integrations', 'Dedicated Support', 'Custom Features', 'Enterprise Deployment'],
      },
    ],
  },
}

function CheckIcon({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

export default function Pricing() {
  const { lang } = useLanguage()
  const tx = t[lang]
  const ref = useRef(null)

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') }),
      { threshold: 0.06 }
    )
    ref.current?.querySelectorAll('.fade-up').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  return (
    <section id="pricing" ref={ref} style={{ background: '#F7F9F6', padding: '96px 24px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div className="fade-up" style={{ textAlign: 'center', marginBottom: 64 }}>
          <div className="section-badge"><span>{tx.badge}</span></div>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.6rem)', fontWeight: 800, color: '#111D0F', marginBottom: 16, letterSpacing: '-0.02em' }}>
            {tx.title}
          </h2>
          <p style={{ color: '#5A6B56', fontSize: 17, maxWidth: 560, margin: '0 auto', lineHeight: 1.7, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            {tx.subtitle}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 20, alignItems: 'start' }}>
          {tx.plans.map((plan, i) => (
            <div key={plan.key} className="fade-up" style={{ transitionDelay: `${i * 80}ms`, position: 'relative' }}>
              {plan.popular && (
                <div style={{
                  position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                  background: '#E8A400', padding: '5px 20px', borderRadius: 999,
                  whiteSpace: 'nowrap', zIndex: 2,
                }}>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: '#fff', fontFamily: 'Plus Jakarta Sans, sans-serif', letterSpacing: '0.04em' }}>⭐ {tx.popular}</span>
                </div>
              )}
              <div style={{
                background: '#fff', borderRadius: 20, padding: '32px 28px',
                border: `2px solid ${plan.popular ? plan.color : '#DDE5DA'}`,
                boxShadow: plan.popular ? '0 16px 48px rgba(11,92,46,0.16)' : '0 2px 10px rgba(0,0,0,0.05)',
                height: '100%', display: 'flex', flexDirection: 'column',
                transition: 'all 0.25s ease',
              }}
                onMouseEnter={e => { if (!plan.popular) { e.currentTarget.style.borderColor = plan.color; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.1)' }}}
                onMouseLeave={e => { if (!plan.popular) { e.currentTarget.style.borderColor = '#DDE5DA'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.05)' }}}>

                {/* Plan header */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: plan.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                        {plan.key === 'starter'    && <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>}
                        {plan.key === 'business'   && <><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></>}
                        {plan.key === 'pro'        && <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></>}
                        {plan.key === 'enterprise' && <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>}
                      </svg>
                    </div>
                    <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 20, fontWeight: 800, color: '#111D0F' }}>{plan.name}</span>
                  </div>

                  {/* Price */}
                  {plan.custom ? (
                    <div>
                      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, color: '#8D9E88', marginBottom: 4 }}>{tx.startingFrom}</div>
                      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 32, fontWeight: 800, color: plan.color, letterSpacing: '-0.02em', lineHeight: 1 }}>
                        {plan.monthly}
                      </div>
                      <div style={{ fontSize: 13, color: '#8D9E88', marginTop: 4, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{tx.perMonth}</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 30, fontWeight: 800, color: plan.color, letterSpacing: '-0.02em', lineHeight: 1 }}>{plan.monthly}</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: '#8D9E88', fontFamily: 'Plus Jakarta Sans, sans-serif', marginBottom: 8 }}>{tx.monthly}</div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#F7F9F6', padding: '5px 12px', borderRadius: 8, border: '1px solid #DDE5DA' }}>
                        <span style={{ fontSize: 11.5, color: '#5A6B56', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{tx.setup}:</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#111D0F', fontFamily: 'Space Grotesk, sans-serif' }}>{plan.setup}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Features */}
                <div style={{ flex: 1, marginBottom: 24 }}>
                  {plan.parent && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#F7F9F6', borderRadius: 8, marginBottom: 12, border: '1px solid #DDE5DA' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8D9E88" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                      <span style={{ fontSize: 12.5, color: '#5A6B56', fontFamily: 'Plus Jakarta Sans, sans-serif', fontStyle: 'italic' }}>{tx.everything} {plan.parent}</span>
                    </div>
                  )}
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#8D9E88', letterSpacing: '0.06em', marginBottom: 10, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{tx.includes}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {plan.features.map((f, fi) => (
                      <div key={fi} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: `${plan.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                          <CheckIcon color={plan.color} />
                        </div>
                        <span style={{ fontSize: 13.5, color: '#3A4A36', fontFamily: 'Plus Jakarta Sans, sans-serif', lineHeight: 1.5 }}>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA */}
                {plan.custom ? (
                  <a href={WA_CONTACT} target="_blank" rel="noopener noreferrer" style={{
                    display: 'block', textAlign: 'center',
                    padding: '13px', background: plan.color, color: '#fff',
                    borderRadius: 12, fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontWeight: 700, fontSize: 14.5, textDecoration: 'none',
                    transition: 'all 0.15s',
                    boxShadow: `0 4px 16px ${plan.color}40`,
                  }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${plan.color}50` }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 16px ${plan.color}40` }}>
                    {tx.ctaContact}
                  </a>
                ) : (
                  <a href={`${APP_URL}/#/login`} style={{
                    display: 'block', textAlign: 'center',
                    padding: '13px', background: plan.popular ? plan.color : 'transparent',
                    color: plan.popular ? '#fff' : plan.color,
                    border: `2px solid ${plan.color}`,
                    borderRadius: 12, fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontWeight: 700, fontSize: 14.5, textDecoration: 'none',
                    transition: 'all 0.15s',
                    boxShadow: plan.popular ? `0 4px 16px ${plan.color}40` : 'none',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = plan.color; e.currentTarget.style.color = '#fff'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = plan.popular ? plan.color : 'transparent'; e.currentTarget.style.color = plan.popular ? '#fff' : plan.color; e.currentTarget.style.transform = 'translateY(0)' }}>
                    {tx.ctaStart}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <div className="fade-up" style={{ marginTop: 36, textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#FFF8E1', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 20px' }}>
            <span style={{ fontSize: 16 }}>ℹ️</span>
            <span style={{ fontSize: 13, color: '#92400E', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{tx.note}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
