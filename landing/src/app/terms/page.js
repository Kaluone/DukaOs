import Link from 'next/link'

export const metadata = {
  title: 'Masharti ya Matumizi | Terms & Conditions — DukaOS',
  description: 'Masharti ya Matumizi ya DukaOS. Sheria na kanuni za kutumia mfumo.',
}

export default function TermsPage() {
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
            Masharti ya Matumizi<br /><span style={{ fontSize: '0.65em', opacity: 0.8 }}>Terms & Conditions</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14 }}>
            Ilisasishwa / Last updated: {updated}
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '60px 24px 80px' }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: '48px 40px', border: '1px solid #DDE5DA', boxShadow: '0 4px 16px rgba(11,92,46,0.07)' }} className="legal-content">

          <Section title="1. Makubaliano / Agreement">
            <p>Kwa kutumia DukaOS, unakubali masharti haya. Kama hukubali, tafadhali acha kutumia mfumo. Masharti haya yanabainisha makubaliano kati yako na <strong>AutoRevenue Labs</strong>, mmiliki wa DukaOS.</p>
            <p>By using DukaOS, you agree to these terms. If you do not agree, please stop using the platform. These terms define the agreement between you and <strong>AutoRevenue Labs</strong>, owner of DukaOS.</p>
          </Section>

          <Section title="2. Matumizi Yanayoruhusiwa / Permitted Use">
            <p>DukaOS inaruhusiwa kutumika kwa:</p>
            <p>DukaOS is permitted for use in:</p>
            <ul>
              <li>Usimamizi wa biashara halali / Legitimate business management</li>
              <li>Rekodi za mauzo na stok / Sales and stock records</li>
              <li>Ripoti za biashara / Business reports</li>
              <li>Usimamizi wa wafanyakazi / Staff management</li>
            </ul>
            <p><strong>Hairuhusiwi:</strong> Kutumia DukaOS kwa shughuli haramu, kutoa taarifa za uongo, kujaribu kuingia akaunti za wengine, au kuvunja mfumo. / <strong>Not permitted:</strong> Using DukaOS for illegal activities, providing false information, attempting to access others' accounts, or disrupting the system.</p>
          </Section>

          <Section title="3. Akaunti na Wajibu / Account & Responsibilities">
            <p>Unawajibika kwa:</p>
            <p>You are responsible for:</p>
            <ul>
              <li>Usahihi wa taarifa unazoweka kwenye mfumo / Accuracy of information you enter into the system</li>
              <li>Usalama wa nywila na PIN / Security of passwords and PINs</li>
              <li>Shughuli zote zinazofanyika kwenye akaunti yako / All activities that occur under your account</li>
              <li>Kutoa taarifa kwetu haraka ukigundua matumizi ya bila ruhusa / Notifying us promptly if you discover unauthorized use</li>
            </ul>
          </Section>

          <Section title="4. Malipo na Usajili / Payments & Subscription">
            <p><strong>Hakuna malipo kwenye ukurasa huu.</strong> Malipo yote yanafanyika ndani ya application baada ya kujiandikisha na kuanzisha biashara yako. Malipo yanaweza kufanywa kwa njia zitakazobainishwa ndani ya mfumo.</p>
            <p><strong>No payments are made on this page.</strong> All payments are handled within the application after signing up and setting up your business. Payment methods are specified within the platform.</p>
            <ul>
              <li>Ada ya kuanzisha (setup fee) inalipwa mara moja / Setup fee is paid once</li>
              <li>Ada ya kila mwezi (monthly fee) inalipwa mapema / Monthly fee is paid in advance</li>
              <li>Toleo la majaribio linategemea mpango uliochaguliwa / Trial period depends on selected plan</li>
            </ul>
          </Section>

          <Section title="5. Upatikanaji wa Huduma / Service Availability">
            <p>Tunajaribu kuhakikisha DukaOS inapatikana 99.9% ya wakati. Hata hivyo, mara kwa mara inaweza kuwa hazipatikani kwa matengenezo au sababu za kiufundi. Hatuwajibiki kwa hasara zinazotokana na kutokupatikana kwa huduma.</p>
            <p>We strive to ensure DukaOS is available 99.9% of the time. However, it may occasionally be unavailable for maintenance or technical reasons. We are not liable for losses due to service unavailability.</p>
          </Section>

          <Section title="6. Milki ya Akili / Intellectual Property">
            <p>DukaOS, pamoja na maudhui yake yote, ni milki ya <strong>AutoRevenue Labs</strong>. Hairuhusiwi kunakili, kusambaza, kuuza, au kurekebisha mfumo bila ruhusa ya maandishi.</p>
            <p>DukaOS, including all its content, is the property of <strong>AutoRevenue Labs</strong>. Copying, distributing, selling or modifying the platform without written permission is not permitted.</p>
          </Section>

          <Section title="7. Ukomo wa Wajibu / Limitation of Liability">
            <p>AutoRevenue Labs haitawajibika kwa:</p>
            <p>AutoRevenue Labs shall not be liable for:</p>
            <ul>
              <li>Hasara za biashara zinazotokana na kutokupatikana kwa mfumo / Business losses from platform unavailability</li>
              <li>Taarifa zisizo sahihi zilizowekwa na mtumiaji / Inaccurate information entered by users</li>
              <li>Hasara zinazotokana na matumizi mabaya ya akaunti / Losses from unauthorized account use</li>
              <li>Hasara zisizo za moja kwa moja / Indirect or consequential losses</li>
            </ul>
            <p>Wajibu wetu haulazimiki kupitisha jumla ya malipo uliyolipa katika miezi 6 iliyopita. / Our maximum liability shall not exceed the total fees you paid in the preceding 6 months.</p>
          </Section>

          <Section title="8. Sera ya Kufuta / Cancellation Policy">
            <p>Unaweza kufuta usajili wako wakati wowote. Baada ya kufuta, data yako itahifadhiwa kwa siku 30 kabla ya kufutwa. Unaweza kuomba data yako kabla ya muda huo kwisha.</p>
            <p>You may cancel your subscription at any time. After cancellation, your data will be retained for 30 days before deletion. You can request your data before that period expires.</p>
          </Section>

          <Section title="9. Masasisho / Updates">
            <p>Tunaweza kubadilisha masharti haya wakati wowote. Utaratibu wao utabainishwa ndani ya mfumo au kwa barua pepe angalau siku 14 kabla ya kutekelezwa (isipokuwa mabadiliko ya kisheria yanayohitaji kutekelezwa haraka).</p>
            <p>We may update these terms at any time. Notice will be given within the platform or by email at least 14 days before implementation (unless legal changes require immediate effect).</p>
          </Section>

          <Section title="10. Sheria Inayotumika / Governing Law">
            <p>Masharti haya yanafuata sheria za <strong>Jamhuri ya Muungano wa Tanzania</strong>. Migogoro yoyote itashughulikiwa na mahakama za Tanzania.</p>
            <p>These terms are governed by the laws of the <strong>United Republic of Tanzania</strong>. Any disputes shall be handled by Tanzanian courts.</p>
          </Section>

          <Section title="11. Mawasiliano / Contact">
            <p>Kwa maswali kuhusu masharti haya:</p>
            <p>For questions about these terms:</p>
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
