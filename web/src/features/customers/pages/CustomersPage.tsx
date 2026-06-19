import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { UserPlus, Search, X, UserCheck, Phone, Mail, MapPin, CreditCard } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { format } from 'date-fns'
import { useT } from '@/shared/i18n/useLanguage'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  loyalty_points: number
  credit_balance: number
  active: boolean
  created_at: string
}

const fmt = (n: number) =>
  new Intl.NumberFormat('sw-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(n)

// ─── Hook ─────────────────────────────────────────────────────────────────────
function useCustomers(shopId?: string) {
  return useQuery<Customer[]>({
    queryKey: ['customers', shopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id,name,phone,email,address,notes,loyalty_points,credit_balance,active,created_at')
        .eq('shop_id', shopId!)
        .eq('active', true)
        .order('name')
      if (error) throw error
      return data ?? []
    },
    enabled: !!shopId,
    staleTime: 5 * 60_000,
  })
}

// ─── Empty form ───────────────────────────────────────────────────────────────
const emptyForm = { name: '', phone: '', email: '', address: '', notes: '' }

// ─── Page ─────────────────────────────────────────────────────────────────────
export function CustomersPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const qc = useQueryClient()
  const t = useT()
  const { data: customers = [], isLoading } = useCustomers(shop?.id)

  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Customer | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null)

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase()
    if (!q) return true
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone?.includes(q) ?? false) ||
      (c.email?.toLowerCase().includes(q) ?? false)
    )
  })

  const totalCredit = customers.reduce((s, c) => s + c.credit_balance, 0)

  const openAdd = () => {
    setEditTarget(null)
    setForm(emptyForm)
    setFormError('')
    setShowModal(true)
  }

  const openEdit = (c: Customer) => {
    setEditTarget(c)
    setForm({
      name: c.name,
      phone: c.phone ?? '',
      email: c.email ?? '',
      address: c.address ?? '',
      notes: c.notes ?? '',
    })
    setFormError('')
    setShowModal(true)
  }

  const handleSave = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!shop?.id || !form.name.trim()) return
    setSaving(true); setFormError('')
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    }
    const { error } = editTarget
      ? await supabase.from('customers').update(payload).eq('id', editTarget.id)
      : await supabase.from('customers').insert({ shop_id: shop.id, ...payload })

    if (error) { setFormError('Hitilafu: ' + error.message); setSaving(false); return }
    qc.invalidateQueries({ queryKey: ['customers', shop.id] })
    setSaving(false); setShowModal(false)
  }

  const handleDeactivate = async (c: Customer) => {
    if (!confirm(`${t('deactivateCustomer')} "${c.name}"?`)) return
    await supabase.from('customers').update({ active: false }).eq('id', c.id)
    qc.invalidateQueries({ queryKey: ['customers', shop?.id] })
    if (detailCustomer?.id === c.id) setDetailCustomer(null)
  }

  return (
    <div className="pg">
      {/* Header */}
      <div className="pg__header">
        <div>
          <h1 className="pg__title">{t('customersTitle')}</h1>
          <p className="pg__sub">
            {customers.length} {t('customersTitle').toLowerCase()}
            {totalCredit > 0 && (
              <span className="pg__credit"> · {t('totalCredit')}: {fmt(totalCredit)}</span>
            )}
          </p>
        </div>
        <button className="btn-add" onClick={openAdd}>
          <UserPlus size={18} /> <span>{t('addCustomer')}</span>
        </button>
      </div>

      {/* Search */}
      <div className="pg__search-bar">
        <Search size={16} className="pg__search-icon" />
        <input
          type="search"
          className="pg__search-input"
          placeholder={t('search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button className="pg__search-clear" onClick={() => setSearch('')}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Credit summary banner */}
      {totalCredit > 0 && (
        <div className="credit-banner">
          <CreditCard size={18} />
          <span>{t('totalCredit')}: <strong>{fmt(totalCredit)}</strong></span>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3,4].map((i) => (
            <div key={i} className="skeleton" style={{ height: 76, borderRadius: 'var(--radius-l)' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <UserCheck size={42} style={{ color: 'var(--color-text-muted)' }} />
          <p>{search ? `${t('noCustomers')}: "${search}"` : t('noCustomers')}</p>
        </div>
      ) : (
        <div className="cust-list">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="cust-card"
              onClick={() => setDetailCustomer(detailCustomer?.id === c.id ? null : c)}
            >
              <div className="cust-card__avatar">
                {c.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div className="cust-card__info">
                <span className="cust-card__name">{c.name}</span>
                {c.phone && (
                  <span className="cust-card__meta">
                    <Phone size={11} /> {c.phone}
                  </span>
                )}
              </div>
              {c.credit_balance > 0 && (
                <span className="badge badge-warning">{fmt(c.credit_balance)}</span>
              )}
              {c.loyalty_points > 0 && (
                <span className="badge badge-info">⭐ {c.loyalty_points}</span>
              )}
              <button
                className="cust-card__edit"
                onClick={(e) => { e.stopPropagation(); openEdit(c) }}
                title="Hariri"
              >
                ✏️
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Customer detail panel */}
      {detailCustomer && (
        <div className="cust-detail animate-scale-in">
          <div className="cust-detail__head">
            <div className="cust-detail__avatar">
              {detailCustomer.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div>
              <h3>{detailCustomer.name}</h3>
              <span className="cust-detail__since">
                {t('customerSince')} {format(new Date(detailCustomer.created_at), 'MMM yyyy')}
              </span>
            </div>
            <button className="cust-detail__close" onClick={() => setDetailCustomer(null)}>
              <X size={16} />
            </button>
          </div>
          <div className="cust-detail__body">
            {detailCustomer.phone && (
              <div className="cust-detail__row">
                <Phone size={14} />
                <span>{detailCustomer.phone}</span>
              </div>
            )}
            {detailCustomer.email && (
              <div className="cust-detail__row">
                <Mail size={14} />
                <span>{detailCustomer.email}</span>
              </div>
            )}
            {detailCustomer.address && (
              <div className="cust-detail__row">
                <MapPin size={14} />
                <span>{detailCustomer.address}</span>
              </div>
            )}
            <div className="cust-detail__stats">
              <div className="cust-stat">
                <span className="cust-stat__label">{t('creditBalance')}</span>
                <span className={`cust-stat__val ${detailCustomer.credit_balance > 0 ? 'cust-stat__val--warn' : ''}`}>
                  {fmt(detailCustomer.credit_balance)}
                </span>
              </div>
              <div className="cust-stat">
                <span className="cust-stat__label">{t('loyaltyPoints')}</span>
                <span className="cust-stat__val">⭐ {detailCustomer.loyalty_points}</span>
              </div>
            </div>
            {detailCustomer.notes && (
              <p className="cust-detail__notes">{detailCustomer.notes}</p>
            )}
          </div>
          <div className="cust-detail__foot">
            <button className="cust-detail__edit-btn" onClick={() => { openEdit(detailCustomer); setDetailCustomer(null) }}>
              {t('edit')}
            </button>
            <button className="cust-detail__del-btn" onClick={() => handleDeactivate(detailCustomer)}>
              {t('deactivate')}
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal animate-scale-in" style={{ maxWidth: 480 }}>
            <div className="modal__header">
              <h3>{editTarget ? t('editCustomer') : t('addNewCustomer')}</h3>
              <button className="modal__close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="modal__form">
              <div className="field">
                <label className="field__label">{t('name')} *</label>
                <input
                  className="field__input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required placeholder="Amina Hassan"
                  autoFocus
                />
              </div>
              <div className="field-row">
                <div className="field">
                  <label className="field__label">{t('phone')}</label>
                  <input
                    className="field__input"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="0712 345 678"
                  />
                </div>
                <div className="field">
                  <label className="field__label">{t('email')}</label>
                  <input
                    className="field__input"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="amina@email.com"
                  />
                </div>
              </div>
              <div className="field">
                <label className="field__label">{t('address')}</label>
                <input
                  className="field__input"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Kariakoo, Dar es Salaam"
                />
              </div>
              <div className="field">
                <label className="field__label">{t('notes')}</label>
                <input
                  className="field__input"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder={t('description')}
                />
              </div>
              {formError && <p className="form-error">{formError}</p>}
              <div className="modal__footer">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>{t('cancel')}</button>
                <button type="submit" className="btn-save" disabled={saving || !form.name.trim()}>
                  {saving ? <span className="btn-spinner-sm" /> : null}
                  {editTarget ? t('save') : t('add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .pg { display:flex; flex-direction:column; gap:var(--space-5); }
        .pg__header { display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:var(--space-3); }
        .pg__title { font-size:1.6rem; font-weight:800; }
        .pg__sub { color:var(--color-text-muted); font-size:0.85rem; }
        .pg__credit { color:var(--color-warning); font-weight:600; }
        .btn-add { display:flex; align-items:center; gap:6px; padding:var(--space-3) var(--space-5); background:var(--color-primary); color:#fff; border-radius:var(--radius-l); font-weight:600; font-size:0.9rem; transition:all var(--transition-fast); }
        .btn-add:hover { background:var(--color-primary-hover); transform:translateY(-1px); }

        .pg__search-bar { display:flex; align-items:center; gap:var(--space-2); background:var(--color-surface); border:1.5px solid var(--color-border); border-radius:var(--radius-l); padding:0 var(--space-4); transition:border-color var(--transition-fast); }
        .pg__search-bar:focus-within { border-color:var(--color-primary); }
        .pg__search-icon { color:var(--color-text-muted); flex-shrink:0; }
        .pg__search-input { flex:1; padding:var(--space-3) 0; border:none; background:none; outline:none; font-size:0.875rem; color:var(--color-text); }
        .pg__search-clear { color:var(--color-text-muted); padding:4px; }

        .credit-banner { display:flex; align-items:center; gap:var(--space-3); padding:var(--space-3) var(--space-4); background:var(--color-warning-bg); border:1px solid var(--color-warning); border-radius:var(--radius-l); font-size:0.85rem; color:var(--color-warning); }

        .cust-list { display:flex; flex-direction:column; gap:var(--space-2); }
        .cust-card { display:flex; align-items:center; gap:var(--space-4); background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-l); padding:var(--space-3) var(--space-4); box-shadow:var(--shadow-xs); transition:box-shadow var(--transition-fast); cursor:pointer; }
        .cust-card:hover { box-shadow:var(--shadow-md); }
        .cust-card__avatar { width:42px; height:42px; border-radius:var(--radius-full); background:var(--color-primary); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.85rem; flex-shrink:0; font-family:var(--font-heading); }
        .cust-card__info { flex:1; min-width:0; }
        .cust-card__name { font-weight:700; font-size:0.9rem; display:block; }
        .cust-card__meta { font-size:0.73rem; color:var(--color-text-muted); display:flex; align-items:center; gap:3px; }
        .cust-card__edit { color:var(--color-text-muted); padding:5px; border-radius:var(--radius-s); font-size:0.8rem; transition:all var(--transition-fast); }
        .cust-card__edit:hover { background:var(--color-primary-light); }

        .badge { display:inline-flex; align-items:center; gap:4px; padding:2px 10px; border-radius:var(--radius-full); font-size:0.72rem; font-weight:600; }
        .badge-warning { background:var(--color-warning-bg); color:var(--color-warning); }
        .badge-info { background:var(--color-info-bg); color:var(--color-info); }

        .cust-detail { background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-xl); box-shadow:var(--shadow-lg); overflow:hidden; }
        .cust-detail__head { display:flex; align-items:center; gap:var(--space-4); padding:var(--space-5); border-bottom:1px solid var(--color-border); }
        .cust-detail__avatar { width:52px; height:52px; border-radius:var(--radius-full); background:var(--color-primary); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:1rem; flex-shrink:0; font-family:var(--font-heading); }
        .cust-detail__head h3 { font-size:1.1rem; flex:1; }
        .cust-detail__since { font-size:0.75rem; color:var(--color-text-muted); }
        .cust-detail__close { color:var(--color-text-muted); padding:5px; border-radius:var(--radius-s); }
        .cust-detail__body { padding:var(--space-5); display:flex; flex-direction:column; gap:var(--space-3); }
        .cust-detail__row { display:flex; align-items:center; gap:var(--space-2); font-size:0.875rem; color:var(--color-text-secondary); }
        .cust-detail__stats { display:flex; gap:var(--space-4); }
        .cust-stat { display:flex; flex-direction:column; gap:2px; }
        .cust-stat__label { font-size:0.72rem; color:var(--color-text-muted); font-weight:500; }
        .cust-stat__val { font-size:1rem; font-weight:800; font-family:var(--font-heading); }
        .cust-stat__val--warn { color:var(--color-warning); }
        .cust-detail__notes { font-size:0.82rem; color:var(--color-text-muted); font-style:italic; background:var(--color-surface-2); padding:var(--space-3); border-radius:var(--radius-m); }
        .cust-detail__foot { display:flex; gap:var(--space-3); padding:var(--space-4) var(--space-5); border-top:1px solid var(--color-border); }
        .cust-detail__edit-btn { padding:var(--space-2) var(--space-5); background:var(--color-primary); color:#fff; border-radius:var(--radius-m); font-weight:600; font-size:0.85rem; }
        .cust-detail__del-btn { padding:var(--space-2) var(--space-5); border:1.5px solid var(--color-border); border-radius:var(--radius-m); font-weight:600; font-size:0.85rem; color:var(--color-text-muted); }
        .cust-detail__del-btn:hover { border-color:var(--color-error); color:var(--color-error); background:var(--color-error-bg); }

        .empty-state { display:flex; flex-direction:column; align-items:center; gap:var(--space-4); color:var(--color-text-muted); padding-top:64px; }
        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.5); display:flex; align-items:center; justify-content:center; padding:var(--space-4); z-index:200; }
        .modal { background:var(--color-surface); border-radius:var(--radius-xl); width:100%; max-width:520px; box-shadow:var(--shadow-lg); }
        .modal__header { display:flex; align-items:center; justify-content:space-between; padding:var(--space-5) var(--space-6); border-bottom:1px solid var(--color-border); }
        .modal__close { color:var(--color-text-muted); padding:4px; border-radius:var(--radius-s); }
        .modal__close:hover { color:var(--color-text); }
        .modal__form { padding:var(--space-6); display:flex; flex-direction:column; gap:var(--space-4); }
        .modal__footer { display:flex; justify-content:flex-end; gap:var(--space-3); padding-top:var(--space-4); border-top:1px solid var(--color-border); }
        .field { display:flex; flex-direction:column; gap:5px; }
        .field-row { display:grid; grid-template-columns:1fr 1fr; gap:var(--space-4); }
        @media (max-width:480px) { .field-row { grid-template-columns:1fr; } }
        .field__label { font-size:0.85rem; font-weight:600; }
        .field__input { padding:10px var(--space-4); border:1.5px solid var(--color-border); border-radius:var(--radius-m); font-size:0.9rem; outline:none; background:var(--color-surface); color:var(--color-text); transition:border-color var(--transition-fast); }
        .field__input:focus { border-color:var(--color-primary); box-shadow:var(--shadow-focus); }
        .form-error { color:var(--color-error); background:var(--color-error-bg); padding:var(--space-3) var(--space-4); border-radius:var(--radius-m); font-size:0.85rem; }
        .btn-cancel,.btn-save { padding:var(--space-3) var(--space-5); border-radius:var(--radius-m); font-weight:600; font-size:0.9rem; transition:all var(--transition-fast); display:flex; align-items:center; gap:6px; }
        .btn-cancel { border:1.5px solid var(--color-border); color:var(--color-text-secondary); background:var(--color-surface); }
        .btn-save { background:var(--color-primary); color:#fff; }
        .btn-save:hover:not(:disabled) { background:var(--color-primary-hover); }
        .btn-save:disabled { opacity:.6; cursor:not-allowed; }
        .btn-spinner-sm { width:15px; height:15px; border:2px solid rgba(255,255,255,.3); border-top-color:#fff; border-radius:50%; animation:spin 700ms linear infinite; display:inline-block; }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes animate-scale-in { from{opacity:0;transform:scale(.94)} to{opacity:1;transform:scale(1)} }
        .animate-scale-in { animation:animate-scale-in 180ms ease-out; }
        .skeleton { background:var(--color-surface-2); animation:pulse 1.4s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
      `}</style>
    </div>
  )
}
