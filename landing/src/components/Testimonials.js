'use client'
import { useEffect, useRef } from 'react'
import { useLanguage } from '../context/LanguageContext'

const testimonials = {
  sw: [
    {
      name: 'Amina Salim', role: 'Mmiliki — Duka la Nyumbani, Dar es Salaam', initials: 'AS', color: '#0B5C2E',
      quote: 'Nilikuwa nikihesabu mauzo kwa karatasi kila usiku. Sasa naona jumla ya siku hiyo hiyo ukaa mbali. Wafanyakazi wangu hawajui mimi naona kila kitu.',
      stars: 5,
    },
    {
      name: 'Juma Hassan', role: 'Mfanyabiashara — Kariakoo, Dar es Salaam', initials: 'JH', color: '#E8A400',
      quote: 'DukaOS ilinisaidia kujua faida halisi ya biashara yangu mara ya kwanza. Kabla ilikuwa nafikiri ninafanya vizuri, lakini ripoti ilionyesha ukweli.',
      stars: 5,
    },
    {
      name: 'Fatuma Khamis', role: 'Mmiliki — Duka la Nguo, Mwanza', initials: 'FK', color: '#7C3AED',
      quote: 'Stok yangu ilikuwa inakwisha bila kujua. Sasa DukaOS inanijulisha mapema na mimi ninajua wakati wa kuagiza zaidi. Biashara imeboresha sana.',
      stars: 5,
    },
    {
      name: 'Rashid Mwamba', role: 'Mmiliki — Pharmacy, Arusha', initials: 'RM', color: '#0369A1',
      quote: 'Kwa pharmacy, usimamizi wa dawa ni muhimu sana. DukaOS inasaidia kufuatilia kila dawa, bei, na kiwango kilichobaki. Nimependa sana.',
      stars: 5,
    },
    {
      name: 'Grace Mwangi', role: 'Mmiliki — Mini Supermarket, Dodoma', initials: 'GM', color: '#1A7A42',
      quote: 'Mwanzoni nilidhani mfumo huu ni mgumu. Baada ya siku mbili tu, wafanyakazi wangu wote walijifunza. Sasa mauzo yamekuwa rahisi sana.',
      stars: 5,
    },
    {
      name: 'Hassan Omar', role: 'Mfanyabiashara — Electronics, Zanzibar', initials: 'HO', color: '#DC2626',
      quote: 'Msaada wa DukaOS ni wa haraka sana. Siku moja nilikuwa na tatizo, na timu ilinijibu WhatsApp ndani ya dakika 15. Furaha kubwa!',
      stars: 5,
    },
  ],
  en: [
    {
      name: 'Amina Salim', role: 'Owner — Home Shop, Dar es Salaam', initials: 'AS', color: '#0B5C2E',
      quote: 'I used to count sales on paper every night. Now I see the daily total remotely. My staff have no idea I can see everything.',
      stars: 5,
    },
    {
      name: 'Juma Hassan', role: 'Merchant — Kariakoo, Dar es Salaam', initials: 'JH', color: '#E8A400',
      quote: 'DukaOS helped me know my real business profit for the first time. Before, I thought I was doing well — the report revealed the truth.',
      stars: 5,
    },
    {
      name: 'Fatuma Khamis', role: 'Owner — Clothing Store, Mwanza', initials: 'FK', color: '#7C3AED',
      quote: "My stock kept running out without me knowing. Now DukaOS alerts me early and I know when to reorder. Business has improved a lot.",
      stars: 5,
    },
    {
      name: 'Rashid Mwamba', role: 'Owner — Pharmacy, Arusha', initials: 'RM', color: '#0369A1',
      quote: 'For a pharmacy, medicine management is critical. DukaOS helps track every medicine, price and remaining quantity. I love it.',
      stars: 5,
    },
    {
      name: 'Grace Mwangi', role: 'Owner — Mini Supermarket, Dodoma', initials: 'GM', color: '#1A7A42',
      quote: 'At first I thought this system was complex. Within two days all my staff had learned it. Sales have become so much easier.',
      stars: 5,
    },
    {
      name: 'Hassan Omar', role: 'Merchant — Electronics, Zanzibar', initials: 'HO', color: '#DC2626',
      quote: "DukaOS support is extremely fast. One day I had a problem and the team replied on WhatsApp within 15 minutes. Very happy!",
      stars: 5,
    },
  ],
}

const t = {
  sw: { badge: 'Maneno ya Wateja', title: 'Wanaosema DukaOS Imewabadilisha', subtitle: 'Wafanyabiashara wa Tanzania wanashiriki uzoefu wao na DukaOS.', placeholder: 'Nafasi Yako Inaweza Kuwa Hapa' },
  en: { badge: 'Customer Reviews', title: 'What Our Customers Say', subtitle: 'Business owners from Tanzania share their experience with DukaOS.', placeholder: 'Your Review Could Be Here' },
}

export default function Testimonials() {
  const { lang } = useLanguage()
  const tx = t[lang]
  const items = testimonials[lang]
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
    <section id="testimonials" ref={ref} style={{ background: '#F7F9F6', padding: '96px 24px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div className="fade-up" style={{ textAlign: 'center', marginBottom: 64 }}>
          <div className="section-badge"><span>{tx.badge}</span></div>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.6rem)', fontWeight: 800, color: '#111D0F', marginBottom: 16, letterSpacing: '-0.02em' }}>
            {tx.title}
          </h2>
          <p style={{ color: '#5A6B56', fontSize: 17, maxWidth: 480, margin: '0 auto', lineHeight: 1.7, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            {tx.subtitle}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20, marginBottom: 20 }}>
          {items.map((item, i) => (
            <div key={i} className="fade-up" style={{ transitionDelay: `${(i % 3) * 60}ms` }}>
              <div style={{
                background: '#fff', borderRadius: 18, padding: 28,
                border: '1px solid #DDE5DA',
                boxShadow: '0 2px 10px rgba(11,92,46,0.05)',
                display: 'flex', flexDirection: 'column', gap: 18, height: '100%',
                transition: 'all 0.25s ease',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(11,92,46,0.1)'; e.currentTarget.style.borderColor = '#BDC9B8' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(11,92,46,0.05)'; e.currentTarget.style.borderColor = '#DDE5DA' }}>
                <div style={{ display: 'flex', gap: 3 }}>
                  {Array.from({ length: item.stars }).map((_, s) => (
                    <svg key={s} width="16" height="16" viewBox="0 0 24 24" fill="#E8A400">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  ))}
                </div>
                <p style={{ fontSize: 14.5, color: '#3A4A36', lineHeight: 1.75, fontFamily: 'Plus Jakarta Sans, sans-serif', fontStyle: 'italic', flex: 1 }}>
                  &ldquo;{item.quote}&rdquo;
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: 14, color: '#fff' }}>{item.initials}</span>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 14, color: '#111D0F' }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: '#8D9E88', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{item.role}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Placeholder card */}
          <div className="fade-up">
            <div style={{
              background: 'linear-gradient(135deg, #F7F9F6 0%, #E8F5EE 100%)',
              borderRadius: 18, padding: 28,
              border: '2px dashed #BDC9B8',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              textAlign: 'center', minHeight: 200, gap: 12,
            }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#DDE5DA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>💬</div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 15, color: '#8D9E88' }}>{tx.placeholder}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
