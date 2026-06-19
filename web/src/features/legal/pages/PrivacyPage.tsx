import { Store } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useLanguageStore } from '@/shared/i18n/useLanguage'

const LAST_UPDATED = '18 Juni 2025 / June 18 2025'
const CONTACT_EMAIL = 'support@dukaos.app'
const APP_NAME = 'DukaOS'

export function PrivacyPage() {
  const { lang, toggleLang } = useLanguageStore()
  const sw = lang === 'sw'

  return (
    <div className="legal-page">
      {/* Top bar */}
      <header className="legal-header">
        <Link to="/login" className="legal-logo">
          <div className="legal-logo__icon"><Store size={18} /></div>
          <span>{APP_NAME}</span>
        </Link>
        <button className="legal-lang" onClick={toggleLang}>
          {sw ? 'EN' : 'SW'}
        </button>
      </header>

      <main className="legal-body">
        <div className="legal-card">
          <h1 className="legal-title">
            {sw ? 'Sera ya Faragha' : 'Privacy Policy'}
          </h1>
          <p className="legal-updated">
            {sw ? 'Ilisasishwa mara ya mwisho' : 'Last updated'}: {LAST_UPDATED}
          </p>

          {/* ── Intro ── */}
          <section className="legal-section">
            <p>
              {sw
                ? `${APP_NAME} inathamini faragha yako. Sera hii inaeleza ni data gani tunakusanya, jinsi tunavyoitumia, na haki zako. Kwa kutumia huduma yetu, unakubali mazoea yaliyoelezwa hapa.`
                : `${APP_NAME} respects your privacy. This Policy explains what data we collect, how we use it, and your rights. By using our service, you agree to the practices described here.`}
            </p>
          </section>

          {/* ── 1 ── */}
          <section className="legal-section">
            <h2>{sw ? '1. Data Tunayokusanya' : '1. Data We Collect'}</h2>

            <h3>{sw ? 'a) Data Unayotupa Mwenyewe' : 'a) Data You Provide Directly'}</h3>
            <ul>
              {sw ? <>
                <li><strong>Taarifa za akaunti:</strong> jina, anwani ya barua pepe (kupitia Google Sign-In).</li>
                <li><strong>Taarifa za duka:</strong> jina la duka, nambari ya simu, aina ya biashara.</li>
                <li><strong>Data ya biashara:</strong> bidhaa, bei, stok, wafanyakazi, wateja, gharama, na miamala ya mauzo.</li>
              </> : <>
                <li><strong>Account information:</strong> name and email address (via Google Sign-In).</li>
                <li><strong>Shop information:</strong> shop name, phone number, business type.</li>
                <li><strong>Business data:</strong> products, prices, stock levels, staff, customers, expenses, and sales transactions.</li>
              </>}
            </ul>

            <h3>{sw ? 'b) Data Inayokusanywa Kiotomatiki' : 'b) Automatically Collected Data'}</h3>
            <ul>
              {sw ? <>
                <li><strong>Taarifa za kifaa:</strong> aina ya kivinjari, mfumo wa uendeshaji, anwani ya IP.</li>
                <li><strong>Rekodi za matumizi:</strong> kurasa ulizozitembelea, wakati wa kuingia, na makosa ya mfumo.</li>
              </> : <>
                <li><strong>Device information:</strong> browser type, operating system, IP address.</li>
                <li><strong>Usage logs:</strong> pages visited, login timestamps, and system errors.</li>
              </>}
            </ul>

            <h3>{sw ? 'c) Data Tusiyokusanya' : 'c) Data We Do NOT Collect'}</h3>
            <ul>
              {sw ? <>
                <li>Nywila za akaunti yako ya Google — hutupiti kwetu.</li>
                <li>Taarifa za kadi ya benki au mpesa moja kwa moja — malipo yanashughulikiwa na watoa huduma wa nje.</li>
                <li>Picha za kibinafsi au sauti — hatukusanyi hata.</li>
              </> : <>
                <li>Your Google account password — it never passes through our systems.</li>
                <li>Bank card or mobile money details directly — payments are processed by external providers.</li>
                <li>Personal photos or voice recordings — we do not collect these.</li>
              </>}
            </ul>
          </section>

          {/* ── 2 ── */}
          <section className="legal-section">
            <h2>{sw ? '2. Jinsi Tunavyotumia Data Yako' : '2. How We Use Your Data'}</h2>
            <ul>
              {sw ? <>
                <li>Kutoa, kudumisha, na kuboresha huduma za {APP_NAME}.</li>
                <li>Kutuma arifa muhimu kuhusu akaunti yako, mabadiliko ya masharti, au usumbufu wa huduma.</li>
                <li>Kugundua na kuzuia udanganyifu, matumizi mabaya, na usalama wa data.</li>
                <li>Kutatua matatizo ya kiufundi na kuboresha utendaji wa mfumo.</li>
                <li>Kutimiza mahitaji ya kisheria au maagizo ya mahakama.</li>
              </> : <>
                <li>Providing, maintaining, and improving {APP_NAME} services.</li>
                <li>Sending important notifications about your account, Terms changes, or service interruptions.</li>
                <li>Detecting and preventing fraud, abuse, and data security incidents.</li>
                <li>Diagnosing technical problems and improving system performance.</li>
                <li>Complying with legal requirements or court orders.</li>
              </>}
            </ul>
          </section>

          {/* ── 3 ── */}
          <section className="legal-section">
            <h2>{sw ? '3. Ushirikiano na Watu wa Tatu' : '3. Third-Party Services'}</h2>
            <p>
              {sw
                ? 'Tunatumia watoa huduma wa kuaminika wafuatao ili kuendesha DukaOS. Kila mmoja wao ana sera yake ya faragha:'
                : 'We rely on the following trusted third-party providers to operate DukaOS. Each has its own Privacy Policy:'}
            </p>
            <div className="legal-table-wrap">
              <table className="legal-table">
                <thead>
                  <tr>
                    <th>{sw ? 'Mtoa Huduma' : 'Provider'}</th>
                    <th>{sw ? 'Kusudi' : 'Purpose'}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Supabase</strong></td>
                    <td>{sw ? 'Hifadhi ya data, uthibitishaji, na hifadhidata' : 'Database, authentication, and storage'}</td>
                  </tr>
                  <tr>
                    <td><strong>Google (OAuth)</strong></td>
                    <td>{sw ? 'Kuingia kwa akaunti bila nywila' : 'Passwordless account sign-in'}</td>
                  </tr>
                  <tr>
                    <td><strong>Vercel / Hosting</strong></td>
                    <td>{sw ? 'Kupeleka na kuhifadhi programu' : 'App deployment and serving'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              {sw
                ? 'Hatuuzi, hakikisha, wala kubadilishana data yako na mtu mwingine kwa madhumuni ya masoko.'
                : 'We do not sell, rent, or exchange your data with any party for marketing purposes.'}
            </p>
          </section>

          {/* ── 4 ── */}
          <section className="legal-section">
            <h2>{sw ? '4. Usalama wa Data' : '4. Data Security'}</h2>
            <ul>
              {sw ? <>
                <li>Data yote inasafirishwa kupitia HTTPS (TLS 1.2+).</li>
                <li>Hifadhidata inalindwa na Row Level Security (RLS) — kila duka linaona data yake tu.</li>
                <li>Nywila za wafanyakazi (PIN) zinahifadhiwa kama hash ya SHA-256 — hatuzihifadhi wazi.</li>
                <li>Nakala za akiba (backups) zinafanywa kila siku na Supabase.</li>
                <li>Licha ya juhudi zetu, hakuna mfumo wa mtandao unaoweza kuhakikishiwa usalama kamili.</li>
              </> : <>
                <li>All data is transmitted over HTTPS (TLS 1.2+).</li>
                <li>The database is protected by Row Level Security (RLS) — each shop can only see its own data.</li>
                <li>Staff PINs are stored as SHA-256 hashes — we never store them in plaintext.</li>
                <li>Daily backups are performed by Supabase.</li>
                <li>Despite our efforts, no internet-based system can guarantee absolute security.</li>
              </>}
            </ul>
          </section>

          {/* ── 5 ── */}
          <section className="legal-section">
            <h2>{sw ? '5. Uhifadhi wa Data' : '5. Data Retention'}</h2>
            <p>
              {sw
                ? `Data yako ya biashara inahifadhiwa maadamu akaunti yako iko hai. Ukifuta akaunti, data yako itafutwa ndani ya siku 30. Baadhi ya rekodi zinaweza kuhifadhiwa kwa muda mrefu zaidi ikiwa sheria ya Tanzania inaitaka (mfano: rekodi za kodi).`
                : `Your business data is retained as long as your account remains active. Upon account deletion, your data will be permanently deleted within 30 days. Some records may be retained longer if required by Tanzanian law (e.g. tax records).`}
            </p>
          </section>

          {/* ── 6 ── */}
          <section className="legal-section">
            <h2>{sw ? '6. Haki Zako' : '6. Your Rights'}</h2>
            <p>{sw ? 'Una haki zifuatazo kuhusu data yako:' : 'You have the following rights regarding your data:'}</p>
            <ul>
              {sw ? <>
                <li><strong>Haki ya Kufikia:</strong> Unaweza kuomba nakala ya data yako yote tuliyohifadhi.</li>
                <li><strong>Haki ya Kusahihisha:</strong> Unaweza kusahihisha data yoyote isiyo sahihi.</li>
                <li><strong>Haki ya Kufuta:</strong> Unaweza kuomba tufute data yako (isipokuwa ile inayohitajika kisheria).</li>
                <li><strong>Haki ya Kubeba Data:</strong> Unaweza kuomba data yako katika umbizo linaloweza kusomwa na mashine (CSV/JSON).</li>
                <li><strong>Haki ya Kupinga:</strong> Unaweza kupinga matumizi fulani ya data yako.</li>
              </> : <>
                <li><strong>Right to Access:</strong> You may request a copy of all data we hold about you.</li>
                <li><strong>Right to Rectification:</strong> You may correct any inaccurate data.</li>
                <li><strong>Right to Erasure:</strong> You may request deletion of your data (except legally required records).</li>
                <li><strong>Right to Portability:</strong> You may request your data in a machine-readable format (CSV/JSON).</li>
                <li><strong>Right to Object:</strong> You may object to certain uses of your data.</li>
              </>}
            </ul>
            <p>
              {sw
                ? `Kutumia haki hizi, tuma barua pepe kwenda: `
                : `To exercise these rights, email us at: `}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </p>
          </section>

          {/* ── 7 ── */}
          <section className="legal-section">
            <h2>{sw ? '7. Watoto' : '7. Children'}</h2>
            <p>
              {sw
                ? `Huduma hii haikusudiwi kwa watoto wenye umri wa chini ya miaka 18. Hatukusanyi kwa makusudi data ya mtoto yeyote. Ikiwa utaona kwamba mtoto ametupa data, tafadhali wasiliana nasi ili tufute.`
                : `This service is not intended for children under the age of 18. We do not knowingly collect data from any child. If you believe a child has provided us with data, please contact us to have it removed.`}
            </p>
          </section>

          {/* ── 8 ── */}
          <section className="legal-section">
            <h2>{sw ? '8. Mabadiliko ya Sera Hii' : '8. Changes to This Policy'}</h2>
            <p>
              {sw
                ? `Tunaweza kusasisha Sera hii ya Faragha mara kwa mara. Mabadiliko makubwa yatatangazwa ndani ya programu au kwa barua pepe siku 14 kabla ya kuanza kutumika. Tarehe ya "Ilisasishwa mara ya mwisho" juu itabadilishwa kila wakati.`
                : `We may update this Privacy Policy periodically. Material changes will be announced within the app or by email at least 14 days before taking effect. The "Last updated" date at the top will always reflect the current version.`}
            </p>
          </section>

          {/* ── 9 ── */}
          <section className="legal-section">
            <h2>{sw ? '9. Wasiliana Nasi' : '9. Contact Us'}</h2>
            <p>
              {sw
                ? 'Kwa maswali, wasiwasi, au maombi kuhusu faragha yako:'
                : 'For questions, concerns, or privacy requests:'}
            </p>
            <div className="legal-contact">
              <p><strong>{APP_NAME} — {sw ? 'Timu ya Faragha' : 'Privacy Team'}</strong></p>
              <p>📧 <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
              <p>🌍 Tanzania, East Africa</p>
              <p style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                {sw
                  ? 'Tutajibu ndani ya siku 7 za kazi.'
                  : 'We will respond within 7 business days.'}
              </p>
            </div>
          </section>

          <div className="legal-back">
            <Link to="/login">← {sw ? 'Rudi kwenye Ingia' : 'Back to Sign In'}</Link>
          </div>
        </div>
      </main>

      <style>{`
        .legal-page { min-height: 100vh; background: var(--color-bg); }

        .legal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: var(--space-4) var(--space-6);
          background: var(--color-surface); border-bottom: 1px solid var(--color-border);
          position: sticky; top: 0; z-index: 10;
        }
        .legal-logo {
          display: flex; align-items: center; gap: var(--space-2);
          font-weight: 800; font-size: 1rem; color: var(--color-text);
          text-decoration: none;
        }
        .legal-logo__icon {
          width: 32px; height: 32px; background: var(--color-primary); color: #fff;
          border-radius: var(--radius-s); display: flex; align-items: center; justify-content: center;
        }
        .legal-lang {
          font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em;
          color: var(--color-primary); background: var(--color-primary-light);
          border: 1.5px solid var(--color-primary); border-radius: var(--radius-s);
          padding: 3px 10px; cursor: pointer; transition: all var(--transition-fast);
        }
        .legal-lang:hover { background: var(--color-primary); color: #fff; }

        .legal-body {
          max-width: 780px; margin: 0 auto;
          padding: var(--space-8) var(--space-6);
        }
        .legal-card {
          background: var(--color-surface); border: 1px solid var(--color-border);
          border-radius: var(--radius-xl); padding: var(--space-10) var(--space-8);
          box-shadow: var(--shadow-sm);
        }
        @media (max-width: 640px) {
          .legal-body { padding: var(--space-4); }
          .legal-card { padding: var(--space-6) var(--space-4); }
        }

        .legal-title {
          font-size: 1.9rem; font-weight: 800;
          color: var(--color-text); margin-bottom: var(--space-2);
          font-family: var(--font-heading);
        }
        .legal-updated {
          font-size: 0.78rem; color: var(--color-text-muted);
          margin-bottom: var(--space-8);
          padding-bottom: var(--space-4);
          border-bottom: 1px solid var(--color-border);
        }

        .legal-section { margin-bottom: var(--space-7); }
        .legal-section h2 {
          font-size: 1.05rem; font-weight: 700;
          color: var(--color-primary); margin-bottom: var(--space-3);
          padding-bottom: var(--space-1);
          border-bottom: 2px solid var(--color-primary-light);
        }
        .legal-section h3 {
          font-size: 0.9rem; font-weight: 700; color: var(--color-text);
          margin: var(--space-4) 0 var(--space-2);
        }
        .legal-section p {
          font-size: 0.9rem; line-height: 1.7;
          color: var(--color-text-secondary); margin-bottom: var(--space-3);
        }
        .legal-section a { color: var(--color-primary); }
        .legal-section ul {
          margin: var(--space-2) 0 var(--space-3) var(--space-5);
          display: flex; flex-direction: column; gap: var(--space-2);
        }
        .legal-section li {
          font-size: 0.9rem; line-height: 1.65;
          color: var(--color-text-secondary);
        }
        .legal-section li::marker { color: var(--color-primary); }

        .legal-table-wrap { overflow-x: auto; margin: var(--space-3) 0; }
        .legal-table {
          width: 100%; border-collapse: collapse;
          font-size: 0.875rem;
        }
        .legal-table th {
          background: var(--color-surface-2); text-align: left;
          padding: var(--space-3) var(--space-4); font-weight: 700;
          border-bottom: 2px solid var(--color-border); color: var(--color-text);
        }
        .legal-table td {
          padding: var(--space-3) var(--space-4);
          border-bottom: 1px solid var(--color-border);
          color: var(--color-text-secondary); vertical-align: top;
        }
        .legal-table tr:last-child td { border-bottom: none; }

        .legal-contact {
          background: var(--color-surface-2); border: 1px solid var(--color-border);
          border-radius: var(--radius-l); padding: var(--space-4) var(--space-5);
          margin-top: var(--space-3);
        }
        .legal-contact p { font-size: 0.875rem; color: var(--color-text-secondary); margin-bottom: 4px !important; }
        .legal-contact a { color: var(--color-primary); }

        .legal-back {
          margin-top: var(--space-8); padding-top: var(--space-4);
          border-top: 1px solid var(--color-border);
        }
        .legal-back a {
          font-size: 0.875rem; color: var(--color-primary); font-weight: 500;
          text-decoration: none;
        }
        .legal-back a:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}
