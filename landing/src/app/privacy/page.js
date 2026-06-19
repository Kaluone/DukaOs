import Link from 'next/link'

export const metadata = {
  title: 'Sera ya Faragha | Privacy Policy — DukaOS',
  description: 'Sera ya Faragha ya DukaOS. Jinsi tunavyokusanya, kulinda na kutumia data yako.',
}

export default function PrivacyPage() {
  const updated = 'Juni 18, 2026 / June 18, 2026'

  return (
    <div style={{ minHeight: '100vh', background: '#F7F9F6' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0B5C2E 0%, #16803C 100%)', padding: '80px 24px 60px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.75)', textDecoration: 'none', fontSize: 14, fontFamily: 'Plus Jakarta Sans, sans-serif', marginBottom: 24 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            DukaOS
          </Link>
          <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 'clamp(2rem, 5vw, 2.8rem)', fontWeight: 800, color: '#fff', marginBottom: 12, letterSpacing: '-0.02em' }}>
            Sera ya Faragha<br /><span style={{ fontSize: '0.65em', opacity: 0.8 }}>Privacy Policy</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14 }}>
            Ilisasishwa / Last updated: {updated}
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '60px 24px 80px' }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: '48px 40px', border: '1px solid #DDE5DA', boxShadow: '0 4px 16px rgba(11,92,46,0.07)' }} className="legal-content">

          <Section title="1. Utangulizi / Introduction">
            <p>DukaOS («sisi», «mfumo», «bidhaa») ni bidhaa inayomilikiwa na kuendeshwa na <strong>AutoRevenue Labs</strong>. Sera hii ya Faragha inaelezea jinsi tunavyokusanya, kutumia, kuhifadhi na kulinda taarifa zako binafsi unapotumia mfumo wetu.</p>
            <p>DukaOS («we», «system», «product») is a product owned and operated by <strong>AutoRevenue Labs</strong>. This Privacy Policy explains how we collect, use, store and protect your personal information when you use our platform.</p>
          </Section>

          <Section title="2. Taarifa Tunazokusanya / Data We Collect">
            <p><strong>Taarifa za Akaunti / Account Information:</strong></p>
            <ul>
              <li>Jina lako (kutoka kwa Google Sign-In) / Your name (from Google Sign-In)</li>
              <li>Anwani ya barua pepe / Email address</li>
              <li>Picha ya wasifu (kama inapatikana) / Profile photo (if available)</li>
            </ul>
            <p><strong>Taarifa za Biashara / Business Information:</strong></p>
            <ul>
              <li>Jina la biashara / Business name</li>
              <li>Aina ya biashara / Business type</li>
              <li>Bidhaa, bei, na stok / Products, prices and stock</li>
              <li>Rekodi za mauzo na matumizi / Sales and expense records</li>
              <li>Taarifa za wafanyakazi (bila nywila) / Staff information (without passwords)</li>
            </ul>
            <p><strong>Taarifa za Kiufundi / Technical Information:</strong></p>
            <ul>
              <li>Anwani ya IP / IP address</li>
              <li>Aina ya kifaa na mfumo wa uendeshaji / Device type and operating system</li>
              <li>Kumbukumbu za matumizi / Usage logs</li>
            </ul>
          </Section>

          <Section title="3. Jinsi Tunavyotumia Taarifa / How We Use Your Data">
            <ul>
              <li>Kutoa huduma za DukaOS / To provide DukaOS services</li>
              <li>Kuboresha mfumo / To improve the platform</li>
              <li>Kutuma arifa muhimu za huduma / To send important service notifications</li>
              <li>Kutoa msaada wa kiufundi / To provide technical support</li>
              <li>Kuzuia matumizi mabaya / To prevent misuse</li>
              <li>Kufuata sheria za Tanzania / To comply with Tanzanian laws</li>
            </ul>
            <p><strong>Hatutauza taarifa zako kwa mtu yeyote. / We will never sell your data to anyone.</strong></p>
          </Section>

          <Section title="4. Kuhifadhi na Usalama wa Data / Data Storage & Security">
            <p>Data yako yote inahifadhiwa kwenye miundombinu salama ya <strong>Supabase (AWS)</strong>. Tunalinda data kwa njia zifuatazo:</p>
            <p>All your data is stored on secure <strong>Supabase (AWS)</strong> infrastructure. We protect data through:</p>
            <ul>
              <li>Encryption ya TLS/HTTPS kwa njia zote / TLS/HTTPS encryption on all connections</li>
              <li>Row-Level Security (RLS) — kila biashara inaona data yake tu / Each business sees only its own data</li>
              <li>Backup ya otomatiki kila siku / Automatic daily backups</li>
              <li>Ufikiaji mdogo wa waajiriwa — principle of least privilege / Minimal staff access — principle of least privilege</li>
              <li>Uchunguzi wa shughuli za kawaida / Monitoring for unusual activity</li>
            </ul>
          </Section>

          <Section title="5. Faragha ya Biashara / Business Privacy">
            <p><strong>Mfumo wa Multi-Tenant:</strong> DukaOS ni mfumo wa multi-tenant. Hii inamaanisha kila biashara ina data yake binafsi iliyohifadhiwa kwa njia salama. Hakuna mfanyabiashara mwingine — hata mmiliki wa mfumo — anayeweza kuona taarifa za biashara nyingine.</p>
            <p><strong>Multi-Tenant Architecture:</strong> DukaOS is a multi-tenant system. This means every business has its own data stored securely. No other merchant — not even the platform owner — can access another business's information.</p>
          </Section>

          <Section title="6. Kuki / Cookies">
            <p>Tunatumia kuki muhimu tu kwa ajili ya:</p>
            <p>We use only essential cookies for:</p>
            <ul>
              <li>Kuhifadhi hali ya kuingia / Maintaining login state</li>
              <li>Mipangilio ya lugha / Language preferences</li>
              <li>Usalama wa vikao / Session security</li>
            </ul>
            <p>Hatutumii kuki za utangazaji / We do not use advertising cookies.</p>
          </Section>

          <Section title="7. Haki Zako / Your Rights">
            <p>Una haki zifuatazo kuhusu data yako:</p>
            <p>You have the following rights regarding your data:</p>
            <ul>
              <li><strong>Haki ya kuona</strong> / Right to access — unaweza kuomba nakala ya data yako / you can request a copy of your data</li>
              <li><strong>Haki ya kusahihisha</strong> / Right to rectification — unaweza kusahihisha taarifa zisizo sahihi / you can correct inaccurate information</li>
              <li><strong>Haki ya kufuta</strong> / Right to erasure — unaweza kuomba data yako ifutwe / you can request deletion of your data</li>
              <li><strong>Haki ya kuzuia</strong> / Right to restrict processing</li>
              <li><strong>Haki ya kupinga</strong> / Right to object to processing</li>
            </ul>
            <p>Kutumia haki hizi, wasiliana nasi kwa: hello@dukaos.co.tz / To exercise these rights, contact us at: hello@dukaos.co.tz</p>
          </Section>

          <Section title="8. Taarifa za Watoto / Children's Data">
            <p>DukaOS haikusudiwa kwa watoto wenye umri wa chini ya miaka 18. Hatukusanyi taarifa za watoto kwa makusudi. Kama una wasiwasi, wasiliana nasi.</p>
            <p>DukaOS is not intended for children under 18 years of age. We do not knowingly collect children's data. If you have concerns, please contact us.</p>
          </Section>

          <Section title="9. Mabadiliko ya Sera / Policy Changes">
            <p>Tunaweza kubadilisha sera hii kwa wakati. Mabadiliko makubwa yatatangazwa kwa barua pepe au ndani ya mfumo. Matumizi yaliyoendelea baada ya mabadiliko yanamaanisha kukubali sera mpya.</p>
            <p>We may update this policy from time to time. Significant changes will be announced via email or within the platform. Continued use after changes indicates acceptance of the new policy.</p>
          </Section>

          <Section title="10. Mawasiliano / Contact">
            <p>Kwa maswali kuhusu sera hii, wasiliana nasi:</p>
            <p>For questions about this policy, contact us:</p>
            <ul>
              <li><strong>Barua pepe / Email:</strong> hello@dukaos.co.tz</li>
              <li><strong>WhatsApp:</strong> +255 XXX XXX XXX</li>
              <li><strong>Kampuni / Company:</strong> AutoRevenue Labs, Tanzania</li>
            </ul>
          </Section>
        </div>

        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: '#0B5C2E', color: '#fff', borderRadius: 10, textDecoration: 'none', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 14 }}>
            ← Rudi DukaOS / Back to DukaOS
          </Link>
        </div>
      </div>

      <style>{`
        .legal-content p { margin-bottom: 14px; font-size: 15px; line-height: 1.8; color: #3A4A36; font-family: 'Plus Jakarta Sans', sans-serif; }
        .legal-content ul { margin: 12px 0 16px 20px; }
        .legal-content li { font-size: 14.5px; color: #5A6B56; line-height: 1.75; margin-bottom: 6px; font-family: 'Plus Jakarta Sans', sans-serif; }
        .legal-content strong { color: #111D0F; }
        @media (max-width: 640px) {
          .legal-content { padding: 32px 24px !important; }
        }
      `}</style>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 19, fontWeight: 700, color: '#111D0F', marginBottom: 16, paddingBottom: 10, borderBottom: '2px solid #E8F5EE' }}>{title}</h2>
      {children}
    </div>
  )
}
