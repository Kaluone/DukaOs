import { useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import {
  ShoppingBag, ShoppingCart, Wallet, TrendingDown, TrendingUp,
  LogIn, LogOut, Package, RefreshCw, ArrowDown, ArrowUp, Activity,
} from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns'
import { useT } from '@/shared/i18n/useLanguage'

interface ActivityItem {
  id: string
  activity_type: string
  description: string
  amount: number | null
  staff_name: string | null
  reference_type: string | null
  created_at: string
}

const PAGE_SIZE = 30

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  sale:         { icon: ShoppingBag,  color: 'var(--color-primary)',  bg: 'var(--color-primary-light)',  label: 'Sale' },
  purchase:     { icon: ShoppingCart, color: 'var(--color-warning)',  bg: 'var(--color-warning-bg, #fef9c3)', label: 'Purchase' },
  expense:      { icon: Wallet,       color: 'var(--color-error)',    bg: 'var(--color-error-bg, #fee2e2)',   label: 'Expense' },
  refund:       { icon: TrendingDown, color: 'var(--color-error)',    bg: 'var(--color-error-bg, #fee2e2)',   label: 'Refund' },
  login:        { icon: LogIn,        color: 'var(--color-success)',  bg: 'var(--color-success-bg, #dcfce7)', label: 'Login' },
  logout:       { icon: LogOut,       color: 'var(--color-text-muted)', bg: 'var(--color-surface-2)',        label: 'Logout' },
  stock_in:     { icon: ArrowDown,    color: 'var(--color-success)',  bg: 'var(--color-success-bg, #dcfce7)', label: 'Stock In' },
  stock_out:    { icon: ArrowUp,      color: 'var(--color-warning)',  bg: 'var(--color-warning-bg, #fef9c3)', label: 'Stock Out' },
  stock_adjust: { icon: Package,      color: 'var(--color-accent)',   bg: 'var(--color-primary-light)',      label: 'Stock Adjust' },
  product_add:  { icon: Package,      color: 'var(--color-accent)',   bg: 'var(--color-primary-light)',      label: 'Product Added' },
  product_edit: { icon: Package,      color: 'var(--color-text-muted)', bg: 'var(--color-surface-2)',        label: 'Product Edited' },
  staff_add:    { icon: TrendingUp,   color: 'var(--color-primary)',  bg: 'var(--color-primary-light)',      label: 'Staff Added' },
  customer_add: { icon: TrendingUp,   color: 'var(--color-primary)',  bg: 'var(--color-primary-light)',      label: 'Customer Added' },
  import:       { icon: RefreshCw,    color: 'var(--color-accent)',   bg: 'var(--color-primary-light)',      label: 'Import' },
}

function getDateLabel(dateStr: string) {
  const d = new Date(dateStr)
  if (isToday(d))     return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'EEEE, d MMMM yyyy')
}

function fmt(n: number) {
  return new Intl.NumberFormat('sw-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(n)
}

export function ActivityPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const t = useT()
  const [typeFilter, setTypeFilter] = useState('all')

  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading,
  } = useInfiniteQuery({
    queryKey: ['activity', shop?.id, typeFilter],
    queryFn: async ({ pageParam = 0 }) => {
      let q = supabase
        .from('activity_log')
        .select('id, activity_type, description, amount, staff_name, reference_type, created_at')
        .eq('shop_id', shop!.id)
        .order('created_at', { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1)
      if (typeFilter !== 'all') q = q.eq('activity_type', typeFilter)
      const { data: rows, error } = await q
      if (error) throw error
      return { rows: rows ?? [], nextPage: pageParam + 1, hasMore: (rows?.length ?? 0) === PAGE_SIZE }
    },
    getNextPageParam: prev => prev.hasMore ? prev.nextPage : undefined,
    initialPageParam: 0,
    enabled: !!shop?.id,
  })

  const allItems: ActivityItem[] = (data?.pages ?? []).flatMap(p => p.rows)

  // Group by date
  const groups: Record<string, ActivityItem[]> = {}
  for (const item of allItems) {
    const label = getDateLabel(item.created_at)
    if (!groups[label]) groups[label] = []
    groups[label].push(item)
  }

  const TYPES = ['all', 'sale', 'purchase', 'expense', 'stock_in', 'stock_out', 'stock_adjust', 'login', 'logout']

  return (
    <div className="act">
      <div className="act__header">
        <div>
          <h1 className="act__title">{t('activityTitle')}</h1>
          <p className="act__sub">{t('activitySub')}</p>
        </div>
      </div>

      {/* Type filter */}
      <div className="act__filters">
        {TYPES.map(type => (
          <button
            key={type}
            className={`chip ${typeFilter === type ? 'chip--active' : ''}`}
            onClick={() => setTypeFilter(type)}
          >
            {type === 'all' ? 'All' : (TYPE_CONFIG[type]?.label ?? type)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : !allItems.length ? (
        <div className="empty">
          <Activity size={40} style={{ color: 'var(--color-text-muted)', marginBottom: 12 }} />
          <p>{t('noActivity')}</p>
        </div>
      ) : (
        <div className="act__timeline">
          {Object.entries(groups).map(([dateLabel, items]) => (
            <div key={dateLabel} className="act__group">
              <div className="act__date-label">{dateLabel}</div>
              <div className="act__items">
                {items.map(item => {
                  const config = TYPE_CONFIG[item.activity_type] ?? TYPE_CONFIG.product_edit
                  const Icon = config.icon
                  return (
                    <div key={item.id} className="act-item">
                      <div className="act-item__icon" style={{ background: config.bg, color: config.color }}>
                        <Icon size={16} />
                      </div>
                      <div className="act-item__body">
                        <div className="act-item__row">
                          <span className="act-item__type" style={{ color: config.color }}>{config.label}</span>
                          {item.amount !== null && item.amount > 0 && (
                            <span className="act-item__amount">{fmt(item.amount)}</span>
                          )}
                        </div>
                        <span className="act-item__desc">{item.description}</span>
                        <div className="act-item__meta">
                          {item.staff_name && <span className="act-item__staff">{item.staff_name}</span>}
                          <span className="act-item__time" title={format(new Date(item.created_at), 'dd/MM/yyyy HH:mm:ss')}>
                            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {hasNextPage && (
            <div className="act__load-more">
              <button className="btn-load-more" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? <><span className="spinner-sm" /> Loading…</> : t('loadMore')}
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        .act { display: flex; flex-direction: column; gap: var(--space-5); }
        .act__header { }
        .act__title { font-size: 1.6rem; font-weight: 800; }
        .act__sub { color: var(--color-text-muted); font-size: 0.85rem; }

        .act__filters { display: flex; flex-wrap: wrap; gap: var(--space-2); }
        .chip { padding: 5px 12px; border: 1.5px solid var(--color-border); border-radius: var(--radius-full); font-size: 0.8rem; font-weight: 500; color: var(--color-text-secondary); background: var(--color-surface); cursor: pointer; transition: all var(--transition-fast); }
        .chip:hover { border-color: var(--color-primary); color: var(--color-primary); }
        .chip--active { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }

        .loading { display: flex; justify-content: center; padding: 60px; }
        .spinner { width: 36px; height: 36px; border: 3px solid var(--color-border); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 700ms linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px; color: var(--color-text-muted); }

        .act__timeline { display: flex; flex-direction: column; gap: var(--space-6); }

        .act__group { }
        .act__date-label { font-size: 0.78rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; padding: var(--space-2) 0; border-bottom: 1px solid var(--color-border); margin-bottom: var(--space-3); }

        .act__items { display: flex; flex-direction: column; gap: 0; }

        .act-item { display: flex; align-items: flex-start; gap: var(--space-4); padding: var(--space-3) 0; border-bottom: 1px solid var(--color-border); }
        .act-item:last-child { border-bottom: none; }

        .act-item__icon { width: 36px; height: 36px; border-radius: var(--radius-m); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

        .act-item__body { flex: 1; min-width: 0; }
        .act-item__row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
        .act-item__type { font-size: 0.8rem; font-weight: 700; }
        .act-item__amount { font-size: 0.9rem; font-weight: 700; font-family: var(--font-heading); }
        .act-item__desc { font-size: 0.875rem; color: var(--color-text); display: block; margin-top: 1px; }
        .act-item__meta { display: flex; align-items: center; gap: var(--space-3); margin-top: 2px; }
        .act-item__staff { font-size: 0.75rem; color: var(--color-primary); font-weight: 500; }
        .act-item__time { font-size: 0.72rem; color: var(--color-text-muted); }

        .act__load-more { display: flex; justify-content: center; padding: var(--space-4); }
        .btn-load-more { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-3) var(--space-6); border: 1.5px solid var(--color-border); border-radius: var(--radius-l); font-size: 0.875rem; font-weight: 600; background: var(--color-surface); color: var(--color-text-secondary); cursor: pointer; transition: all var(--transition-fast); }
        .btn-load-more:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary); }
        .btn-load-more:disabled { opacity: 0.6; cursor: not-allowed; }
        .spinner-sm { width: 14px; height: 14px; border: 2px solid var(--color-border); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 700ms linear infinite; display: inline-block; }
      `}</style>
    </div>
  )
}
