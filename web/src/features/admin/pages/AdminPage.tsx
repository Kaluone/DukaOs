import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  Building2, Users, TrendingUp, CheckCircle,
  XCircle, Eye, Ban, Trash2, RefreshCw,
} from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { format } from 'date-fns'
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TenantRow {
  id: string
  name: string
  owner_email: string
  plan_name: string
  status: string
  trial_ends_at: string | null
  current_period_end: string | null
  created_at: string
  transaction_count: number
  product_count: number
}

interface AdminStats {
  total: number
  active: number
  trial: number
  suspended: number
  cancelled: number
  mrr: number
  arr: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('sw-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(n)
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    active:    { cls: 'pill-success', label: 'Active' },
    trial:     { cls: 'pill-primary', label: 'Trial' },
    grace:     { cls: 'pill-warning', label: 'Grace' },
    expired:   { cls: 'pill-error',   label: 'Expired' },
    suspended: { cls: 'pill-error',   label: 'Suspended' },
    cancelled: { cls: 'pill-default', label: 'Cancelled' },
  }
  const cfg = map[status] ?? map.cancelled
  return <span className={`pill ${cfg.cls}`}>{cfg.label}</span>
}

// ─── Guard: only super admins can access this page ────────────────────────────

// Owner emails that always have admin access (initial setup)
const OWNER_EMAILS = ['kalungura555@gmail.com', 'f.kalungura@autorevenuelabs.com']

function useIsAdmin(userId?: string) {
  const { user } = useAuth()
  return useQuery<boolean>({
    queryKey: ['is-super-admin', userId, user?.email],
    queryFn: async () => {
      if (user?.email && OWNER_EMAILS.includes(user.email)) return true
      const { data } = await supabase
        .from('super_admins')
        .select('user_id')
        .eq('user_id', userId!)
        .maybeSingle()
      return !!data
    },
    enabled: !!userId,
  })
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useAdminStats() {
  return useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [shops, subs] = await Promise.all([
        supabase.from('shops').select('id', { count: 'exact', head: true }),
        supabase.from('shop_subscriptions').select('plan_name, status, billing_cycle'),
      ])

      const subRows = subs.data ?? []
      const active    = subRows.filter(s => s.status === 'active').length
      const trial     = subRows.filter(s => s.status === 'trial').length
      const suspended = subRows.filter(s => s.status === 'suspended').length
      const cancelled = subRows.filter(s => s.status === 'cancelled').length

      // MRR calculation based on plan prices (approximate)
      const PLAN_PRICES: Record<string, number> = { free: 0, starter: 15000, business: 45000, enterprise: 120000 }
      const mrr = subRows
        .filter(s => s.status === 'active')
        .reduce((sum, s) => {
          const monthly = s.billing_cycle === 'yearly'
            ? (PLAN_PRICES[s.plan_name] ?? 0) // already monthly rate
            : (PLAN_PRICES[s.plan_name] ?? 0)
          return sum + monthly
        }, 0)

      return {
        total: shops.count ?? 0,
        active, trial, suspended, cancelled,
        mrr, arr: mrr * 12,
      }
    },
  })
}

function useTenants(search: string, statusFilter: string, page: number) {
  const PAGE_SIZE = 20
  return useQuery<TenantRow[]>({
    queryKey: ['admin-tenants', search, statusFilter, page],
    queryFn: async () => {
      // Join shops + subscriptions to get tenant list
      const { data: subs, error } = await supabase
        .from('shop_subscriptions')
        .select(`
          plan_name, status, trial_ends_at, current_period_end,
          shop:shop_id(id, name, created_at, owner_user_id)
        `)
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
        .order('shop_id')

      if (error) throw error

      return (subs ?? []).map((s: any) => ({
        id: s.shop?.id,
        name: s.shop?.name ?? 'Unknown',
        owner_email: s.shop?.owner_user_id?.slice(0, 8) + '…', // anonymized
        plan_name: s.plan_name,
        status: s.status,
        trial_ends_at: s.trial_ends_at,
        current_period_end: s.current_period_end,
        created_at: s.shop?.created_at,
        transaction_count: 0,
        product_count: 0,
      }))
    },
  })
}

function useGrowthData() {
  return useQuery({
    queryKey: ['admin-growth'],
    queryFn: async () => {
      const { data } = await supabase
        .from('shops')
        .select('created_at')
        .order('created_at')

      if (!data?.length) return []

      // Group by month
      const byMonth: Record<string, number> = {}
      for (const shop of data) {
        const month = format(new Date(shop.created_at), 'MMM yy')
        byMonth[month] = (byMonth[month] ?? 0) + 1
      }

      // Cumulative
      let cumulative = 0
      return Object.entries(byMonth).map(([month, count]) => {
        cumulative += count
        return { month, new: count, total: cumulative }
      }).slice(-12)
    },
  })
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AdminPage() {
  const { user } = useAuth()
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin(user?.id)
  const qc = useQueryClient()

  const [search, setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage]           = useState(0)
  const [selectedTenant, setSelectedTenant] = useState<TenantRow | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ tenant: TenantRow; action: string } | null>(null)

  const { data: stats }     = useAdminStats()
  const { data: tenants = [], isLoading: tenantsLoading } = useTenants(search, statusFilter, page)
  const { data: growthData = [] } = useGrowthData()

  const tenantActionMutation = useMutation({
    mutationFn: async ({ tenantId, action }: { tenantId: string; action: string }) => {
      if (action === 'suspend') {
        await supabase.from('shop_subscriptions').update({ status: 'suspended', suspended_at: new Date().toISOString() }).eq('shop_id', tenantId)
      } else if (action === 'activate') {
        await supabase.from('shop_subscriptions').update({ status: 'active', suspended_at: null }).eq('shop_id', tenantId)
      } else if (action === 'delete') {
        await supabase.from('shops').delete().eq('id', tenantId)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-tenants'] })
      qc.invalidateQueries({ queryKey: ['admin-stats'] })
      setConfirmAction(null)
    },
  })

  if (adminLoading) return <div className="adm-loading"><div className="spinner" /></div>

  if (!isAdmin) {
    return (
      <div className="adm-denied">
        <XCircle size={48} style={{ color: 'var(--color-error)' }} />
        <h2>Access Denied</h2>
        <p>This panel is restricted to AutoRevenue Labs super admins only.</p>
      </div>
    )
  }

  const STATUSES = ['all', 'active', 'trial', 'grace', 'expired', 'suspended', 'cancelled']

  return (
    <div className="adm">
      <div className="adm__header">
        <div>
          <h1 className="adm__title">Admin Panel</h1>
          <p className="adm__sub">AutoRevenue Labs — Platform Control</p>
        </div>
        <button className="btn-refresh" onClick={() => qc.invalidateQueries()}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="adm__stats">
        {[
          { label: 'Total Tenants', value: stats?.total ?? 0, icon: Building2, color: 'primary' },
          { label: 'Active',        value: stats?.active ?? 0, icon: CheckCircle, color: 'success' },
          { label: 'Trial',         value: stats?.trial ?? 0,  icon: Users,       color: 'accent' },
          { label: 'Suspended',     value: stats?.suspended ?? 0, icon: Ban,     color: 'error' },
          { label: 'MRR',           value: fmt(stats?.mrr ?? 0), icon: TrendingUp, color: 'primary', wide: true },
          { label: 'ARR',           value: fmt(stats?.arr ?? 0), icon: TrendingUp, color: 'success', wide: true },
        ].map(s => (
          <div key={s.label} className={`stat-card ${s.wide ? 'stat-card--wide' : ''}`}>
            <span className="stat-card__label">{s.label}</span>
            <span className={`stat-card__value stat-card__value--${s.color}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Growth chart */}
      {growthData.length > 0 && (
        <div className="card">
          <div className="card-header"><h3>Tenant Growth (Last 12 Months)</h3></div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer>
              <LineChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="total" name="Total Tenants" stroke="var(--color-primary)" strokeWidth={2} dot={{ fill: 'var(--color-primary)', r: 3 }} />
                <Line type="monotone" dataKey="new"   name="New Tenants"   stroke="var(--color-success)" strokeWidth={2} strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tenant table */}
      <div className="card">
        <div className="card-header">
          <h3>Tenants</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {STATUSES.map(s => (
              <button key={s} className={`chip ${statusFilter === s ? 'chip--active' : ''}`} onClick={() => { setStatusFilter(s); setPage(0) }}>
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <input
          className="search-input" type="search" placeholder="Search tenants…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ marginBottom: '16px', width: '100%', maxWidth: '300px' }}
        />

        {tenantsLoading ? (
          <div className="adm-loading"><div className="spinner" /></div>
        ) : !tenants.length ? (
          <div className="empty">No tenants found</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="adm-table">
              <thead><tr>
                <th>Shop Name</th><th>Plan</th><th>Status</th>
                <th>Created</th><th>Period End</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {tenants.map(tenant => (
                  <tr key={tenant.id}>
                    <td style={{ fontWeight: 600 }}>{tenant.name}</td>
                    <td style={{ textTransform: 'capitalize' }}>{tenant.plan_name}</td>
                    <td><StatusPill status={tenant.status} /></td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {tenant.created_at ? format(new Date(tenant.created_at), 'dd/MM/yyyy') : '—'}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {tenant.current_period_end ? format(new Date(tenant.current_period_end), 'dd/MM/yyyy') : '—'}
                    </td>
                    <td>
                      <div className="action-btns">
                        <button className="action-btn" title="View details" onClick={() => setSelectedTenant(tenant)}>
                          <Eye size={13} />
                        </button>
                        {tenant.status !== 'suspended' ? (
                          <button className="action-btn action-btn--warn" title="Suspend tenant"
                            onClick={() => setConfirmAction({ tenant, action: 'suspend' })}>
                            <Ban size={13} />
                          </button>
                        ) : (
                          <button className="action-btn action-btn--success" title="Activate tenant"
                            onClick={() => setConfirmAction({ tenant, action: 'activate' })}>
                            <CheckCircle size={13} />
                          </button>
                        )}
                        <button className="action-btn action-btn--danger" title="Delete tenant"
                          onClick={() => setConfirmAction({ tenant, action: 'delete' })}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pagination">
          <button className="pag-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span className="pag-info">Page {page + 1}</span>
          <button className="pag-btn" disabled={tenants.length < 20} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      </div>

      {/* Tenant detail modal */}
      {selectedTenant && (
        <div className="modal-overlay" onClick={() => setSelectedTenant(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <h3>Tenant Details</h3>
              <button onClick={() => setSelectedTenant(null)} className="modal__close">×</button>
            </div>
            <div className="modal__body">
              <div className="detail-grid">
                <div className="detail-item"><span>Shop Name</span><strong>{selectedTenant.name}</strong></div>
                <div className="detail-item"><span>Tenant ID</span><strong style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{selectedTenant.id}</strong></div>
                <div className="detail-item"><span>Plan</span><strong style={{ textTransform: 'capitalize' }}>{selectedTenant.plan_name}</strong></div>
                <div className="detail-item"><span>Status</span><StatusPill status={selectedTenant.status} /></div>
                <div className="detail-item"><span>Created</span><strong>{selectedTenant.created_at ? format(new Date(selectedTenant.created_at), 'dd/MM/yyyy HH:mm') : '—'}</strong></div>
                <div className="detail-item"><span>Period End</span><strong>{selectedTenant.current_period_end ? format(new Date(selectedTenant.current_period_end), 'dd/MM/yyyy') : '—'}</strong></div>
                {selectedTenant.trial_ends_at && (
                  <div className="detail-item"><span>Trial Ends</span><strong>{format(new Date(selectedTenant.trial_ends_at), 'dd/MM/yyyy')}</strong></div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm action modal */}
      {confirmAction && (
        <div className="modal-overlay" onClick={() => setConfirmAction(null)}>
          <div className="modal modal--sm" onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <h3>{confirmAction.action === 'delete' ? 'Delete Tenant' : confirmAction.action === 'suspend' ? 'Suspend Tenant' : 'Activate Tenant'}</h3>
              <button onClick={() => setConfirmAction(null)} className="modal__close">×</button>
            </div>
            <div className="modal__body">
              {confirmAction.action === 'delete'
                ? <p>Are you sure you want to <strong>permanently delete</strong> tenant <strong>{confirmAction.tenant.name}</strong>? This cannot be undone.</p>
                : <p>Are you sure you want to <strong>{confirmAction.action}</strong> tenant <strong>{confirmAction.tenant.name}</strong>?</p>
              }
              <div className="confirm-actions">
                <button className="btn-cancel" onClick={() => setConfirmAction(null)}>Cancel</button>
                <button
                  className={`btn-confirm ${confirmAction.action === 'delete' ? 'btn-confirm--danger' : confirmAction.action === 'suspend' ? 'btn-confirm--warn' : 'btn-confirm--success'}`}
                  onClick={() => tenantActionMutation.mutate({ tenantId: confirmAction.tenant.id, action: confirmAction.action })}
                  disabled={tenantActionMutation.isPending}
                >
                  {tenantActionMutation.isPending ? 'Processing…' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .adm { display: flex; flex-direction: column; gap: var(--space-5); }
        .adm__header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3); }
        .adm__title { font-size: 1.6rem; font-weight: 800; }
        .adm__sub { color: var(--color-text-muted); font-size: 0.85rem; }

        .btn-refresh { display: flex; align-items: center; gap: 6px; padding: var(--space-2) var(--space-4); border: 1.5px solid var(--color-border); border-radius: var(--radius-l); font-size: 0.85rem; font-weight: 600; background: var(--color-surface); color: var(--color-text-secondary); cursor: pointer; transition: all var(--transition-fast); }
        .btn-refresh:hover { border-color: var(--color-primary); color: var(--color-primary); }

        .adm__stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: var(--space-4); }
        .stat-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-l); padding: var(--space-4); box-shadow: var(--shadow-xs); display: flex; flex-direction: column; gap: 4px; }
        .stat-card--wide { grid-column: span 2; }
        .stat-card__label { font-size: 0.75rem; color: var(--color-text-muted); font-weight: 500; }
        .stat-card__value { font-size: 1.4rem; font-weight: 800; font-family: var(--font-heading); }
        .stat-card__value--primary { color: var(--color-primary); }
        .stat-card__value--success { color: var(--color-success); }
        .stat-card__value--error   { color: var(--color-error); }
        .stat-card__value--accent  { color: var(--color-accent); }

        .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-l); padding: var(--space-5); box-shadow: var(--shadow-xs); }
        .card-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3); margin-bottom: var(--space-4); }
        .card-header h3 { font-size: 0.95rem; font-weight: 700; }

        .chip { padding: 4px 10px; border: 1.5px solid var(--color-border); border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 500; color: var(--color-text-secondary); background: var(--color-surface); cursor: pointer; transition: all var(--transition-fast); }
        .chip:hover { border-color: var(--color-primary); color: var(--color-primary); }
        .chip--active { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }

        .search-input { padding: 7px 12px; border: 1.5px solid var(--color-border); border-radius: var(--radius-m); font-size: 0.875rem; outline: none; background: var(--color-surface); color: var(--color-text); }
        .search-input:focus { border-color: var(--color-primary); }

        .adm-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; min-width: 600px; }
        .adm-table th { text-align: left; padding: var(--space-2) var(--space-3); color: var(--color-text-muted); font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 2px solid var(--color-border); }
        .adm-table td { padding: var(--space-3); border-bottom: 1px solid var(--color-border); }
        .adm-table tr:last-child td { border-bottom: none; }
        .adm-table tr:hover td { background: var(--color-surface-2); }

        .action-btns { display: flex; gap: 4px; }
        .action-btn { padding: 5px 7px; border: 1px solid var(--color-border); border-radius: var(--radius-s); background: var(--color-surface); color: var(--color-text-muted); cursor: pointer; transition: all var(--transition-fast); }
        .action-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
        .action-btn--warn:hover { border-color: var(--color-warning); color: var(--color-warning); }
        .action-btn--success:hover { border-color: var(--color-success); color: var(--color-success); }
        .action-btn--danger:hover { border-color: var(--color-error); color: var(--color-error); }

        .pill { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: var(--radius-full); font-size: 0.72rem; font-weight: 700; }
        .pill-default { background: var(--color-surface-2); color: var(--color-text-secondary); }
        .pill-success { background: var(--color-success-bg, #dcfce7); color: var(--color-success); }
        .pill-warning { background: var(--color-warning-bg, #fef9c3); color: var(--color-warning); }
        .pill-error   { background: var(--color-error-bg, #fee2e2); color: var(--color-error); }
        .pill-primary { background: var(--color-primary-light); color: var(--color-primary); }

        .pagination { display: flex; align-items: center; justify-content: center; gap: var(--space-4); padding-top: var(--space-4); border-top: 1px solid var(--color-border); margin-top: var(--space-4); }
        .pag-btn { padding: 6px 14px; border: 1.5px solid var(--color-border); border-radius: var(--radius-m); font-size: 0.85rem; font-weight: 500; background: var(--color-surface); color: var(--color-text-secondary); cursor: pointer; transition: all var(--transition-fast); }
        .pag-btn:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary); }
        .pag-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .pag-info { font-size: 0.85rem; color: var(--color-text-muted); }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 200; display: flex; align-items: center; justify-content: center; padding: var(--space-4); }
        .modal { background: var(--color-surface); border-radius: var(--radius-l); max-width: 560px; width: 100%; box-shadow: var(--shadow-xl, 0 20px 60px rgba(0,0,0,0.3)); }
        .modal--sm { max-width: 380px; }
        .modal__header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-5); border-bottom: 1px solid var(--color-border); }
        .modal__header h3 { font-weight: 700; font-size: 1rem; }
        .modal__close { font-size: 1.4rem; color: var(--color-text-muted); cursor: pointer; background: none; border: none; line-height: 1; }
        .modal__body { padding: var(--space-5); }

        .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
        .detail-item { display: flex; flex-direction: column; gap: 2px; }
        .detail-item span { font-size: 0.75rem; color: var(--color-text-muted); }
        .detail-item strong { font-size: 0.875rem; }

        .confirm-actions { display: flex; justify-content: flex-end; gap: var(--space-3); margin-top: var(--space-5); }
        .btn-cancel { padding: var(--space-2) var(--space-5); border: 1.5px solid var(--color-border); border-radius: var(--radius-m); font-size: 0.875rem; font-weight: 600; background: var(--color-surface); color: var(--color-text-secondary); cursor: pointer; }
        .btn-confirm { padding: var(--space-2) var(--space-5); border-radius: var(--radius-m); font-size: 0.875rem; font-weight: 600; color: #fff; cursor: pointer; transition: all var(--transition-fast); }
        .btn-confirm:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-confirm--danger  { background: var(--color-error); }
        .btn-confirm--warn    { background: var(--color-warning); }
        .btn-confirm--success { background: var(--color-success); }

        .adm-loading { display: flex; justify-content: center; padding: 40px; }
        .spinner { width: 36px; height: 36px; border: 3px solid var(--color-border); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 700ms linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .empty { text-align: center; padding: 40px; color: var(--color-text-muted); font-size: 0.875rem; }

        .adm-denied { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-4); min-height: 400px; text-align: center; }
        .adm-denied h2 { font-size: 1.5rem; font-weight: 800; }
        .adm-denied p { color: var(--color-text-muted); }
      `}</style>
    </div>
  )
}
