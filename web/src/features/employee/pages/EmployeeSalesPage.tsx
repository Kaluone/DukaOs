import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, ShoppingBag, Calendar, Search } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useStaffSession } from '@/features/staff/store/staffSessionStore'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'

function fmt(n: number) { return 'TZS ' + n.toLocaleString('en-TZ') }

type Period = 'today' | 'week' | 'month' | 'custom'

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash', mpesa: 'M-Pesa', airtel: 'Airtel', tigo: 'Tigo Pesa',
  halopesa: 'HaloPesa', card: 'Card', credit: 'Credit', other: 'Other',
}

export function EmployeeSalesPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const { activeStaffId } = useStaffSession()
  const shopId = shop?.id

  const [period, setPeriod] = useState<Period>('today')
  const [from, setFrom] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [to, setTo] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [search, setSearch] = useState('')

  const dateRange = (() => {
    const now = new Date()
    if (period === 'today') {
      const d = now.toISOString().split('T')[0]
      return { from: d + 'T00:00:00', to: d + 'T23:59:59' }
    }
    if (period === 'week') {
      const start = new Date(now); start.setDate(start.getDate() - 6)
      return { from: start.toISOString().split('T')[0] + 'T00:00:00', to: now.toISOString().split('T')[0] + 'T23:59:59' }
    }
    if (period === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: start.toISOString().split('T')[0] + 'T00:00:00', to: now.toISOString().split('T')[0] + 'T23:59:59' }
    }
    return { from: from + 'T00:00:00', to: to + 'T23:59:59' }
  })()

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['emp-sales', activeStaffId, dateRange],
    enabled: !!shopId && !!activeStaffId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, created_at, total, payment_method, status, transaction_items(quantity)')
        .eq('shop_id', shopId!)
        .eq('staff_id', activeStaffId!)
        .gte('created_at', dateRange.from)
        .lte('created_at', dateRange.to)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const totalRevenue = sales.reduce((s, t) => s + (t.total ?? 0), 0)
  const totalItems = sales.reduce((s, t) => s + (t.transaction_items?.reduce((a: number, i: {quantity:number}) => a + i.quantity, 0) ?? 0), 0)

  const filtered = search
    ? sales.filter(t => (PAYMENT_LABELS[t.payment_method] ?? t.payment_method ?? '').toLowerCase().includes(search.toLowerCase()))
    : sales

  return (
    <div className="mys-page">
      <div className="mys-head">
        <h1 className="mys-title">My Sales</h1>
        <p className="mys-sub">Your personal sales history and performance</p>
      </div>

      {/* Period selector */}
      <div className="mys-filter-bar">
        <div className="mys-period">
          {(['today', 'week', 'month', 'custom'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)} className={`mys-period-btn ${period === p ? 'mys-period-btn--active' : ''}`}>
              {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'Custom'}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="mys-custom-dates">
            <label>From <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="mys-date-inp" /></label>
            <label>To <input type="date" value={to} onChange={e => setTo(e.target.value)} className="mys-date-inp" /></label>
          </div>
        )}
        <div className="mys-search">
          <Search size={14} />
          <input placeholder="Filter by payment method…" value={search} onChange={e => setSearch(e.target.value)} className="mys-search-inp" />
        </div>
      </div>

      {/* Summary */}
      <div className="mys-summary">
        <div className="mys-sum-card">
          <div className="mys-sum-icon mys-sum-icon--primary"><ShoppingBag size={18} /></div>
          <div><span className="mys-sum-val">{filtered.length}</span><span className="mys-sum-lbl">Transactions</span></div>
        </div>
        <div className="mys-sum-card">
          <div className="mys-sum-icon mys-sum-icon--success"><TrendingUp size={18} /></div>
          <div><span className="mys-sum-val">{fmt(totalRevenue)}</span><span className="mys-sum-lbl">Total Revenue</span></div>
        </div>
        <div className="mys-sum-card">
          <div className="mys-sum-icon mys-sum-icon--info"><Calendar size={18} /></div>
          <div><span className="mys-sum-val">{totalItems}</span><span className="mys-sum-lbl">Items Sold</span></div>
        </div>
        <div className="mys-sum-card">
          <div className="mys-sum-icon mys-sum-icon--warning"><TrendingUp size={18} /></div>
          <div>
            <span className="mys-sum-val">{filtered.length > 0 ? fmt(Math.round(totalRevenue / filtered.length)) : 'TZS 0'}</span>
            <span className="mys-sum-lbl">Avg per Sale</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="mys-table-card">
        <div className="mys-table-head">
          <h2 className="mys-table-title">Transactions ({filtered.length})</h2>
        </div>
        {isLoading ? (
          <div className="mys-loading">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="mys-empty">No sales found for this period.</div>
        ) : (
          <div className="mys-table-wrap">
            <table className="mys-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Items</th>
                  <th>Payment</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const itemCount = t.transaction_items?.reduce((a: number, i: {quantity:number}) => a + i.quantity, 0) ?? 0
                  return (
                    <tr key={t.id}>
                      <td>
                        <span className="mys-date">{new Date(t.created_at).toLocaleDateString('en-TZ', { day: 'numeric', month: 'short' })}</span>
                        <span className="mys-time">{new Date(t.created_at).toLocaleTimeString('en-TZ', { hour: '2-digit', minute: '2-digit' })}</span>
                      </td>
                      <td><span className="mys-items">{itemCount} item{itemCount !== 1 ? 's' : ''}</span></td>
                      <td>
                        <span className="mys-method">{PAYMENT_LABELS[t.payment_method] ?? t.payment_method ?? '—'}</span>
                      </td>
                      <td><span className="mys-total">{fmt(t.total)}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        .mys-page { display:flex; flex-direction:column; gap:20px; }
        .mys-head { }
        .mys-title { font-size:1.6rem; font-weight:800; font-family:var(--font-heading); color:var(--color-text); margin:0; }
        .mys-sub { color:var(--color-text-muted); font-size:.875rem; margin:4px 0 0; }

        .mys-filter-bar { display:flex; flex-wrap:wrap; align-items:center; gap:12px; }
        .mys-period { display:flex; gap:4px; background:var(--color-bg); border:1px solid var(--color-border); border-radius:10px; padding:3px; }
        .mys-period-btn { padding:7px 14px; border-radius:8px; font-size:.8rem; font-weight:600; color:var(--color-text-secondary); transition:all 120ms; }
        .mys-period-btn--active { background:var(--color-primary); color:#fff; }
        .mys-custom-dates { display:flex; gap:10px; align-items:center; font-size:.8rem; color:var(--color-text-muted); }
        .mys-date-inp { padding:6px 10px; border:1.5px solid var(--color-border); border-radius:8px; background:var(--color-bg); color:var(--color-text); font-size:.8rem; outline:none; margin-left:6px; }
        .mys-search { display:flex; align-items:center; gap:8px; background:var(--color-surface); border:1.5px solid var(--color-border); border-radius:10px; padding:8px 12px; flex:1; max-width:260px; }
        .mys-search-inp { flex:1; background:none; border:none; outline:none; color:var(--color-text); font-size:.875rem; }

        .mys-summary { display:grid; grid-template-columns:repeat(2,1fr); gap:14px; }
        @media(min-width:640px){ .mys-summary{ grid-template-columns:repeat(4,1fr); } }
        .mys-sum-card { background:var(--color-surface); border:1px solid var(--color-border); border-radius:14px; padding:16px; display:flex; gap:12px; align-items:center; }
        .mys-sum-icon { width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .mys-sum-icon--primary { background:var(--color-primary-light); color:var(--color-primary); }
        .mys-sum-icon--success { background:var(--color-success-bg); color:var(--color-success); }
        .mys-sum-icon--info { background:var(--color-info-bg); color:var(--color-info); }
        .mys-sum-icon--warning { background:var(--color-warning-bg); color:var(--color-warning); }
        .mys-sum-val { font-size:1.1rem; font-weight:800; font-family:var(--font-heading); color:var(--color-text); display:block; }
        .mys-sum-lbl { font-size:.72rem; color:var(--color-text-muted); display:block; margin-top:2px; }

        .mys-table-card { background:var(--color-surface); border:1px solid var(--color-border); border-radius:16px; overflow:hidden; }
        .mys-table-head { padding:16px 20px; border-bottom:1px solid var(--color-border); }
        .mys-table-title { font-weight:700; font-size:.95rem; margin:0; color:var(--color-text); }
        .mys-loading,.mys-empty { padding:32px; text-align:center; color:var(--color-text-muted); font-size:.875rem; }
        .mys-table-wrap { overflow-x:auto; }
        .mys-table { width:100%; border-collapse:collapse; }
        .mys-table thead tr { background:var(--color-bg); }
        .mys-table th { padding:10px 16px; text-align:left; font-size:.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--color-text-muted); border-bottom:1px solid var(--color-border); }
        .mys-table td { padding:12px 16px; border-bottom:1px solid var(--color-border); vertical-align:middle; }
        .mys-table tr:last-child td { border-bottom:none; }
        .mys-table tr:hover td { background:var(--color-bg); }
        .mys-date { display:block; font-weight:600; font-size:.875rem; color:var(--color-text); }
        .mys-time { display:block; font-size:.75rem; color:var(--color-text-muted); }
        .mys-items { font-size:.875rem; color:var(--color-text-secondary); }
        .mys-method { font-size:.82rem; font-weight:600; background:var(--color-primary-light); color:var(--color-primary); padding:3px 8px; border-radius:6px; }
        .mys-total { font-weight:700; font-size:.95rem; color:var(--color-text); }
      `}</style>
    </div>
  )
}
