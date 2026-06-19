'use client'
import { useLanguage } from '../context/LanguageContext'

const t = {
  sw: {
    title:   'Tunaaminika — Data Yako Ni Salama',
    subtitle:'Kila biashara ina data yake binafsi. Hakuna mfanyabiashara mwingine — hata mmiliki wa mfumo — anayeweza kuona taarifa za biashara nyingine.',
    badges: [
      { icon: '☁️', title: 'Cloud Based',    desc: 'Data yako inahifadhiwa kwenye cloud salama wakati wote.' },
      { icon: '🔒', title: 'Secure & Safe',  desc: 'TLS/HTTPS kwa njia zote. Encryption ya kiwango cha juu.' },
      { icon: '🏢', title: 'Multi-Tenant',   desc: 'Kila biashara inaona data yake tu — privacy kamili.' },
      { icon: '🔑', title: 'Google Sign-In', desc: 'Ingia salama kwa akaunti yako ya Google mara moja.' },
      { icon: '🛡️', title: 'Data Protected', desc: 'Haki za data zinafuata viwango vya kimataifa.' },
      { icon: '⚡', title: 'Fast Performance','desc': 'Haraka kubwa. Upakiaji wa haraka kwenye vifaa vyote.' },
    ],
  },
  en: {
    title:   'Built for Trust — Your Data Stays Private',
    subtitle:'Every business has its own isolated data. No other merchant — not even the platform owner — can see your business information.',
    badges: [
      { icon: '☁️', title: 'Cloud Based',    desc: 'Your data is always securely stored in the cloud.' },
      { icon: '🔒', title: 'Secure & Safe',  desc: 'TLS/HTTPS on all connections. Enterprise-grade encryption.' },
      { icon: '🏢', title: 'Multi-Tenant',   desc: 'Each business sees only its own data — full privacy.' },
      { icon: '🔑', title: 'Google Sign-In', desc: 'Secure login with your Google account in one tap.' },
      { icon: '🛡️', title: 'Data Protected', desc: 'Data rights meet international compliance standards.' },
      { icon: '⚡', title: 'Fast Performance','desc': 'Blazing fast. Quick loading on all devices.' },
    ],
  },
}

export default function TrustSection() {
  const { lang } = useLanguage()
  const tx = t[lang]

  return (
    <section style={{ background: '#0B5C2E', padding: '72px 24px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-20%', right: '-5%', width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-20%', left: '-5%', width: 320, height: 320, borderRadius: '50%', background: 'rgba(232,164,0,0.06)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <h2 style={{
            fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)',
            fontWeight: 800, color: '#fff', marginBottom: 14, letterSpacing: '-0.02em',
          }}>{tx.title}</h2>
          <p style={{
            color: 'rgba(255,255,255,0.72)', fontSize: 16, maxWidth: 580, margin: '0 auto',
            lineHeight: 1.7, fontFamily: 'Plus Jakarta Sans, sans-serif',
          }}>{tx.subtitle}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {tx.badges.map((b, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 16, padding: '24px 20px',
              transition: 'all 0.25s ease',
              backdropFilter: 'blur(8px)',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.transform = 'translateY(-3px)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.transform = 'translateY(0)' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{b.icon}</div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 15, color: '#fff', marginBottom: 8 }}>{b.title}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{b.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
