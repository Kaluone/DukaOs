'use client'
import { useEffect, useRef } from 'react'
import { useLanguage } from '../context/LanguageContext'

const icons = {
  pos: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
  stock: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>,
  product: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8zM5 17v4M15 17v4"/></svg>,
  barcode: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 5h2M7 5h2M11 5h2M15 5h2M19 5h2M3 19h2M7 19h2M11 19h2M15 19h2M19 19h2M3 5v14M5 5v14M7 5v14M9 5v14M11 5v14M13 5v14M15 5v14M17 5v14M19 5v14M21 5v14"/></svg>,
  staff: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  dash: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  report: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  profit: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  expense: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>,
  purchase: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 001.95-1.56l1.65-8.43H6"/></svg>,
  supplier: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  customer: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  cloud: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/></svg>,
  ai: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  multi: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>,
  lock: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  responsive: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
}

const features_data = {
  sw: [
    { key: 'pos',      title: 'POS ya Kisasa',            desc: 'Mauzo ya haraka kwa kugusa picha za bidhaa. Hakuna barcodes zinazohitajika. Inafanya kazi bila mtandao pia.' },
    { key: 'stock',    title: 'Usimamizi wa Stok',         desc: 'Fuatilia stok mara kwa mara. Arifa zinaendelea kukufikia bidhaa zinapoisha.' },
    { key: 'product',  title: 'Usimamizi wa Bidhaa',       desc: 'Ongeza, hariri au futa bidhaa kwa urahisi. Picha, bei, na kategoria zinasimamiwa vizuri.' },
    { key: 'barcode',  title: 'Barcode Scanner',           desc: 'Skana barcodes haraka kwa kamera ya simu. Inalingana na bidhaa mara moja.' },
    { key: 'staff',    title: 'Usimamizi wa Wafanyakazi',  desc: 'Ongeza wafanyakazi, wape PIN, na angalia kila kinachofanyika. Vikwazo vya ruhusa vinaweza kuwekwa.' },
    { key: 'dash',     title: 'Dashibodi ya Wakati Halisi','desc': 'Muhtasari kamili wa biashara yako — mauzo, stok, na faida — moja kwa moja.' },
    { key: 'report',   title: 'Ripoti za Mauzo',           desc: 'Ripoti za kila siku, wiki, mwezi. Pata PDF au Excel kwa kubonyeza moja.' },
    { key: 'profit',   title: 'Ufuatiliaji wa Faida',      desc: 'Jua faida halisi yako kila wakati. Onyesha tofauti kati ya mapato na gharama.' },
    { key: 'expense',  title: 'Ufuatiliaji wa Matumizi',   desc: 'Rekodi matumizi yote ya biashara — kodi, umeme, usafiri na zaidi.' },
    { key: 'purchase', title: 'Usimamizi wa Manunuzi',     desc: 'Fuatilia manunuzi yote na usimamie wa wapi bidhaa zinakuja.' },
    { key: 'supplier', title: 'Usimamizi wa Wasambazaji',  desc: 'Hifadhi taarifa za wasambazaji wako na historia ya manunuzi.' },
    { key: 'customer', title: 'Usimamizi wa Wateja',       desc: 'Jua wateja wako, historia yao ya manunuzi, na deni zao.' },
    { key: 'cloud',    title: 'Cloud Backup',              desc: 'Data yako inabacked-up otomatiki. Hata simu ikiharibika, data iko salama.' },
    { key: 'ai',       title: 'AI Business Insights',      desc: 'Akili bandia inachambua biashara yako na kutoa mapendekezo ya kukuza faida.' },
    { key: 'multi',    title: 'Multi-Device Access',       desc: 'Tumia DukaOS kwenye simu, tablet na kompyuta wakati mmoja.' },
    { key: 'lock',     title: 'Secure Login',              desc: 'Google Sign-In, PIN ya wafanyakazi. Hifadhi data yako salama kila wakati.' },
    { key: 'responsive', title: 'Responsive Design',       desc: 'Muundo unaobadilika kwa kila skrini — simu, tablet au kompyuta.' },
  ],
  en: [
    { key: 'pos',      title: 'Modern POS',               desc: 'Fast sales by tapping product images. No barcodes required. Works offline too.' },
    { key: 'stock',    title: 'Stock Management',          desc: 'Track inventory in real time. Get alerts before products run out.' },
    { key: 'product',  title: 'Product Management',        desc: 'Add, edit or delete products easily. Images, prices and categories managed.' },
    { key: 'barcode',  title: 'Barcode Scanner',           desc: 'Scan barcodes quickly with your phone camera. Matches products instantly.' },
    { key: 'staff',    title: 'Staff Management',          desc: 'Add staff, assign PINs, and monitor all activity. Set permission levels.' },
    { key: 'dash',     title: 'Real-Time Dashboard',       desc: 'Complete business summary — sales, stock and profit — live.' },
    { key: 'report',   title: 'Sales Reports',             desc: 'Daily, weekly, monthly reports. Export as PDF or Excel in one tap.' },
    { key: 'profit',   title: 'Profit Tracking',           desc: 'Know your real profit at any time. Shows difference between revenue and costs.' },
    { key: 'expense',  title: 'Expense Tracking',          desc: 'Record all business expenses — rent, electricity, transport and more.' },
    { key: 'purchase', title: 'Purchase Management',       desc: 'Track all purchases and manage where products are sourced from.' },
    { key: 'supplier', title: 'Supplier Management',       desc: 'Store supplier details and track purchasing history.' },
    { key: 'customer', title: 'Customer Management',       desc: 'Know your customers, their purchase history and outstanding balances.' },
    { key: 'cloud',    title: 'Cloud Backup',              desc: 'Data is automatically backed up. Even if your phone breaks, data is safe.' },
    { key: 'ai',       title: 'AI Business Insights',      desc: 'AI analyses your business and provides recommendations to grow profit.' },
    { key: 'multi',    title: 'Multi-Device Access',       desc: 'Use DukaOS on phone, tablet and computer simultaneously.' },
    { key: 'lock',     title: 'Secure Login',              desc: 'Google Sign-In plus staff PINs. Your data stays protected at all times.' },
    { key: 'responsive', title: 'Responsive Design',       desc: 'Adapts to any screen — phone, tablet or desktop computer.' },
  ],
}

const t = {
  sw: { badge: 'Vipengele vya DukaOS', title: 'Kila Kitu Unachohitaji', subtitle: 'DukaOS ina vipengele vyote unavyohitaji kusimamia biashara yako kwa ufanisi na kupata faida zaidi.' },
  en: { badge: 'DukaOS Features',      title: 'Everything You Need',     subtitle: 'DukaOS has all the features you need to run your business efficiently and maximize profit.' },
}

export default function Features() {
  const { lang } = useLanguage()
  const tx = t[lang]
  const feats = features_data[lang]
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
    <section id="features" ref={ref} style={{ background: '#fff', padding: '96px 24px' }}>
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 20 }}>
          {feats.map((f, i) => (
            <div key={f.key} className="fade-up" style={{ transitionDelay: `${(i % 6) * 50}ms` }}>
              <div style={{
                background: '#F7F9F6', borderRadius: 18, padding: 26,
                border: '1px solid #DDE5DA', height: '100%',
                transition: 'all 0.25s ease',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(11,92,46,0.12)'; e.currentTarget.style.borderColor = '#BDC9B8'; e.currentTarget.style.background = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#DDE5DA'; e.currentTarget.style.background = '#F7F9F6' }}>
                <div style={{ width: 46, height: 46, background: '#E8F5EE', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0B5C2E', marginBottom: 16 }}>
                  {icons[f.key]}
                </div>
                <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 15.5, fontWeight: 700, color: '#111D0F', marginBottom: 8 }}>{f.title}</h3>
                <p style={{ fontSize: 13.5, color: '#5A6B56', lineHeight: 1.65, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
