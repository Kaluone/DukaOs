import { useState, useEffect } from 'react'
import { Store, ArrowRight } from 'lucide-react'
import { useAuth } from '@/shared/hooks/useAuth'
import { supabase } from '@/shared/lib/supabaseClient'

export function SetupPage() {
  const { user, loading: authLoading } = useAuth()
  const [form, setForm] = useState({ name: '', phone: '', address: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // If user already has a shop, go straight to dashboard
  useEffect(() => {
    if (!user) return
    supabase
      .from('shops')
      .select('id')
      .eq('owner_user_id', user.id)
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]) window.location.replace('/dashboard')
      })
  }, [user])

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#0B5C2E', borderRadius: '50%', animation: 'spin 700ms linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !form.name.trim()) return
    setSubmitting(true)
    setError('')

    try {
      const { error: err } = await supabase.from('shops').insert({
        name:          form.name.trim(),
        owner_user_id: user.id,
        phone:         form.phone.trim() || null,
        address:       form.address.trim() || null,
      })

      if (err) {
        // Duplicate key = shop already exists, navigate anyway
        if (err.code === '23505') {
          window.location.replace('/dashboard')
          return
        }
        setError(`Hitilafu: ${err.message} [${err.code}]`)
        setSubmitting(false)
        return
      }

      window.location.replace('/dashboard')
    } catch (ex: unknown) {
      setError(`Kosa: ${String(ex)}`)
      setSubmitting(false)
    }
  }

  return (
    <div className="setup-page">
      <div className="setup-card animate-scale-in">
        <div className="setup-header">
          <div className="setup-icon"><Store size={26} /></div>
          <h1>Sanidi Duka Lako</h1>
          <p>Toa maelezo mafupi ya biashara yako ili kuanza.</p>
        </div>

        <form onSubmit={handleSubmit} className="setup-form">
          <div className="field">
            <label htmlFor="name" className="field__label">Jina la Duka *</label>
            <input
              id="name"
              type="text"
              className="field__input"
              placeholder="mfano: Duka la Fatuma"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              autoFocus
              maxLength={80}
            />
          </div>

          <div className="field">
            <label htmlFor="phone" className="field__label">Nambari ya Simu</label>
            <input
              id="phone"
              type="tel"
              className="field__input"
              placeholder="+255 7XX XXX XXX"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            />
            <span className="field__hint">Itatumika kupokea arifa za WhatsApp</span>
          </div>

          <div className="field">
            <label htmlFor="address" className="field__label">Mahali (Maeneo)</label>
            <input
              id="address"
              type="text"
              className="field__input"
              placeholder="mfano: Makumbusho, Dar es Salaam"
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            />
          </div>

          {error && <p className="setup-error">{error}</p>}

          <button
            type="submit"
            className="setup-btn"
            disabled={submitting || !form.name.trim()}
          >
            {submitting
              ? <span className="btn-spinner" />
              : <><span>Anza Kutumia DukaOS</span><ArrowRight size={18} aria-hidden="true" /></>
            }
          </button>
        </form>
      </div>

      <style>{`
        .setup-page {
          min-height: 100vh;
          background: var(--color-bg);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-6);
        }
        .setup-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          padding: var(--space-10) var(--space-8);
          width: 100%;
          max-width: 440px;
          box-shadow: var(--shadow-lg);
        }
        .setup-header { text-align: center; margin-bottom: var(--space-8); }
        .setup-icon {
          width: 56px; height: 56px;
          background: var(--color-primary);
          color: #fff;
          border-radius: var(--radius-l);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto var(--space-4);
        }
        .setup-header h1 { font-size: 1.5rem; margin-bottom: var(--space-2); }
        .setup-header p  { color: var(--color-text-secondary); font-size: 0.9rem; }
        .setup-form { display: flex; flex-direction: column; gap: var(--space-5); }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field__label { font-weight: 600; font-size: 0.875rem; color: var(--color-text); }
        .field__input {
          padding: var(--space-3) var(--space-4);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-m);
          font-size: 0.95rem;
          color: var(--color-text);
          background: var(--color-surface);
          transition: border-color 150ms, box-shadow 150ms;
          outline: none;
        }
        .field__input:focus { border-color: var(--color-primary); box-shadow: var(--shadow-focus); }
        .field__hint { font-size: 0.75rem; color: var(--color-text-muted); }
        .setup-error {
          color: var(--color-error);
          background: var(--color-error-bg);
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-m);
          font-size: 0.875rem;
        }
        .setup-btn {
          display: flex; align-items: center; justify-content: center; gap: var(--space-2);
          padding: var(--space-4) var(--space-6);
          background: var(--color-primary);
          color: #fff;
          border-radius: var(--radius-l);
          font-weight: 700; font-size: 0.95rem;
          transition: all 150ms;
          margin-top: var(--space-2);
        }
        .setup-btn:hover:not(:disabled) {
          background: var(--color-primary-hover);
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }
        .setup-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-spinner {
          width: 20px; height: 20px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 700ms linear infinite;
          display: inline-block;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
