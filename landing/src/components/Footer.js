'use client'
import { useLanguage } from '../context/LanguageContext'

const t = {
  sw: {
    tagline:  'Mfumo wa kisasa wa usimamizi wa biashara — ulioundwa kwa Tanzania.',
    poweredBy:'Powered by AutoRevenue Labs',
    product:  'BIDHAA',
    company:  'KAMPUNI',
    legal:    'KISHERIA',
    support:  'MSAADA',
    links: {
      product: [
        { label: 'Vipengele',            href: '#features' },
        { label: 'Bei',                  href: '#pricing' },
        { label: 'Jinsi Inavyofanya Kazi', href: '#how' },
        { label: 'Maswali',              href: '#faq' },
        { label: 'Aina za Biashara',     href: '#industries' },
      ],
      company: [
        { label: 'Kuhusu Sisi', href: '#about' },
        { label: 'AutoRevenue Labs', href: 'https://autorevenurelabs.co.tz' },
        { label: 'Wasiliana Nasi', href: '#contact' },
      ],
      legal: [
        { label: 'Sera ya Faragha',       href: '/privacy' },
        { label: 'Masharti ya Matumizi',  href: '/terms' },
      ],
    },
    contact: {
      phone:    '+255 XXX XXX XXX',
      whatsapp: 'WhatsApp: +255 XXX XXX XXX',
      email:    'hello@dukaos.co.tz',
    },
    copy: '© {year} AutoRevenue Labs. Haki zote zimehifadhiwa.',
    madeIn: 'Imeundwa Tanzania 🇹🇿 kwa Tanzania',
  },
  en: {
    tagline:  'Modern business management system — built for Tanzania.',
    poweredBy:'Powered by AutoRevenue Labs',
    product:  'PRODUCT',
    company:  'COMPANY',
    legal:    'LEGAL',
    support:  'SUPPORT',
    links: {
      product: [
        { label: 'Features',     href: '#features' },
        { label: 'Pricing',      href: '#pricing' },
        { label: 'How It Works', href: '#how' },
        { label: 'FAQ',          href: '#faq' },
        { label: 'Industries',   href: '#industries' },
      ],
      company: [
        { label: 'About Us',         href: '#about' },
        { label: 'AutoRevenue Labs', href: 'https://autorevenurelabs.co.tz' },
        { label: 'Contact Us',       href: '#contact' },
      ],
      legal: [
        { label: 'Privacy Policy',   href: '/privacy' },
        { label: 'Terms & Conditions', href: '/terms' },
      ],
    },
    contact: {
      phone:    '+255 XXX XXX XXX',
      whatsapp: 'WhatsApp: +255 XXX XXX XXX',
      email:    'hello@dukaos.co.tz',
    },
    copy: '© {year} AutoRevenue Labs. All Rights Reserved.',
    madeIn: 'Built in Tanzania 🇹🇿 for Tanzania',
  },
}

function FooterCol({ title, children }) {
  return (
    <div>
      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 18, letterSpacing: '0.1em' }}>{title}</div>
      {children}
    </div>
  )
}

function FooterLink({ href, children }) {
  return (
    <a href={href} style={{ display: 'block', marginBottom: 10, fontSize: 13.5, color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontFamily: 'Plus Jakarta Sans, sans-serif', transition: 'color 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.color = '#fff'}
      onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.55)'}>
      {children}
    </a>
  )
}

export default function Footer() {
  const { lang } = useLanguage()
  const tx = t[lang]
  const year = new Date().getFullYear()

  return (
    <footer id="contact" style={{ background: '#0D1A0B', padding: '72px 24px 32px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.5fr', gap: 40, marginBottom: 56 }} className="footer-grid">

          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, #0B5C2E, #16803C)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(11,92,46,0.5)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" fill="white" opacity="0.9"/>
                  <path d="M9 22V12h6v10" fill="rgba(11,92,46,0.6)"/>
                </svg>
              </div>
              <div>
                <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: 20, color: '#fff' }}>DukaOS</span>
                <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.4)', fontFamily: 'Plus Jakarta Sans, sans-serif', letterSpacing: '0.06em', marginTop: -1 }}>{tx.poweredBy}</div>
              </div>
            </div>
            <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, fontFamily: 'Plus Jakarta Sans, sans-serif', maxWidth: 240, marginBottom: 20 }}>
              {tx.tagline}
            </p>
            {/* Social */}
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { href: 'https://wa.me/255000000000', label: 'WhatsApp', icon: <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/> },
                { href: 'https://twitter.com/dukaos_tz', label: 'Twitter', icon: <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.23H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/> },
              ].map((s, i) => (
                <a key={i} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.55)', textDecoration: 'none', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.16)'; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">{s.icon}</svg>
                </a>
              ))}
            </div>
          </div>

          {/* Product links */}
          <FooterCol title={tx.product}>
            {tx.links.product.map((l, i) => <FooterLink key={i} href={l.href}>{l.label}</FooterLink>)}
          </FooterCol>

          {/* Company links */}
          <FooterCol title={tx.company}>
            {tx.links.company.map((l, i) => <FooterLink key={i} href={l.href}>{l.label}</FooterLink>)}
          </FooterCol>

          {/* Legal links */}
          <FooterCol title={tx.legal}>
            {tx.links.legal.map((l, i) => <FooterLink key={i} href={l.href}>{l.label}</FooterLink>)}
          </FooterCol>

          {/* Support / Contact */}
          <FooterCol title={tx.support}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href={`tel:+255000000000`} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: 13.5, fontFamily: 'Plus Jakarta Sans, sans-serif', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.55)'}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 014.67 9.82a19.79 19.79 0 01-3.07-8.67A2 2 0 013.58 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>
                {tx.contact.phone}
              </a>
              <a href="https://wa.me/255000000000" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: 13.5, fontFamily: 'Plus Jakarta Sans, sans-serif', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#25D366'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.55)'}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                {tx.contact.whatsapp}
              </a>
              <a href="mailto:hello@dukaos.co.tz" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: 13.5, fontFamily: 'Plus Jakarta Sans, sans-serif', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.55)'}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                {tx.contact.email}
              </a>
            </div>
          </FooterCol>
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.3)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            {tx.copy.replace('{year}', year)}
          </span>
          <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.3)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            {tx.madeIn}
          </span>
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .footer-grid { grid-template-columns: 1fr 1fr 1fr !important; }
        }
        @media (max-width: 640px) {
          .footer-grid { grid-template-columns: 1fr 1fr !important; gap: 32px !important; }
        }
      `}</style>
    </footer>
  )
}
