import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Wallet, X, TrendingDown, Calendar } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { format } from 'date-fns'
import { useT } from '@/shared/i18n/useLanguage'

// ─── Config ──────────────────────────────────────────────────────────────────
const EXPENSE_CATEGORIES = [
  'Kodi ya Duka',
  'Mishahara',
  'Umeme',
  'Maji',
  'Mafuta',
  'Masoko & Matangazo',
  'Intaneti',
  'Matengenezo',
  'Usafiri',
  'Vifaa vya Ofisi',
  'Bima',
  'Kodi ya Serikali / Leseni',
  'Chakula cha Wafanyakazi',
  'Mchanganyiko',
]

const fmt = (n: number) =>
  new Intl.NumberFormat('sw-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(n)

// ─── Types ────────────────────────────────────────────────────────────────────
interface Expense {
  id: string
  category: string
  amount: number
  description: string | null
  expense_date: string
  created_at: string
}

type Period = 'today' | 'week' | 'month' | 'year'

// ─── Hook ─────────────────────────────────────────────────────────────────────
function useExpenses(shopId?: string, period: Period = 'month') {
  const now = new Date()
  let since: Date
  if (period === 'today') {
    since = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  } else if (period === 'week') {
    const d = new Date(); d.setDate(d.getDate() - 6); since = d
  } else if (period === 'month') {
    since = new Date(now.getFullYear(), now.getMonth(), 1)
  } else {
    since = new Date(now.getFullYear(), 0, 1)
  }

  return useQuery<Expense[]>({
    queryKey: ['expenses', shopId, period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('id, category, amount, description, expense_date, created_at')
        .eq('shop_id', shopId!)
        .gte('expense_date', since.toISOString().split('T')[0])
        .order('expense_date', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!shopId,
    staleTime: 60_000,
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function ExpensesPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const qc = useQueryClient()
  const t = useT()

  const [period, setPeriod] = useState<Period>('month')
  const { data: expenses = [], isLoading } = useExpenses(shop?.id, period)

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    category: '',
    amount: '',
    description: '',
    expense_date: new Date().toISOString().split('T')[0],
  })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const total = expenses.reduce((s, e) => s + e.amount, 0)

  // Group by category for summary
  const byCategory: Record<string, number> = {}
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount
  }
  const topCategories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const handleSave = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!shop?.id) return
    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount <= 0) {
      setFormError('Ingiza kiasi sahihi')
      return
    }
    if (!form.category) {
      setFormError('Chagua aina ya gharama')
      return
    }
    setSaving(true); setFormError('')
    const { error } = await supabase.from('expenses').insert({
      shop_id: shop.id,
      category: form.category,
      amount,
      description: form.description.trim() || null,
      expense_date: form.expense_date,
    })
    if (error) {
      setFormError('Hitilafu: ' + error.message)
      setSaving(false)
      return
    }
    qc.invalidateQueries({ queryKey: ['expenses', shop.id] })
    setSaving(false)
    setShowModal(false)
    setForm({ category: '', amount: '', description: '', expense_date: new Date().toISOString().split('T')[0] })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Futa gharama hii?')) return
    await supabase.from('expenses').delete().eq('id', id)
    qc.invalidateQueries({ queryKey: ['expenses', shop?.id] })
  }

  const PERIODS: { id: Period; label: string }[] = [
    { id: 'today', label: t('today') },
    { id: 'week',  label: t('week') },
    { id: 'month', label: t('month') },
    { id: 'year',  label: t('year') },
  ]

  return (
    <div className="pg">
      {/* Header */}
      <div className="pg__header">
        <div>
          <h1 className="pg__title">{t('expensesTitle')}</h1>
          <p className="pg__sub">{t('expensesSub')}</p>
        </div>
        <button className="btn-add" onClick={() => { setShowModal(true); setFormError('') }}>
          <Plus size={18} /> <span>{t('addExpense')}</span>
        </button>
      </div>

      {/* Period filter */}
      <div className="period-pills">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            className={`period-pill ${period === p.id ? 'period-pill--active' : ''}`}
            onClick={() => setPeriod(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="exp-summary">
        <div className="exp-total-card">
          <div className="exp-total-card__icon"><TrendingDown size={22} /></div>
          <div>
            <span className="exp-total-card__label">{t('totalExpenses')}</span>
            <span className="exp-total-card__amount">{fmt(total)}</span>
          </div>
        </div>

        {topCategories.length > 0 && (
          <div className="exp-breakdown">
            {topCategories.map(([cat, amt]) => {
              const pct = total > 0 ? (amt / total) * 100 : 0
              return (
                <div key={cat} className="exp-bar-row">
                  <span className="exp-bar-label">{cat}</span>
                  <div className="exp-bar-track">
                    <div className="exp-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="exp-bar-amt">{fmt(amt)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Expenses list */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3,4].map((i) => (
            <div key={i} className="skeleton" style={{ height: 64, borderRadius: 'var(--radius-l)' }} />
          ))}
        </div>
      ) : expenses.length === 0 ? (
        <div className="empty-state">
          <Wallet size={40} style={{ color: 'var(--color-text-muted)' }} />
          <p>{t('noExpenses')}</p>
        </div>
      ) : (
        <div className="exp-list">
          {expenses.map((e) => (
            <div key={e.id} className="exp-row">
              <div className="exp-row__cat">
                <span className="exp-row__cat-icon">💸</span>
              </div>
              <div className="exp-row__info">
                <span className="exp-row__name">{e.category}</span>
                {e.description && <span className="exp-row__desc">{e.description}</span>}
                <span className="exp-row__date">
                  <Calendar size={11} /> {format(new Date(e.expense_date), 'dd MMM yyyy')}
                </span>
              </div>
              <span className="exp-row__amount">{fmt(e.amount)}</span>
              <button className="exp-row__del" onClick={() => handleDelete(e.id)}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Expense Modal */}
      {showModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal animate-scale-in" style={{ maxWidth: 460 }}>
            <div className="modal__header">
              <h3>{t('addExpense')}</h3>
              <button className="modal__close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="modal__form">
              <div className="field">
                <label className="field__label">{t('expCategory')} *</label>
                <select
                  className="field__input"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  required
                >
                  <option value="">— {t('category')} —</option>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="field-row">
                <div className="field">
                  <label className="field__label">{t('amount')} (TZS) *</label>
                  <input
                    className="field__input"
                    type="number" min="1" step="1"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    required placeholder="50000"
                  />
                </div>
                <div className="field">
                  <label className="field__label">{t('date')}</label>
                  <input
                    className="field__input"
                    type="date"
                    value={form.expense_date}
                    onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
                  />
                </div>
              </div>

              <div className="field">
                <label className="field__label">{t('description')} ({t('optional')})</label>
                <input
                  className="field__input"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder={t('notes')}
                />
              </div>

              {formError && <p className="form-error">{formError}</p>}

              <div className="modal__footer">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>{t('cancel')}</button>
                <button type="submit" className="btn-save" disabled={saving}>
                  {saving ? <span className="btn-spinner-sm" /> : null}
                  {t('save')}
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

        .btn-add { display:flex; align-items:center; gap:6px; padding:var(--space-3) var(--space-5); background:var(--color-primary); color:#fff; border-radius:var(--radius-l); font-weight:600; font-size:0.9rem; transition:all var(--transition-fast); }
        .btn-add:hover { background:var(--color-primary-hover); transform:translateY(-1px); }

        .period-pills { display:flex; gap:var(--space-2); flex-wrap:wrap; }
        .period-pill { padding:6px 16px; border-radius:var(--radius-full); border:1.5px solid var(--color-border); font-size:0.8rem; font-weight:600; color:var(--color-text-muted); transition:all var(--transition-fast); cursor:pointer; }
        .period-pill:hover { border-color:var(--color-primary); color:var(--color-primary); }
        .period-pill--active { background:var(--color-primary); color:#fff; border-color:var(--color-primary); }

        .exp-summary { display:grid; grid-template-columns:auto 1fr; gap:var(--space-4); align-items:start; }
        @media (max-width:640px) { .exp-summary { grid-template-columns:1fr; } }

        .exp-total-card { display:flex; align-items:center; gap:var(--space-4); background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-l); padding:var(--space-5); box-shadow:var(--shadow-xs); }
        .exp-total-card__icon { width:48px; height:48px; background:var(--color-error-bg); color:var(--color-error); border-radius:var(--radius-m); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .exp-total-card__label { display:block; font-size:0.78rem; color:var(--color-text-muted); font-weight:500; }
        .exp-total-card__amount { display:block; font-size:1.5rem; font-weight:800; color:var(--color-error); font-family:var(--font-heading); }

        .exp-breakdown { background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-l); padding:var(--space-4); display:flex; flex-direction:column; gap:var(--space-3); box-shadow:var(--shadow-xs); }
        .exp-bar-row { display:grid; grid-template-columns:140px 1fr 90px; align-items:center; gap:var(--space-2); }
        .exp-bar-label { font-size:0.78rem; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .exp-bar-track { height:7px; background:var(--color-surface-2); border-radius:var(--radius-full); overflow:hidden; }
        .exp-bar-fill { height:100%; background:var(--color-error); border-radius:var(--radius-full); min-width:3px; transition:width 400ms ease; }
        .exp-bar-amt { font-size:0.75rem; font-weight:700; text-align:right; color:var(--color-error); }

        .exp-list { display:flex; flex-direction:column; gap:var(--space-2); }
        .exp-row { display:flex; align-items:center; gap:var(--space-3); background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-l); padding:var(--space-3) var(--space-4); box-shadow:var(--shadow-xs); transition:box-shadow var(--transition-fast); }
        .exp-row:hover { box-shadow:var(--shadow-md); }
        .exp-row__cat { width:36px; height:36px; background:var(--color-error-bg); border-radius:var(--radius-m); display:flex; align-items:center; justify-content:center; font-size:1.1rem; flex-shrink:0; }
        .exp-row__info { flex:1; min-width:0; }
        .exp-row__name { font-weight:700; font-size:0.875rem; display:block; }
        .exp-row__desc { font-size:0.75rem; color:var(--color-text-muted); display:block; }
        .exp-row__date { font-size:0.72rem; color:var(--color-text-muted); display:flex; align-items:center; gap:3px; margin-top:2px; }
        .exp-row__amount { font-weight:800; color:var(--color-error); font-size:0.925rem; white-space:nowrap; }
        .exp-row__del { color:var(--color-text-muted); padding:5px; border-radius:var(--radius-s); flex-shrink:0; transition:all var(--transition-fast); }
        .exp-row__del:hover { color:var(--color-error); background:var(--color-error-bg); }

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
        .btn-cancel, .btn-save { padding:var(--space-3) var(--space-5); border-radius:var(--radius-m); font-weight:600; font-size:0.9rem; transition:all var(--transition-fast); display:flex; align-items:center; gap:6px; }
        .btn-cancel { border:1.5px solid var(--color-border); color:var(--color-text-secondary); background:var(--color-surface); }
        .btn-cancel:hover { border-color:var(--color-primary); }
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
