import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { UserPlus, Users, X, Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { useT, useLanguageStore } from '@/shared/i18n/useLanguage'

interface StaffMember { id: string; full_name: string; active: boolean; created_at: string }

function useStaff(shopId?: string) {
  return useQuery<StaffMember[]>({
    queryKey: ['staff', shopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff').select('id, full_name, active, created_at')
        .eq('shop_id', shopId!).eq('active', true).order('full_name')
      if (error) throw error
      return data ?? []
    },
    enabled: !!shopId,
    staleTime: 5 * 60_000,
  })
}

export function StaffPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const { data: staff = [], isLoading } = useStaff(shop?.id)
  const qc = useQueryClient()
  const t = useT()
  const { lang } = useLanguageStore()

  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shop?.id) return
    if (pin.length < 4) { setError(t('pinError')); return }
    setSaving(true); setError('')

    const encoder = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(pin))
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const pin_hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    const { error: err } = await supabase.from('staff').insert({
      shop_id: shop.id, full_name: name.trim(), pin_hash,
    })
    if (err) { setError(t('addStaffError')); setSaving(false); return }
    qc.invalidateQueries({ queryKey: ['staff', shop.id] })
    setSaving(false); setShowModal(false); setName(''); setPin('')
  }

  const handleDeactivate = async (id: string, fname: string) => {
    if (!confirm(`${t('removeStaff').replace('?','')} "${fname}"?`)) return
    await supabase.from('staff').update({ active: false }).eq('id', id)
    qc.invalidateQueries({ queryKey: ['staff', shop?.id] })
  }

  return (
    <div className="pg">
      <div className="pg__header">
        <div>
          <h1 className="pg__title">{t('staffTitle')}</h1>
          <p className="pg__sub">{staff.length} {lang === 'sw' ? 'wafanyakazi wanaofanya kazi' : 'active staff members'}</p>
        </div>
        <button className="btn-add" onClick={() => { setShowModal(true); setError('') }}>
          <UserPlus size={18} />
          <span>{t('addStaff')}</span>
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 'var(--radius-l)' }} />)}
        </div>
      ) : !staff.length ? (
        <div className="empty-state" style={{ paddingTop: 64 }}>
          <Users size={40} style={{ color: 'var(--color-text-muted)' }} />
          <p>{t('noStaff')}</p>
        </div>
      ) : (
        <div className="staff-list">
          {staff.map(s => (
            <div key={s.id} className="staff-card">
              <div className="staff-card__avatar">
                {s.full_name.split(' ').map((n: string) => n[0]).slice(0,2).join('').toUpperCase()}
              </div>
              <div className="staff-card__info">
                <span className="staff-card__name">{s.full_name}</span>
                <span className="staff-card__meta">
                  {t('joinedOn')}: {new Date(s.created_at).toLocaleDateString(lang === 'sw' ? 'sw-TZ' : 'en-GB')}
                </span>
              </div>
              <span className="badge badge-success">{t('active')}</span>
              <button
                className="staff-card__remove"
                onClick={() => handleDeactivate(s.id, s.full_name)}
                aria-label={t('deactivate')}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal animate-scale-in" style={{ maxWidth: 420 }}>
            <div className="modal__header">
              <h3>{t('addStaff')}</h3>
              <button className="modal__close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleAdd} className="modal__form">
              <div className="field">
                <label className="field__label">{t('staffName')} *</label>
                <input className="field__input" value={name} onChange={e => setName(e.target.value)} required placeholder={lang === 'sw' ? 'mfano: Amina Juma' : 'e.g. Amina Juma'} />
              </div>
              <div className="field">
                <label className="field__label">{t('pin')} *</label>
                <div className="pin-input-wrap">
                  <input
                    className="field__input" type={showPin ? 'text' : 'password'}
                    value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0,6))}
                    required minLength={4} maxLength={6} placeholder={lang === 'sw' ? 'Tarakimu 4–6' : '4–6 digits'}
                    inputMode="numeric"
                  />
                  <button type="button" className="pin-toggle" onClick={() => setShowPin(v => !v)} aria-label={showPin ? t('hidePin') : t('showPin')}>
                    {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <span className="field__hint">{lang === 'sw' ? 'PIN inahifadhiwa kwa usalama.' : 'PIN is stored securely.'}</span>
              </div>
              {error && <p className="form-error">{error}</p>}
              <div className="modal__footer">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>{t('cancel')}</button>
                <button type="submit" className="btn-save" disabled={saving}>
                  {saving ? <span className="btn-spinner-sm" /> : null}
                  {t('add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .pg { display: flex; flex-direction: column; gap: var(--space-6); }
        .pg__header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3); }
        .pg__title  { font-size: 1.6rem; font-weight: 800; }
        .pg__sub    { color: var(--color-text-muted); font-size: 0.85rem; }
        .btn-add {
          display: flex; align-items: center; gap: 6px;
          padding: var(--space-3) var(--space-5); background: var(--color-primary); color: #fff;
          border-radius: var(--radius-l); font-weight: 600; font-size: 0.9rem;
          transition: all var(--transition-fast);
        }
        .btn-add:hover { background: var(--color-primary-hover); transform: translateY(-1px); }

        .staff-list { display: flex; flex-direction: column; gap: var(--space-3); }
        .staff-card {
          display: flex; align-items: center; gap: var(--space-4);
          background: var(--color-surface); border: 1px solid var(--color-border);
          border-radius: var(--radius-l); padding: var(--space-4) var(--space-5);
          box-shadow: var(--shadow-xs); transition: box-shadow var(--transition-fast);
        }
        .staff-card:hover { box-shadow: var(--shadow-md); }
        .staff-card__avatar {
          width: 44px; height: 44px; border-radius: var(--radius-full);
          background: var(--color-primary); color: #fff;
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 0.9rem; flex-shrink: 0;
          font-family: var(--font-heading);
        }
        .staff-card__info { flex: 1; min-width: 0; }
        .staff-card__name { font-weight: 700; font-size: 0.95rem; display: block; }
        .staff-card__meta { font-size: 0.75rem; color: var(--color-text-muted); }
        .staff-card__remove {
          color: var(--color-text-muted); padding: 6px; border-radius: var(--radius-s);
          transition: all var(--transition-fast);
        }
        .staff-card__remove:hover { color: var(--color-error); background: var(--color-error-bg); }

        .pin-input-wrap { position: relative; }
        .pin-input-wrap .field__input { padding-right: 44px; width: 100%; }
        .pin-toggle {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          color: var(--color-text-muted); transition: color var(--transition-fast);
        }
        .pin-toggle:hover { color: var(--color-primary); }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; padding: var(--space-4); z-index: 200; }
        .modal { background: var(--color-surface); border-radius: var(--radius-xl); width: 100%; max-width: 520px; box-shadow: var(--shadow-lg); }
        .modal__header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-5) var(--space-6); border-bottom: 1px solid var(--color-border); }
        .modal__close { color: var(--color-text-muted); padding: 4px; border-radius: var(--radius-s); transition: color var(--transition-fast); }
        .modal__close:hover { color: var(--color-text); }
        .modal__form { padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-4); }
        .modal__footer { display: flex; justify-content: flex-end; gap: var(--space-3); padding-top: var(--space-4); border-top: 1px solid var(--color-border); }

        .field { display: flex; flex-direction: column; gap: 5px; }
        .field__label { font-size: 0.85rem; font-weight: 600; }
        .field__input { padding: 10px var(--space-4); border: 1.5px solid var(--color-border); border-radius: var(--radius-m); font-size: 0.9rem; outline: none; background: var(--color-surface); color: var(--color-text); transition: border-color var(--transition-fast); }
        .field__input:focus { border-color: var(--color-primary); box-shadow: var(--shadow-focus); }
        .field__hint { font-size: 0.72rem; color: var(--color-text-muted); }
        .form-error { color: var(--color-error); background: var(--color-error-bg); padding: var(--space-3) var(--space-4); border-radius: var(--radius-m); font-size: 0.85rem; }

        .btn-cancel, .btn-save { padding: var(--space-3) var(--space-5); border-radius: var(--radius-m); font-weight: 600; font-size: 0.9rem; transition: all var(--transition-fast); display: flex; align-items: center; gap: 6px; }
        .btn-cancel { border: 1.5px solid var(--color-border); color: var(--color-text-secondary); background: var(--color-surface); }
        .btn-save { background: var(--color-primary); color: #fff; }
        .btn-save:hover:not(:disabled) { background: var(--color-primary-hover); }
        .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-spinner-sm { width: 15px; height: 15px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 700ms linear infinite; display: inline-block; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .empty-state { display: flex; flex-direction: column; align-items: center; gap: var(--space-4); color: var(--color-text-muted); text-align: center; }
      `}</style>
    </div>
  )
}
