import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Store } from 'lucide-react'
import { useAuth, signInWithGoogle } from '@/shared/hooks/useAuth'
import { useT, useLanguageStore } from '@/shared/i18n/useLanguage'

export function LoginPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const t = useT()
  const { lang, toggleLang } = useLanguageStore()

  useEffect(() => {
    if (!loading && user) navigate('/dashboard')
  }, [user, loading, navigate])

  return (
    <div className="login-page">
      {/* Language toggle */}
      <button className="login-lang" onClick={toggleLang} aria-label={t('language')}>
        {lang === 'sw' ? 'EN' : 'SW'}
      </button>

      <div className="login-card animate-scale-in">
        {/* Brand */}
        <div className="login-brand">
          <div className="login-brand__icon">
            <Store size={28} />
          </div>
          <h1 className="login-brand__name">DukaOS</h1>
          <p className="login-brand__tagline">{t('tagline')}</p>
        </div>

        <div className="login-divider" />

        {/* Headline */}
        <div className="login-headline">
          <h2>{t('welcomeBack')}</h2>
          <p>{t('loginSubtitle')}</p>
        </div>

        {/* Google Sign-in */}
        <button className="google-btn" onClick={signInWithGoogle} aria-label={t('signInGoogle')}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span>{t('signInGoogle')}</span>
        </button>

        <p className="login-disclaimer">
          {t('loginDisclaimer')}{' '}
          <a href="/terms" target="_blank" rel="noopener noreferrer">{t('termsOfUse')}</a>
          {' '}{t('and')}{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer">{t('privacyPolicy')}</a>.
        </p>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          background: var(--color-bg);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-6);
          position: relative;
          overflow: hidden;
        }

        .login-lang {
          position: absolute;
          top: var(--space-5);
          right: var(--space-5);
          z-index: 10;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: var(--color-primary);
          background: var(--color-primary-light);
          border: 1.5px solid var(--color-primary);
          border-radius: var(--radius-s);
          padding: 4px 10px;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .login-lang:hover {
          background: var(--color-primary);
          color: #fff;
        }

        /* Subtle geometric background pattern */
        .login-page::before {
          content: '';
          position: absolute;
          top: -120px; right: -120px;
          width: 400px; height: 400px;
          background: var(--color-primary-light);
          border-radius: 50%;
          opacity: 0.6;
        }
        .login-page::after {
          content: '';
          position: absolute;
          bottom: -80px; left: -80px;
          width: 280px; height: 280px;
          background: var(--color-accent-light);
          border-radius: 50%;
          opacity: 0.5;
        }

        .login-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          padding: var(--space-10) var(--space-8);
          width: 100%;
          max-width: 420px;
          position: relative;
          z-index: 1;
          box-shadow: var(--shadow-lg);
        }

        .login-brand {
          text-align: center;
          margin-bottom: var(--space-6);
        }

        .login-brand__icon {
          width: 64px; height: 64px;
          background: var(--color-primary);
          color: #fff;
          border-radius: var(--radius-l);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto var(--space-3);
        }

        .login-brand__name {
          font-size: 1.75rem;
          font-weight: 800;
          color: var(--color-text);
          margin-bottom: 4px;
        }

        .login-brand__tagline {
          font-size: 0.85rem;
          color: var(--color-text-muted);
          font-style: italic;
        }

        .login-divider {
          height: 1px;
          background: var(--color-border);
          margin: 0 0 var(--space-6);
        }

        .login-headline {
          text-align: center;
          margin-bottom: var(--space-6);
        }
        .login-headline h2 {
          font-size: 1.3rem;
          margin-bottom: var(--space-2);
        }
        .login-headline p {
          font-size: 0.9rem;
          color: var(--color-text-secondary);
          line-height: 1.55;
        }

        .google-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-3);
          width: 100%;
          padding: var(--space-4) var(--space-6);
          background: var(--color-surface);
          border: 2px solid var(--color-border);
          border-radius: var(--radius-l);
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--color-text);
          transition: all var(--transition-fast);
          cursor: pointer;
          margin-bottom: var(--space-6);
        }
        .google-btn:hover {
          border-color: var(--color-primary);
          background: var(--color-primary-light);
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }
        .google-btn:active { transform: translateY(0); }

        .login-disclaimer {
          text-align: center;
          font-size: 0.75rem;
          color: var(--color-text-muted);
          line-height: 1.55;
        }
        .login-disclaimer a {
          color: var(--color-primary);
          font-weight: 500;
        }
      `}</style>
    </div>
  )
}
