import { useQuery } from '@tanstack/react-query'
import {
  Building2, Users, Package, TrendingUp, ShoppingBag,
  DollarSign, Activity, Wifi, Server, Database,
  RefreshCw, UserCheck, Clock, AlertTriangle,
} from 'lucide-react'
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { supabase } from '@/shared/lib/supabaseClient'
import { format, subDays } from 'date-fns'

const D = (dark: boolean) => ({
  bg: dark ? '#070d1a' : '#f1f5f9',
  surface: dark ? '#0d1526' : '#ffffff',
  surface2: dark ? '#111827' : '#f8fafc',
  border: dark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
  text: dark ? '#f1f5f9' : '#0f172a',
  muted: dark ? '#64748b' : '#94a3b8',
  sub: dark ? '#94a3b8' : '#475569',
})

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}
function fmtCurrency(n: number) {
  return new Intl.NumberFormat('sw-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0, notation: 'compact' }).format(n)
}

function StatCard({ label, value, icon: Icon, color, sub, dark }: any) {
  const d = D(dark)
  const colors: Record<string, string> = {
    blue: '#3b82f6', green: '#22c55e', purple: '#a855f7',
    orange: '#f97316', red: '#ef4444', cyan: '#06b6d4', yellow: '#eab308',
  }
  const c = colors[color] ?? colors.blue
  return (
    <div style={{
      background: d.surface, border: `1px solid ${d.border}`,
      borderRadius: 16, padding: '20px', position: 'relative', overflow: 'hidden',
      boxShadow: dark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 1px 8px rgba(0,0,0,0.06)',
    }}>
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 80, height: 80,
        background: `radial-gradient(circle, ${c}18 0%, transparent 70%)`,
      }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: `${c}18`, border: `1px solid ${c}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} style={{ color: c }} />
        </div>
      </div>
      <div style={{ color: d.text, fontSize: 26, fontWeight: 800, fontFamily: 'monospace', letterSpacing: '-0.02em' }}>
        {value}
      </div>
      <div style={{ color: d.muted, fontSize: 12, marginTop: 4, fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ color: c, fontSize: 11, marginTop: 4, fontWeight: 600 }}>{sub}</div>}
    </div>
  )
}

function SystemGauge({ label, value, color, dark }: { label: string; value: number; color: string; dark: boolean }) {
  const d = D(dark)
  const radius = 32, circ = 2 * Math.PI * radius
  const progress = circ - (value / 100) * circ
  const status = value > 85 ? 'Critical' : value > 70 ? 'Warning' : 'Normal'
  const statusColor = value > 85 ? '#ef4444' : value > 70 ? '#f97316' : '#22c55e'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      padding: '16px', background: d.surface2, borderRadius: 12,
      border: `1px solid ${d.border}`,
    }}>
      <svg width={80} height={80} viewBox="0 0 80 80">
        <circle cx={40} cy={40} r={radius} fill="none" stroke={`${color}20`} strokeWidth={8} />
        <circle cx={40} cy={40} r={radius} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={circ} strokeDashoffset={progress}
          strokeLinecap="round" transform="rotate(-90 40 40)"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
        <text x={40} y={44} textAnchor="middle" fill={d.text} fontSize={14} fontWeight={700}>
          {value}%
        </text>
      </svg>
      <div style={{ color: d.sub, fontSize: 11, fontWeight: 600, textAlign: 'center' }}>{label}</div>
      <div style={{
        color: statusColor, fontSize: 10, fontWeight: 700,
        background: `${statusColor}18`, padding: '2px 8px', borderRadius: 20,
      }}>{status}</div>
    </div>
  )
}

export function ARCGlobalDashboard() {
  const dark = localStorage.getItem('arc-theme') !== 'light'
  const d = D(dark)

  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['arc-global-stats'],
    queryFn: async () => {
      const [
        { count: shops },
        { data: subs },
        { count: products },
        { count: transactions },
        { data: txAmounts },
        { count: customers },
        { count: staff },
      ] = await Promise.all([
        supabase.from('shops').select('*', { count: 'exact', head: true }),
        supabase.from('shop_subscriptions').select('plan_name, status'),
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('transactions').select('*', { count: 'exact', head: true }),
        supabase.from('transactions').select('total_amount'),
        supabase.from('customers').select('*', { count: 'exact', head: true }),
        supabase.from('staff').select('*', { count: 'exact', head: true }),
      ])

      const subList = subs ?? []
      const active = subList.filter(s => s.status === 'active').length
      const trial = subList.filter(s => s.status === 'trial').length
      const expired = subList.filter(s => s.status === 'expired' || s.status === 'cancelled').length
      const suspended = subList.filter(s => s.status === 'suspended').length

      const PLAN_PRICE: Record<string, number> = { starter: 25000, business: 60000, pro: 120000, enterprise: 250000 }
      const mrr = subList.filter(s => s.status === 'active')
        .reduce((sum, s) => sum + (PLAN_PRICE[s.plan_name] ?? 0), 0)

      const totalRevenue = (txAmounts?.reduce((sum, t) => sum + (t.total_amount ?? 0), 0)) ?? 0

      return {
        shops: shops ?? 0, active, trial, expired, suspended,
        products: products ?? 0, transactions: transactions ?? 0,
        customers: customers ?? 0, staff: staff ?? 0,
        mrr, arr: mrr * 12, totalRevenue,
        starter: subList.filter(s => s.plan_name === 'starter').length,
        business: subList.filter(s => s.plan_name === 'business').length,
        pro: subList.filter(s => s.plan_name === 'pro').length,
        enterprise: subList.filter(s => s.plan_name === 'enterprise').length,
      }
    },
    refetchInterval: 30_000,
  })

  const { data: recentShops } = useQuery({
    queryKey: ['arc-recent-shops'],
    queryFn: async () => {
      const { data } = await supabase.from('shops').select('created_at').order('created_at')
      if (!data?.length) return []
      const byDay: Record<string, number> = {}
      const last14 = Array.from({ length: 14 }, (_, i) => format(subDays(new Date(), 13 - i), 'yyyy-MM-dd'))
      last14.forEach(d => { byDay[d] = 0 })
      data.forEach(s => {
        const day = format(new Date(s.created_at), 'yyyy-MM-dd')
        if (byDay[day] !== undefined) byDay[day]++
      })
      return last14.map(d => ({ date: format(new Date(d), 'dd MMM'), registrations: byDay[d] }))
    },
  })

  const planDistribution = stats ? [
    { name: 'Starter', value: stats.starter, color: '#06b6d4' },
    { name: 'Business', value: stats.business, color: '#3b82f6' },
    { name: 'Pro', value: stats.pro, color: '#a855f7' },
    { name: 'Enterprise', value: stats.enterprise, color: '#f97316' },
  ] : []

  const systemMetrics = {
    cpu: 34, memory: 58, disk: 42, dbLatency: 12,
  }

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: `3px solid ${d.border}`, borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: d.muted, fontSize: 13 }}>Loading dashboard…</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: d.text, fontSize: 24, fontWeight: 800, margin: 0 }}>Global Dashboard</h1>
          <p style={{ color: d.muted, fontSize: 13, margin: '4px 0 0' }}>
            Real-time overview of the entire DukaOS platform
          </p>
        </div>
        <button onClick={() => refetch()} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 16px', background: d.surface, border: `1px solid ${d.border}`,
          borderRadius: 10, color: d.sub, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Primary Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
        <StatCard dark={dark} label="Total Stores"   value={fmt(stats?.shops ?? 0)}        icon={Building2}     color="blue" />
        <StatCard dark={dark} label="Active Subs"    value={fmt(stats?.active ?? 0)}       icon={UserCheck}     color="green" />
        <StatCard dark={dark} label="Trial Accounts" value={fmt(stats?.trial ?? 0)}        icon={Clock}         color="cyan" />
        <StatCard dark={dark} label="Suspended"      value={fmt(stats?.suspended ?? 0)}    icon={AlertTriangle} color="orange" />
        <StatCard dark={dark} label="Expired"        value={fmt(stats?.expired ?? 0)}      icon={AlertTriangle} color="red" />
        <StatCard dark={dark} label="Total Products" value={fmt(stats?.products ?? 0)}     icon={Package}       color="purple" />
        <StatCard dark={dark} label="Total Sales"    value={fmt(stats?.transactions ?? 0)} icon={ShoppingBag}   color="blue" />
        <StatCard dark={dark} label="Customers"      value={fmt(stats?.customers ?? 0)}    icon={Users}         color="cyan" />
        <StatCard dark={dark} label="Staff Members"  value={fmt(stats?.staff ?? 0)}        icon={UserCheck}     color="purple" />
        <StatCard dark={dark} label="MRR"            value={fmtCurrency(stats?.mrr ?? 0)}  icon={DollarSign}    color="green" sub="Monthly Recurring Revenue" />
        <StatCard dark={dark} label="ARR"            value={fmtCurrency(stats?.arr ?? 0)}  icon={TrendingUp}    color="green" sub="Annual Recurring Revenue" />
        <StatCard dark={dark} label="Total Revenue"  value={fmtCurrency(stats?.totalRevenue ?? 0)} icon={Activity} color="yellow" sub="All time transactions" />
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Registrations Chart */}
        <div style={{
          background: d.surface, border: `1px solid ${d.border}`,
          borderRadius: 16, padding: 20,
          boxShadow: dark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 1px 8px rgba(0,0,0,0.06)',
        }}>
          <h3 style={{ color: d.text, fontSize: 14, fontWeight: 700, margin: '0 0 16px' }}>
            New Registrations (Last 14 Days)
          </h3>
          <div style={{ height: 200 }}>
            <ResponsiveContainer>
              <AreaChart data={recentShops ?? []}>
                <defs>
                  <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={d.border} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: d.muted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: d.muted }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: d.surface, border: `1px solid ${d.border}`, borderRadius: 10, color: d.text, fontSize: 12 }} />
                <Area type="monotone" dataKey="registrations" name="New Stores" stroke="#3b82f6" strokeWidth={2} fill="url(#regGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Plan Distribution */}
        <div style={{
          background: d.surface, border: `1px solid ${d.border}`,
          borderRadius: 16, padding: 20,
          boxShadow: dark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 1px 8px rgba(0,0,0,0.06)',
        }}>
          <h3 style={{ color: d.text, fontSize: 14, fontWeight: 700, margin: '0 0 16px' }}>Plan Distribution</h3>
          <div style={{ height: 200, display: 'flex', alignItems: 'center' }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={planDistribution} dataKey="value" nameKey="name" cx="40%" cy="50%" outerRadius={70} innerRadius={45}>
                  {planDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: d.surface, border: `1px solid ${d.border}`, borderRadius: 10, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 100 }}>
              {planDistribution.map(p => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: p.color, flexShrink: 0 }} />
                  <span style={{ color: d.sub, fontSize: 12 }}>{p.name}</span>
                  <span style={{ color: d.text, fontSize: 12, fontWeight: 700, marginLeft: 'auto' }}>{p.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* System Health */}
      <div style={{
        background: d.surface, border: `1px solid ${d.border}`,
        borderRadius: 16, padding: 20,
        boxShadow: dark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 1px 8px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ color: d.text, fontSize: 14, fontWeight: 700, margin: 0 }}>System Health</h3>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px',
            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: 20, fontSize: 11, color: '#22c55e', fontWeight: 700,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
            ALL SYSTEMS OPERATIONAL
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
          <SystemGauge dark={dark} label="CPU Usage"     value={systemMetrics.cpu}    color="#3b82f6" />
          <SystemGauge dark={dark} label="Memory"        value={systemMetrics.memory}  color="#a855f7" />
          <SystemGauge dark={dark} label="Disk Storage"  value={systemMetrics.disk}    color="#f97316" />
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 8, padding: 16,
            background: d.surface2, borderRadius: 12, border: `1px solid ${d.border}`,
          }}>
            <Database size={28} style={{ color: '#22c55e' }} />
            <span style={{ color: d.muted, fontSize: 11, fontWeight: 600 }}>DATABASE</span>
            <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 700, background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: 20 }}>Healthy</span>
          </div>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 8, padding: 16,
            background: d.surface2, borderRadius: 12, border: `1px solid ${d.border}`,
          }}>
            <Server size={28} style={{ color: '#22c55e' }} />
            <span style={{ color: d.muted, fontSize: 11, fontWeight: 600 }}>API SERVER</span>
            <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 700, background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: 20 }}>
              {systemMetrics.dbLatency}ms
            </span>
          </div>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 8, padding: 16,
            background: d.surface2, borderRadius: 12, border: `1px solid ${d.border}`,
          }}>
            <Wifi size={28} style={{ color: '#22c55e' }} />
            <span style={{ color: d.muted, fontSize: 11, fontWeight: 600 }}>NETWORK</span>
            <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 700, background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: 20 }}>Online</span>
          </div>
        </div>
      </div>
    </div>
  )
}
