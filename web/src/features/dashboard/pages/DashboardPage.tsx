import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp, ShoppingCart, AlertTriangle,
  Users, ArrowUpRight, RefreshCw, Wallet, TrendingDown,
} from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { format } from 'date-fns'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { useT, useLanguageStore } from '@/shared/i18n/useLanguage'

// ---- Types ----
interface DashboardSummary {
  revenue_today: number
  transactions_today: number
  active_staff_today: number
  low_stock_count: number
  variance_alerts_today: number
  expenses_today: number
  profit_today: number
}

interface RecentTransaction {
  id: string
  total_amount: number
  payment_method: string
  created_at: string
  staff: { full_name: string } | null
}

interface LowStockItem {
  product_id: string
  product_name: string
  quantity: number
  reorder_threshold: number
  photo_url: string | null
}

// ---- Hooks ----
function useDashboardSummary(shopId?: string) {
  return useQuery<DashboardSummary>({
    queryKey: ['dashboard-summary', shopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_dashboard_today')
        .select('*')
        .eq('shop_id', shopId!)
        .single()
      if (error) throw error
      return data as DashboardSummary
    },
    enabled: !!shopId,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}

function useRecentTransactions(shopId?: string) {
  return useQuery<RecentTransaction[]>({
    queryKey: ['recent-transactions', shopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, total_amount, payment_method, created_at, staff:staff_id(full_name)')
        .eq('shop_id', shopId!)
        .order('created_at', { ascending: false })
        .limit(8)
      if (error) throw error
      return (data ?? []) as unknown as RecentTransaction[]
    },
    enabled: !!shopId,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}

function useLowStock(shopId?: string) {
  return useQuery<LowStockItem[]>({
    queryKey: ['low-stock', shopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_low_stock')
        .select('*')
        .eq('shop_id', shopId!)
        .limit(5)
      if (error) throw error
      return (data ?? []) as LowStockItem[]
    },
    enabled: !!shopId,
    staleTime: 60_000,
  })
}

function useWeeklyRevenue(shopId?: string) {
  return useQuery({
    queryKey: ['weekly-revenue', shopId],
    queryFn: async () => {
      const since = new Date()
      since.setDate(since.getDate() - 6)
      const { data, error } = await supabase
        .from('transactions')
        .select('total_amount, created_at')
        .eq('shop_id', shopId!)
        .eq('sync_status', 'synced')
        .gte('created_at', since.toISOString())
      if (error) throw error

      // Group by day
      const byDay: Record<string, number> = {}
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i)
        byDay[d.toDateString()] = 0
      }
      for (const txn of data ?? []) {
        const key = new Date(txn.created_at).toDateString()
        if (key in byDay) byDay[key] += txn.total_amount
      }
      return Object.entries(byDay).map(([date, amount]) => ({
        day: format(new Date(date), 'EEE'),
        amount,
      }))
    },
    enabled: !!shopId,
    staleTime: 5 * 60_000,
  })
}

// ---- Helpers ----
function fmt(n: number) {
  return new Intl.NumberFormat('sw-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(n)
}

const paymentLabel: Record<string, string> = {
  cash: 'Cash / Taslimu', mpesa: 'M-Pesa', tigopesa: 'Tigo Pesa',
  airtelmoney: 'Airtel Money', halopesa: 'HaloPesa', other: 'Other',
}

// ---- Sub-components ----
function MetricCard({
  label, value, icon: Icon, delta, color = 'primary'
}: {
  label: string; value: string; icon: React.ElementType
  delta?: string; color?: 'primary' | 'accent' | 'success' | 'warning' | 'error'
}) {
  const colorMap = {
    primary: 'var(--color-primary)',
    accent:  'var(--color-accent)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    error:   'var(--color-error)',
  }
  return (
    <div className="metric-card animate-slide-up">
      <div className="metric-card__top">
        <span className="metric-card__label">{label}</span>
        <div className="metric-card__icon" style={{ background: colorMap[color] + '18', color: colorMap[color] }}>
          <Icon size={20} />
        </div>
      </div>
      <div className="metric-card__value">{value}</div>
      {delta && (
        <div className="metric-card__delta">
          <ArrowUpRight size={13} />
          <span>{delta}</span>
        </div>
      )}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="metric-card">
      <div className="skeleton" style={{ height: 14, width: '60%', marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 28, width: '80%', marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 12, width: '40%' }} />
    </div>
  )
}

// ---- Page ----
export function DashboardPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const { data: summary, isLoading: loadingS, refetch } = useDashboardSummary(shop?.id)
  const { data: transactions, isLoading: loadingT } = useRecentTransactions(shop?.id)
  const { data: lowStock } = useLowStock(shop?.id)
  const { data: weeklyData } = useWeeklyRevenue(shop?.id)
  const tr = useT()
  const { lang } = useLanguageStore()

  // Live updates via Supabase Realtime
  useEffect(() => {
    if (!shop?.id) return
    const channel = supabase
      .channel(`shop-${shop.id}-transactions`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'transactions',
        filter: `shop_id=eq.${shop.id}`,
      }, () => { refetch() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [shop?.id, refetch])

  const locale = lang === 'sw' ? 'sw-TZ' : 'en-GB'
  const today = new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="dash">
      {/* Page header */}
      <div className="dash__header">
        <div>
          <h1 className="dash__title">{tr('dashTitle')}</h1>
          <p className="dash__date">{today}</p>
        </div>
        <button className="dash__refresh" onClick={() => refetch()} aria-label={tr('refresh')}>
          <RefreshCw size={16} />
          <span>{tr('refresh')}</span>
        </button>
      </div>

      {/* Metric cards */}
      <div className="dash__metrics stagger-list">
        {loadingS ? (
          [1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)
        ) : (
          <>
            <MetricCard
              label={tr('revenueToday')}
              value={fmt(summary?.revenue_today ?? 0)}
              icon={TrendingUp}
              color="primary"
            />
            <MetricCard
              label={tr('profitToday')}
              value={fmt(summary?.profit_today ?? 0)}
              icon={TrendingUp}
              color="success"
            />
            <MetricCard
              label={tr('expensesToday')}
              value={fmt(summary?.expenses_today ?? 0)}
              icon={TrendingDown}
              color="error"
            />
            <MetricCard
              label={tr('salesToday')}
              value={String(summary?.transactions_today ?? 0)}
              icon={ShoppingCart}
              color="accent"
            />
            <MetricCard
              label={tr('lowStock')}
              value={String(summary?.low_stock_count ?? 0)}
              icon={AlertTriangle}
              color={summary?.low_stock_count ? 'warning' : 'success'}
            />
            <MetricCard
              label={tr('activeStaff')}
              value={String(summary?.active_staff_today ?? 0)}
              icon={Users}
              color="accent"
            />
          </>
        )}
      </div>

      <div className="dash__grid">
        {/* Revenue chart */}
        <div className="dash__chart-card card">
          <div className="card-header">
            <h3>{tr('chartWeekly')}</h3>
          </div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData ?? []} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-m)', fontSize: 13,
                    fontFamily: 'var(--font-body)', boxShadow: 'var(--shadow-md)'
                  }}
                  formatter={(val: number) => [fmt(val), tr('revenue')]}
                />
                <Area type="monotone" dataKey="amount" stroke="var(--color-primary)" strokeWidth={2} fill="url(#revGrad)" dot={{ fill: 'var(--color-primary)', r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Low stock */}
        <div className="dash__alert-card card">
          <div className="card-header">
            <h3>{tr('lowStockAlert')}</h3>
            {!!lowStock?.length && (
              <span className="badge badge-warning">{lowStock.length}</span>
            )}
          </div>
          {!lowStock?.length ? (
            <div className="empty-state">
              <span className="empty-state__icon" style={{ color: 'var(--color-success)' }}>
                <AlertTriangle size={32} />
              </span>
              <p>{tr('noLowStock')}</p>
            </div>
          ) : (
            <ul className="stock-list">
              {lowStock.map(item => (
                <li key={item.product_id} className="stock-list__item">
                  <div className="stock-list__img">
                    {item.photo_url
                      ? <img src={item.photo_url} alt={item.product_name} />
                      : <span>{item.product_name[0]}</span>
                    }
                  </div>
                  <div className="stock-list__info">
                    <span className="stock-list__name">{item.product_name}</span>
                    <span className="stock-list__qty">
                      {tr('inStock')}: <strong>{item.quantity}</strong> / {item.reorder_threshold}
                    </span>
                  </div>
                  <span className={`badge ${item.quantity === 0 ? 'badge-error' : 'badge-warning'}`}>
                    {item.quantity === 0 ? tr('outOfStock') : tr('lowStockWarn')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="card">
        <div className="card-header">
          <h3>{tr('recentTxns')}</h3>
          {summary?.variance_alerts_today ? (
            <span className="badge badge-error">
              <Wallet size={12} /> {summary.variance_alerts_today}
            </span>
          ) : null}
        </div>
        {loadingT ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 'var(--radius-m)' }} />)}
          </div>
        ) : !transactions?.length ? (
          <div className="empty-state">
            <ShoppingCart size={32} className="empty-state__icon" />
            <p>{tr('noTransactions')}</p>
          </div>
        ) : (
          <div className="txn-table-wrap">
            <table className="txn-table">
              <thead>
                <tr>
                  <th>{tr('date')}</th>
                  <th>{tr('cashier')}</th>
                  <th>{tr('paymentMethod')}</th>
                  <th style={{ textAlign: 'right' }}>{tr('total')}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(txn => (
                  <tr key={txn.id}>
                    <td>{format(new Date(txn.created_at), 'HH:mm')}</td>
                    <td>{txn.staff?.full_name ?? '—'}</td>
                    <td>
                      <span className="badge badge-default">{paymentLabel[txn.payment_method] ?? txn.payment_method}</span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-primary)' }}>
                      {fmt(txn.total_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        .dash { display: flex; flex-direction: column; gap: var(--space-6); }

        .dash__header {
          display: flex; align-items: flex-start; justify-content: space-between;
          flex-wrap: wrap; gap: var(--space-3);
        }
        .dash__title  { font-size: 1.6rem; font-weight: 800; }
        .dash__date   { color: var(--color-text-muted); font-size: 0.85rem; margin-top: 2px; }
        .dash__refresh {
          display: flex; align-items: center; gap: 6px;
          padding: var(--space-2) var(--space-4);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-m);
          font-size: 0.85rem; font-weight: 500;
          color: var(--color-text-secondary);
          transition: all var(--transition-fast);
          background: var(--color-surface);
        }
        .dash__refresh:hover {
          border-color: var(--color-primary);
          color: var(--color-primary);
        }

        .dash__metrics {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: var(--space-4);
        }

        .metric-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-l);
          padding: var(--space-5);
          box-shadow: var(--shadow-xs);
          transition: box-shadow var(--transition-fast), transform var(--transition-fast);
        }
        .metric-card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }

        .metric-card__top {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: var(--space-3);
        }
        .metric-card__label { font-size: 0.8rem; color: var(--color-text-muted); font-weight: 500; }
        .metric-card__icon {
          width: 36px; height: 36px; border-radius: var(--radius-m);
          display: flex; align-items: center; justify-content: center;
        }
        .metric-card__value { font-size: 1.4rem; font-weight: 800; font-family: var(--font-heading); }
        .metric-card__delta {
          display: flex; align-items: center; gap: 2px;
          font-size: 0.75rem; color: var(--color-success); margin-top: 4px;
        }

        .dash__grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-4);
        }
        @media (max-width: 768px) { .dash__grid { grid-template-columns: 1fr; } }

        .dash__chart-card { grid-column: 1; }
        .dash__alert-card { grid-column: 2; }
        @media (max-width: 768px) {
          .dash__chart-card, .dash__alert-card { grid-column: 1; }
        }

        .card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-l);
          padding: var(--space-5);
          box-shadow: var(--shadow-xs);
        }

        .card-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: var(--space-5);
        }
        .card-header h3 { font-size: 0.95rem; font-weight: 700; }

        .empty-state {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: var(--space-3);
          padding: var(--space-10) 0;
          color: var(--color-text-muted);
        }
        .empty-state p { font-size: 0.875rem; text-align: center; }

        .stock-list { list-style: none; display: flex; flex-direction: column; gap: var(--space-3); }
        .stock-list__item {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-2) 0;
          border-bottom: 1px solid var(--color-border);
        }
        .stock-list__item:last-child { border-bottom: none; }
        .stock-list__img {
          width: 38px; height: 38px; border-radius: var(--radius-m);
          background: var(--color-surface-2);
          overflow: hidden; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; color: var(--color-primary); font-size: 1rem;
        }
        .stock-list__img img { width: 100%; height: 100%; object-fit: cover; }
        .stock-list__info { flex: 1; min-width: 0; }
        .stock-list__name { font-weight: 600; font-size: 0.875rem; display: block; }
        .stock-list__qty  { font-size: 0.75rem; color: var(--color-text-muted); }

        .txn-table-wrap { overflow-x: auto; }
        .txn-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
        .txn-table th {
          text-align: left; padding: var(--space-2) var(--space-3);
          color: var(--color-text-muted); font-size: 0.75rem;
          font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
          border-bottom: 1px solid var(--color-border);
        }
        .txn-table td {
          padding: var(--space-3) var(--space-3);
          border-bottom: 1px solid var(--color-border);
        }
        .txn-table tr:last-child td { border-bottom: none; }
        .txn-table tr:hover td { background: var(--color-surface-2); }
      `}</style>
    </div>
  )
}
