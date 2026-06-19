import { useQuery } from '@tanstack/react-query'
import { Activity, Zap, Database, CheckCircle, AlertTriangle, XCircle, RefreshCw } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { formatDistanceToNow } from 'date-fns'

interface HealthMetric {
  name: string
  status: 'healthy' | 'warning' | 'error'
  value: string
  detail?: string
}

interface DBStats {
  products: number
  customers: number
  transactions: number
  staff: number
  lastSync: string
}

export function ObservabilityPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)

  const { data: dbStats, isLoading: dbLoading, dataUpdatedAt, refetch } = useQuery<DBStats>({
    queryKey: ['obs-db-stats', shop?.id],
    enabled: !!shop?.id,
    refetchInterval: 60_000,
    queryFn: async () => {
      const [p, c, t, s] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('shop_id', shop!.id).eq('active', true),
        supabase.from('customers').select('id', { count: 'exact', head: true }).eq('shop_id', shop!.id).eq('active', true),
        supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('shop_id', shop!.id),
        supabase.from('staff').select('id', { count: 'exact', head: true }).eq('shop_id', shop!.id).eq('is_active', true),
      ])
      return { products: p.count ?? 0, customers: c.count ?? 0, transactions: t.count ?? 0, staff: s.count ?? 0, lastSync: new Date().toISOString() }
    },
  })

  const { data: recentErrors = [] } = useQuery<string[]>({
    queryKey: ['obs-errors', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('webhook_deliveries')
        .select('created_at, status_code')
        .eq('shop_id', shop!.id)
        .not('status_code', 'is', null)
        .gte('status_code', 400)
        .order('created_at', { ascending: false })
        .limit(5)
      return (data ?? []).map(d => `Webhook failed (${d.status_code}) — ${formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}`)
    },
  })

  const { data: pendingApprovals = 0 } = useQuery<number>({
    queryKey: ['obs-approvals', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { count } = await supabase.from('approval_requests').select('id', { count: 'exact', head: true }).eq('shop_id', shop!.id).eq('status', 'pending')
      return count ?? 0
    },
  })

  const { data: unreadNotifs = 0 } = useQuery<number>({
    queryKey: ['obs-notifs', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('shop_id', shop!.id).eq('is_read', false)
      return count ?? 0
    },
  })

  const healthMetrics: HealthMetric[] = [
    { name: 'Database Connection', status: dbStats ? 'healthy' : 'warning', value: dbStats ? 'Connected' : 'Checking…', detail: dbStats ? `Last synced ${formatDistanceToNow(new Date(dbStats.lastSync), { addSuffix: true })}` : undefined },
    { name: 'Authentication', status: user ? 'healthy' : 'error', value: user ? 'Active' : 'Not authenticated', detail: user?.email },
    { name: 'Pending Approvals', status: pendingApprovals > 5 ? 'warning' : 'healthy', value: `${pendingApprovals} pending`, detail: pendingApprovals > 0 ? 'Review in Approvals page' : 'All clear' },
    { name: 'Unread Notifications', status: unreadNotifs > 10 ? 'warning' : 'healthy', value: `${unreadNotifs} unread`, detail: undefined },
    { name: 'Webhook Errors', status: recentErrors.length > 0 ? 'warning' : 'healthy', value: recentErrors.length > 0 ? `${recentErrors.length} recent errors` : 'No errors', detail: recentErrors[0] },
  ]

  const overallHealth = healthMetrics.some(m => m.status === 'error') ? 'error' : healthMetrics.some(m => m.status === 'warning') ? 'warning' : 'healthy'
  const healthColor = { healthy: '#16a34a', warning: '#f59e0b', error: '#dc2626' }[overallHealth]
  const HealthIcon = { healthy: CheckCircle, warning: AlertTriangle, error: XCircle }[overallHealth]

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={22} style={{ color: 'var(--color-primary)' }} /> System Health
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 4 }}>Real-time observability and system status</p>
        </div>
        <button onClick={() => refetch()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'transparent', color: 'var(--color-text)', cursor: 'pointer', fontSize: 13 }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Overall health banner */}
      <div style={{ background: `${healthColor}15`, border: `2px solid ${healthColor}`, borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <HealthIcon size={28} style={{ color: healthColor, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: healthColor, textTransform: 'capitalize' }}>System {overallHealth === 'healthy' ? 'Healthy' : overallHealth === 'warning' ? 'Has Warnings' : 'Has Errors'}</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
            {dataUpdatedAt ? `Last checked ${formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true })}` : 'Checking…'}
          </div>
        </div>
      </div>

      {/* Health metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 12, marginBottom: 20 }}>
        {healthMetrics.map(m => {
          const Icon = m.status === 'healthy' ? CheckCircle : m.status === 'warning' ? AlertTriangle : XCircle
          return (
            <div key={m.name} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Icon size={18} style={{ color: m.status === 'healthy' ? '#16a34a' : m.status === 'warning' ? '#f59e0b' : '#dc2626', flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 2 }}>{m.name}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: m.status === 'healthy' ? '#16a34a' : m.status === 'warning' ? '#f59e0b' : '#dc2626' }}>{m.value}</div>
                {m.detail && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>{m.detail}</div>}
              </div>
            </div>
          )
        })}
      </div>

      {/* DB Statistics */}
      <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Database size={16} style={{ color: 'var(--color-primary)' }} />
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Database Statistics</h3>
        </div>
        {dbLoading ? (
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>Loading…</div>
        ) : dbStats ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 12 }}>
            {[
              { label: 'Products', value: dbStats.products, icon: '📦' },
              { label: 'Customers', value: dbStats.customers, icon: '👤' },
              { label: 'Transactions', value: dbStats.transactions, icon: '🛒' },
              { label: 'Staff', value: dbStats.staff, icon: '👥' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center', padding: 10, background: 'var(--color-bg)', borderRadius: 8 }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>{s.value.toLocaleString()}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Feature flags status */}
      <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Zap size={16} style={{ color: '#f59e0b' }} />
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>System Info</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
          {[
            { label: 'Shop ID', value: (shop?.id?.slice(0, 8) ?? 'N/A') + '…' },
            { label: 'User', value: user?.email ?? 'N/A' },
            { label: 'Platform', value: 'Supabase + React' },
            { label: 'Version', value: 'DukaOS Enterprise' },
          ].map(i => (
            <div key={i.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--color-bg)', borderRadius: 6 }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>{i.label}</span>
              <span style={{ color: 'var(--color-text)', fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>{i.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
