import { Store } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useLanguageStore } from '@/shared/i18n/useLanguage'

const LAST_UPDATED = '18 Juni 2025 / June 18 2025'
const CONTACT_EMAIL = 'support@dukaos.app'
const APP_NAME = 'DukaOS'

export function TermsPage() {
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
            {sw ? 'Masharti ya Matumizi' : 'Terms of Use'}
          </h1>
          <p className="legal-updated">
            {sw ? 'Ilisasishwa mara ya mwisho' : 'Last updated'}: {LAST_UPDATED}
          </p>

          {/* ── 1 ── */}
          <section className="legal-section">
            <h2>{sw ? '1. Kukubaliana na Masharti' : '1. Acceptance of Terms'}</h2>
            <p>
              {sw
                ? `Kwa kutumia ${APP_NAME}, unakubali masharti haya. Ikiwa hukubaliani na masharti haya, tafadhali usitumie huduma hii. Masharti haya yanafuata sheria za Jamhuri ya Muungano wa Tanzania na inaweza kubadilishwa mara kwa mara.`
                : `By accessing or using ${APP_NAME}, you agree to be bound by these Terms of Use. If you do not agree, please do not use the service. These Terms are governed by the laws of the United Republic of Tanzania and may be updated from time to time.`}
            </p>
          </section>

          {/* ── 2 ── */}
          <section className="legal-section">
            <h2>{sw ? '2. Huduma Tunayotoa' : '2. Description of Service'}</h2>
            <p>
              {sw
                ? `${APP_NAME} ni mfumo wa SaaS wa kusimamia biashara na mauzo (POS – Point of Sale) unaokuwezesha:
                bidhaa, wafanyakazi, wateja, gharama, stok, na ripoti za biashara yako kupitia tovuti au programu.`
                : `${APP_NAME} is a cloud-based SaaS platform for business and sales management (POS – Point of Sale) enabling you to manage: products, staff, customers, expenses, stock, and business reports via web or app.`}
            </p>
          </section>

          {/* ── 3 ── */}
          <section className="legal-section">
            <h2>{sw ? '3. Akaunti ya Mtumiaji' : '3. User Account'}</h2>
            <ul>
              {sw ? <>
                <li>Lazima uwe na umri wa miaka 18 au zaidi kutumia huduma hii.</li>
                <li>Unawajibika kuhifadhi usalama wa akaunti yako na kutotoa nywila kwa mtu mwingine.</li>
                <li>Kila duka au biashara inahitaji akaunti moja ya mmiliki.</li>
                <li>Unaruhusiwa kuongeza wafanyakazi (Staff) ambao watafanya kazi chini ya akaunti yako.</li>
                <li>Taarifa unazotoa lazima ziwe za kweli na sahihi.</li>
              </> : <>
                <li>You must be at least 18 years old to use this service.</li>
                <li>You are responsible for maintaining the security of your account credentials and must not share them.</li>
                <li>Each shop or business requires one owner account.</li>
                <li>You may add Staff members who operate under your account.</li>
                <li>Information you provide must be accurate and truthful.</li>
              </>}
            </ul>
          </section>

          {/* ── 4 ── */}
          <section className="legal-section">
            <h2>{sw ? '4. Matumizi Yanayoruhusiwa' : '4. Permitted Use'}</h2>
            <p>{sw ? 'Unaweza kutumia DukaOS kwa:' : 'You may use DukaOS to:'}</p>
            <ul>
              {sw ? <>
                <li>Kusimamia biashara halali ya bidhaa au huduma.</li>
                <li>Kufanya mauzo na kuhifadhi rekodi za muamala.</li>
                <li>Kusimamia wafanyakazi na stok.</li>
                <li>Kutengeneza ripoti na tathmini za biashara yako.</li>
                <li>Kutuma arifa na risiti kwa wateja wako.</li>
              </> : <>
                <li>Managing a lawful business selling goods or services.</li>
                <li>Processing sales and maintaining transaction records.</li>
                <li>Managing staff and stock levels.</li>
                <li>Generating business reports and analytics.</li>
                <li>Sending notifications and receipts to your customers.</li>
              </>}
            </ul>
          </section>

          {/* ── 5 ── */}
          <section className="legal-section">
            <h2>{sw ? '5. Matumizi Yasiyoruhusiwa' : '5. Prohibited Use'}</h2>
            <p className="legal-warning">
              {sw
                ? 'Hukuruhusiwa kufanya yafuatayo. Ukikiuka, akaunti yako itafutwa mara moja bila fidia.'
                : 'The following are strictly prohibited. Violation will result in immediate account termination without refund.'}
            </p>
            <ul>
              {sw ? <>
                <li>Kutumia huduma kwa shughuli haramu — biashara ya dawa za kulevya, silaha, au bidhaa zilizopigwa marufuku kisheria.</li>
                <li>Kujaribu kudunga (hack) au kuvunja mfumo wa DukaOS au miundombinu yake.</li>
                <li>Kuuza upya au kuisambaza huduma hii bila ruhusa ya maandishi kutoka DukaOS.</li>
                <li>Kuingiza data ya uwongo, ya ulaghai, au ya udanganyifu.</li>
                <li>Kutumia akaunti moja kwa biashara nyingi tofauti bila ruhusa.</li>
                <li>Kujaribu kunakili, kuchimba (scrape), au kutoa data ya mtumiaji mwingine.</li>
                <li>Kusumbua au kuzuia utendaji wa kawaida wa huduma.</li>
                <li>Kubonyeza nyuma ya Mfumo wa Utoaji wa Risiti za TRA (VFD) au kufanya udanganyifu wa kodi.</li>
              </> : <>
                <li>Using the service for illegal activities — drug trade, weapons, or goods prohibited by law.</li>
                <li>Attempting to hack or breach the DukaOS system or its infrastructure.</li>
                <li>Reselling or redistributing this service without written permission from DukaOS.</li>
                <li>Entering false, fraudulent, or deceptive data.</li>
                <li>Using one account for multiple distinct businesses without authorisation.</li>
                <li>Attempting to copy, scrape, or extract another user's data.</li>
                <li>Disrupting or degrading normal service performance.</li>
                <li>Circumventing the TRA Fiscal Receipt System (VFD/EFD) or committing tax fraud.</li>
              </>}
            </ul>
          </section>

          {/* ── 6 ── */}
          <section className="legal-section">
            <h2>{sw ? '6. Data na Umiliki' : '6. Data & Ownership'}</h2>
            <p>
              {sw
                ? `Data yako ya biashara (bidhaa, mauzo, wateja, n.k.) inabaki kuwa mali yako. ${APP_NAME} haioni, haitumii, wala haiuzi data yako kwa watu wengine bila idhini yako, isipokuwa pale ambapo sheria inaitaka.`
                : `Your business data (products, sales, customers, etc.) remains your property. ${APP_NAME} does not view, use, or sell your data to third parties without your consent, except where required by law.`}
            </p>
            <p>
              {sw
                ? 'Unaweza kuomba nakala au ufutaji wa data yako wakati wowote kwa kutuma barua pepe.'
                : 'You may request a copy or deletion of your data at any time by emailing us.'}
            </p>
          </section>

          {/* ── 7 ── */}
          <section className="legal-section">
            <h2>{sw ? '7. Malipo na Usajili' : '7. Payment & Subscription'}</h2>
            <p>
              {sw
                ? `Toleo la majaribio (trial) linapatikana bila malipo. Toleo la kawaida linahitaji malipo ya kila mwezi au mwaka. Bei zinaonekana ndani ya programu. Malipo yaliyofanywa hayarudishwi isipokuwa kwa sababu ya hitilafu ya kiufundi kutoka upande wetu.`
                : `A free trial is available at no cost. A paid subscription is required for continued use. Prices are shown within the app. Payments are non-refundable except in cases of technical error on our side.`}
            </p>
          </section>

          {/* ── 8 ── */}
          <section className="legal-section">
            <h2>{sw ? '8. Kusimamishwa au Kufutwa kwa Akaunti' : '8. Suspension or Termination'}</h2>
            <p>
              {sw
                ? `${APP_NAME} inaweza kusimamisha au kufuta akaunti yako bila notisi ya mapema ikiwa: unakiuka masharti haya, hujalipia huduma, au mtumiaji anafanya shughuli haramu. Unaweza pia kufuta akaunti yako mwenyewe wakati wowote kupitia mipangilio.`
                : `${APP_NAME} may suspend or terminate your account without prior notice if: you violate these Terms, your payment lapses, or you engage in illegal activities. You may also delete your own account at any time via Settings.`}
            </p>
          </section>

          {/* ── 9 ── */}
          <section className="legal-section">
            <h2>{sw ? '9. Mipaka ya Wajibu' : '9. Limitation of Liability'}</h2>
            <p>
              {sw
                ? `${APP_NAME} haitawajibika kwa hasara yoyote ya moja kwa moja au isiyo ya moja kwa moja inayotokana na: matatizo ya mtandao, data iliyopotea kwa sababu nje ya uwezo wetu, au maamuzi ya biashara yaliyofanywa kwa msingi wa taarifa zilizotolewa na mfumo.`
                : `${APP_NAME} shall not be liable for any direct or indirect losses arising from: network outages, data loss due to causes beyond our control, or business decisions made based on information provided by the system.`}
            </p>
          </section>

          {/* ── 10 ── */}
          <section className="legal-section">
            <h2>{sw ? '10. Mabadiliko ya Masharti' : '10. Changes to Terms'}</h2>
            <p>
              {sw
                ? `Tunaweza kubadilisha masharti haya wakati wowote. Mabadiliko makubwa yatatangazwa ndani ya programu siku 14 kabla ya kuanza kutumika. Matumizi yako yanayoendelea baada ya mabadiliko yanachukuliwa kuwa kukubaliana na masharti mapya.`
                : `We may update these Terms at any time. Material changes will be notified within the app at least 14 days before taking effect. Continued use after changes constitutes acceptance of the new Terms.`}
            </p>
          </section>

          {/* ── 11 ── */}
          <section className="legal-section">
            <h2>{sw ? '11. Wasiliana Nasi' : '11. Contact Us'}</h2>
            <p>
              {sw
                ? `Kwa maswali yoyote kuhusu masharti haya, tafadhali wasiliana nasi:`
                : `For any questions regarding these Terms, please contact us:`}
            </p>
            <div className="legal-contact">
              <p><strong>{APP_NAME}</strong></p>
              <p>📧 <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
              <p>🌍 Tanzania, East Africa</p>
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
        .legal-section p {
          font-size: 0.9rem; line-height: 1.7;
          color: var(--color-text-secondary); margin-bottom: var(--space-3);
          white-space: pre-line;
        }
        .legal-section ul {
          margin: var(--space-3) 0 var(--space-3) var(--space-5);
          display: flex; flex-direction: column; gap: var(--space-2);
        }
        .legal-section li {
          font-size: 0.9rem; line-height: 1.65;
          color: var(--color-text-secondary);
        }
        .legal-section li::marker { color: var(--color-primary); }

        .legal-warning {
          background: var(--color-error-bg); border-left: 3px solid var(--color-error);
          padding: var(--space-3) var(--space-4) !important;
          border-radius: 0 var(--radius-m) var(--radius-m) 0;
          color: var(--color-error) !important;
          font-weight: 600 !important;
        }

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
