'use client'
import { useState, useEffect, useRef } from 'react'
import { useLanguage } from '../context/LanguageContext'

const faqs = {
  sw: [
    { q: 'Je, mfumo unahitaji intaneti kufanya kazi?', a: 'POS inafanya kazi kabisa bila intaneti. Mauzo yanahifadhiwa kwenye simu na kusawazishwa mara intaneti inarudi. Dashibodi ya mmiliki inahitaji intaneti kwa data ya wakati halisi.' },
    { q: 'Naweza kutumia DukaOS kwenye simu yangu?', a: 'Ndiyo. DukaOS ina app ya Android kwa POS na operesheni za duka. Pia kuna dashibodi ya wavuti inayofanya kazi kwenye browser yoyote — simu, tablet au kompyuta.' },
    { q: 'Data yangu iko salama?', a: 'Ndiyo kabisa. Data yako inahifadhiwa kwenye miundombinu salama ya AWS kupitia Supabase. Kila biashara inaona data yake tu. Hakuna biashara nyingine wala mmiliki wa mfumo anayeweza kuona data yako.' },
    { q: 'Je, kuna backup ya data yangu?', a: 'Ndiyo. Data yote inabacked-up otomatiki kwenye cloud. Hata simu ikiharibika, kupotea au kukaa, data yako ipo salama na unaweza kuipatia kwenye kifaa kipya.' },
    { q: 'Naweza kuongeza wafanyakazi?', a: 'Ndiyo. Unaweza kuongeza wafanyakazi wangi kadri unavyotaka. Kila mfanyakazi anapata PIN yake ya siri ya kuingia. Unaweza kuweka vikwazo vya ruhusa — baadhi wanaweza kuuza tu, wengine wanaweza kubadilisha bei.' },
    { q: 'Naweza kutumia barcode scanner?', a: 'Ndiyo. DukaOS inasupport barcode scanning kupitia kamera ya simu. Pia unaweza kutumia scanner ya nje (external USB barcode scanner).' },
    { q: 'Je, naweza kupata msaada wa haraka?', a: 'Ndiyo. Timu yetu inapatikana kupitia WhatsApp. Tunajibu haraka — mara nyingi ndani ya masaa 24, na wakati mwingi haraka zaidi. Tunaelewa Kiswahili.' },
    { q: 'Naweza kutumia matawi mengi?', a: 'Ndiyo. Mpango wa Enterprise unasupport matawi mengi (Multi Branch). Kila tawi lina dashibodi yake lakini mmiliki anaona taarifa za matawi yote kutoka sehemu moja.' },
    { q: 'Je, naweza kuingiza bidhaa nyingi kwa wakati mmoja?', a: 'Ndiyo. Mpango wa Business na zaidi unasupport Bulk Import — kuingiza bidhaa nyingi kwa mara moja kupitia faili la Excel au CSV.' },
    { q: 'Malipo yanafanyikaje?', a: 'Hakuna malipo yanayofanyika kwenye ukurasa huu. Baada ya kujiandikisha na kuanzisha biashara yako, malipo yanafanyika ndani ya application moja kwa moja. Timu yetu itakuongoza.' },
    { q: 'Naweza kubadilisha mpango baadaye?', a: 'Ndiyo. Unaweza kupandisha au kushuka mpango wakati wowote kulingana na mahitaji ya biashara yako. Badiliko linafanyika papo hapo.' },
    { q: 'Je, DukaOS inafanya kazi kwa aina yoyote ya biashara?', a: 'Ndiyo. DukaOS inafanya kazi kwa grocery, pharmacy, boutique, hardware, electronics, restaurant na biashara nyingi zaidi. Imebadilika kulingana na aina ya biashara yako.' },
  ],
  en: [
    { q: 'Does the system require internet to work?', a: 'The POS works completely without internet. Sales are saved on the device and synced as soon as internet returns. The owner dashboard requires internet for real-time data.' },
    { q: 'Can I use DukaOS on my phone?', a: 'Yes. DukaOS has an Android app for POS and shop operations. There is also a web dashboard that works in any browser — phone, tablet or computer.' },
    { q: 'Is my data safe?', a: 'Absolutely. Your data is stored on secure AWS infrastructure via Supabase. Each business sees only its own data. No other business or the platform owner can see your data.' },
    { q: 'Is my data backed up?', a: 'Yes. All data is automatically backed up to the cloud. Even if your phone breaks, is lost, or stops working, your data is safe and accessible on a new device.' },
    { q: 'Can I add staff members?', a: 'Yes. You can add as many staff as needed. Each staff member gets their own secret PIN to log in. You can set permission levels — some can only sell, others can change prices.' },
    { q: 'Can I use a barcode scanner?', a: 'Yes. DukaOS supports barcode scanning via the phone camera. You can also use an external USB barcode scanner.' },
    { q: 'Can I get fast support?', a: 'Yes. Our team is available via WhatsApp. We respond quickly — usually within 24 hours, often much faster. We understand Kiswahili.' },
    { q: 'Can I use multiple branches?', a: 'Yes. The Enterprise plan supports multiple branches (Multi Branch). Each branch has its own dashboard but the owner sees all branch reports from one place.' },
    { q: 'Can I import many products at once?', a: 'Yes. The Business plan and above supports Bulk Import — importing many products at once via an Excel or CSV file.' },
    { q: 'How are payments made?', a: 'No payments happen on this page. After signing up and setting up your business, payments are made directly inside the application. Our team will guide you.' },
    { q: 'Can I change my plan later?', a: 'Yes. You can upgrade or downgrade your plan at any time based on your business needs. Changes take effect immediately.' },
    { q: 'Does DukaOS work for any type of business?', a: 'Yes. DukaOS works for grocery, pharmacy, boutique, hardware, electronics, restaurant and many more. It adapts to your type of business.' },
  ],
}

const t = {
  sw: { badge: 'Maswali ya Kawaida', title: 'Maswali Yanayoulizwa Mara kwa Mara', subtitle: 'Jibu la maswali mengi liko hapa chini. Bado una swali? Tutumie WhatsApp.' },
  en: { badge: 'FAQ',               title: 'Frequently Asked Questions',          subtitle: 'Most answers are below. Still have a question? Message us on WhatsApp.' },
}

export default function FAQ() {
  const { lang } = useLanguage()
  const tx = t[lang]
  const items = faqs[lang]
  const [open, setOpen] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    setOpen(null)
  }, [lang])

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') }),
      { threshold: 0.05 }
    )
    ref.current?.querySelectorAll('.fade-up').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  return (
    <section id="faq" ref={ref} style={{ background: '#fff', padding: '96px 24px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div className="fade-up" style={{ textAlign: 'center', marginBottom: 60 }}>
          <div className="section-badge"><span>{tx.badge}</span></div>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(1.75rem, 4vw, 2.6rem)', fontWeight: 800, color: '#111D0F', marginBottom: 16, letterSpacing: '-0.02em' }}>
            {tx.title}
          </h2>
          <p style={{ color: '#5A6B56', fontSize: 17, lineHeight: 1.7, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            {tx.subtitle}
          </p>
        </div>

        <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((item, i) => (
            <div key={i} style={{
              border: '1px solid', borderColor: open === i ? '#0B5C2E' : '#DDE5DA',
              borderRadius: 14, overflow: 'hidden',
              background: open === i ? '#F7F9F6' : '#fff',
              transition: 'all 0.2s ease',
            }}>
              <button onClick={() => setOpen(open === i ? null : i)} style={{
                width: '100%', padding: '18px 22px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 16,
              }}>
                <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 15, color: '#111D0F', lineHeight: 1.4 }}>
                  {item.q}
                </span>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                  background: open === i ? '#0B5C2E' : '#E8F5EE',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke={open === i ? '#fff' : '#0B5C2E'} strokeWidth="2.5" strokeLinecap="round"
                    style={{ transition: 'transform 0.25s', transform: open === i ? 'rotate(45deg)' : 'none' }}>
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                </div>
              </button>
              {open === i && (
                <div style={{ padding: '0 22px 20px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14.5, color: '#5A6B56', lineHeight: 1.75 }}>
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
