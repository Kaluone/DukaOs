import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Truck, Phone, Mail, MapPin, Edit2, X, Search } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { useT } from '@/shared/i18n/useLanguage'

interface Supplier {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  active: boolean
  created_at: string
}

const EMPTY: Omit<Supplier, 'id' | 'created_at'> = {
  name: '', phone: '', email: '', address: '', notes: '', active: true,
}

export function SuppliersPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const t = useT()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<null | 'add' | 'edit'>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ['suppliers', shop?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('shop_id', shop!.id)
        .order('name')
      if (error) throw error
      return data ?? []
    },
    enabled: !!shop?.id,
  })

  const deactivate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('suppliers').update({ active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers', shop?.id] }),
  })

  const openAdd = () => { setForm({ ...EMPTY }); setEditId(null); setErr(''); setModal('add') }
  const openEdit = (s: Supplier) => {
    setForm({ name: s.name, phone: s.phone ?? '', email: s.email ?? '', address: s.address ?? '', notes: s.notes ?? '', active: s.active })
    setEditId(s.id); setErr(''); setModal('edit')
  }

  const handleSave = async () => {
    if (!shop?.id || !form.name.trim()) { setErr(t('required')); return }
    setSaving(true); setErr('')
    try {
      if (modal === 'add') {
        const { error } = await supabase.from('suppliers').insert({ shop_id: shop.id, ...form })
        if (error) throw error
      } else {
        const { error } = await supabase.from('suppliers').update(form).eq('id', editId!)
        if (error) throw error
      }
      qc.invalidateQueries({ queryKey: ['suppliers', shop.id] })
      setModal(null)
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.phone ?? '').includes(search)
  )

  return (
    <div className="pg">
      <div className="pg__header">
        <div>
          <h1 className="pg__title">{t('suppliersTitle')}</h1>
          <p className="pg__sub">{t('suppliersSub')}</p>
        </div>
        <button className="btn-primary" onClick={openAdd}>
          <Plus size={16} /> {t('addSupplier')}
        </button>
      </div>

      <div className="search-bar">
        <Search size={15} />
        <input
          className="search-bar__input"
          placeholder={t('search')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="sup-grid">
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 140, borderRadius: 'var(--radius-l)' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Truck size={40} style={{ color: 'var(--color-text-muted)' }} />
          <p>{t('noSuppliers')}</p>
          <button className="btn-primary" onClick={openAdd}><Plus size={14} /> {t('addSupplier')}</button>
        </div>
      ) : (
        <div className="sup-grid">
          {filtered.map(s => (
            <div key={s.id} className={`sup-card ${!s.active ? 'sup-card--inactive' : ''}`}>
              <div className="sup-card__head">
                <div className="sup-card__avatar">{s.name[0].toUpperCase()}</div>
                <div className="sup-card__info">
                  <span className="sup-card__name">{s.name}</span>
                  {!s.active && <span className="badge badge-default">{t('inactive')}</span>}
                </div>
                <button className="sup-card__edit" onClick={() => openEdit(s)}><Edit2 size={14} /></button>
              </div>
              <div className="sup-card__details">
                {s.phone && <span><Phone size={12} /> {s.phone}</span>}
                {s.email && <span><Mail size={12} /> {s.email}</span>}
                {s.address && <span><MapPin size={12} /> {s.address}</span>}
              </div>
              {s.notes && <p className="sup-card__notes">{s.notes}</p>}
              {s.active && (
                <button className="sup-card__deact" onClick={() => { if (confirm(t('deactivateSupplier'))) deactivate.mutate(s.id) }}>
                  {t('deactivate')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal__head">
              <h3>{modal === 'add' ? t('addSupplier') : t('editSupplier')}</h3>
              <button onClick={() => setModal(null)}><X size={18} /></button>
            </div>
            <div className="modal__body">
              <div className="field">
                <label className="field__label">{t('supplierName')} *</label>
                <input className="field__input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
              </div>
              <div className="field">
                <label className="field__label">{t('phone')}</label>
                <input className="field__input" value={form.phone ?? ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="field">
                <label className="field__label">{t('email')}</label>
                <input className="field__input" type="email" value={form.email ?? ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="field">
                <label className="field__label">{t('address')}</label>
                <input className="field__input" value={form.address ?? ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="field">
                <label className="field__label">{t('notes')}</label>
                <textarea className="field__input" rows={2} value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              {err && <p className="form-err">{err}</p>}
            </div>
            <div className="modal__foot">
              <button className="btn-ghost" onClick={() => setModal(null)}>{t('cancel')}</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? t('saving') : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .pg { display: flex; flex-direction: column; gap: var(--space-6); }
        .pg__header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3); }
        .pg__title { font-size: 1.6rem; font-weight: 800; }
        .pg__sub { color: var(--color-text-muted); font-size: 0.85rem; }

        .search-bar { display: flex; align-items: center; gap: var(--space-2); padding: 0 var(--space-3); background: var(--color-surface); border: 1.5px solid var(--color-border); border-radius: var(--radius-l); max-width: 360px; }
        .search-bar:focus-within { border-color: var(--color-primary); }
        .search-bar__input { flex: 1; padding: var(--space-3) 0; border: none; outline: none; background: none; font-size: 0.9rem; color: var(--color-text); }

        .sup-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-4); }
        .sup-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-l); padding: var(--space-4); box-shadow: var(--shadow-xs); display: flex; flex-direction: column; gap: var(--space-3); }
        .sup-card--inactive { opacity: 0.6; }
        .sup-card__head { display: flex; align-items: center; gap: var(--space-3); }
        .sup-card__avatar { width: 42px; height: 42px; border-radius: var(--radius-m); background: var(--color-primary-light); color: var(--color-primary); font-weight: 800; font-size: 1.1rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .sup-card__info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .sup-card__name { font-weight: 700; font-size: 0.95rem; }
        .sup-card__edit { color: var(--color-text-muted); padding: 6px; border-radius: var(--radius-s); }
        .sup-card__edit:hover { color: var(--color-primary); background: var(--color-primary-light); }
        .sup-card__details { display: flex; flex-direction: column; gap: 4px; }
        .sup-card__details span { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--color-text-secondary); }
        .sup-card__notes { font-size: 0.78rem; color: var(--color-text-muted); font-style: italic; border-top: 1px solid var(--color-border); padding-top: var(--space-2); margin: 0; }
        .sup-card__deact { margin-top: auto; font-size: 0.75rem; color: var(--color-error); border: 1px solid var(--color-error); border-radius: var(--radius-s); padding: 4px 10px; align-self: flex-start; }
        .sup-card__deact:hover { background: var(--color-error-bg); }

        .empty-state { display: flex; flex-direction: column; align-items: center; gap: var(--space-4); padding: var(--space-16) 0; color: var(--color-text-muted); }
        .empty-state p { font-size: 0.9rem; }

        .btn-primary { display: flex; align-items: center; gap: 6px; padding: var(--space-3) var(--space-5); background: var(--color-primary); color: #fff; border-radius: var(--radius-l); font-weight: 600; font-size: 0.9rem; transition: background var(--transition-fast); }
        .btn-primary:hover { background: var(--color-primary-hover); }
        .btn-ghost { padding: var(--space-3) var(--space-5); border: 1.5px solid var(--color-border); color: var(--color-text-secondary); border-radius: var(--radius-l); font-weight: 600; font-size: 0.9rem; }
        .btn-ghost:hover { border-color: var(--color-primary); color: var(--color-primary); }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; padding: var(--space-4); z-index: 200; }
        .modal { background: var(--color-surface); border-radius: var(--radius-xl); width: 100%; max-width: 480px; box-shadow: var(--shadow-lg); }
        .modal__head { display: flex; align-items: center; justify-content: space-between; padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--color-border); }
        .modal__head h3 { font-size: 1rem; font-weight: 700; }
        .modal__head button { color: var(--color-text-muted); padding: 4px; }
        .modal__body { padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-4); }
        .modal__foot { padding: var(--space-4) var(--space-5); border-top: 1px solid var(--color-border); display: flex; gap: var(--space-3); justify-content: flex-end; }

        .field { display: flex; flex-direction: column; gap: 5px; }
        .field__label { font-size: 0.82rem; font-weight: 600; color: var(--color-text-secondary); }
        .field__input { padding: 10px var(--space-4); border: 1.5px solid var(--color-border); border-radius: var(--radius-m); font-size: 0.9rem; outline: none; background: var(--color-surface); color: var(--color-text); transition: border-color var(--transition-fast); resize: vertical; }
        .field__input:focus { border-color: var(--color-primary); }
        .form-err { font-size: 0.82rem; color: var(--color-error); background: var(--color-error-bg); padding: var(--space-3); border-radius: var(--radius-m); }

        .badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: var(--radius-full); font-size: 0.72rem; font-weight: 600; }
        .badge-default { background: var(--color-surface-2); color: var(--color-text-muted); }
      `}</style>
    </div>
  )
}
